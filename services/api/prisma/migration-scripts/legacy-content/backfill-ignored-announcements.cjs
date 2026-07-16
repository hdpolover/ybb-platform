/* eslint-disable */
/**
 * Backfill announcements (news) from IGNORED legacy program editions.
 *
 * News is brand-level: editions we ignored (because the new DB already owns the program
 * record) still carry news the new program lacks. This attaches those announcements to the
 * brand's current published+visible program, deduped by title across the brand. Idempotent
 * (legacy_id = legacy announcement id). Additive only.
 */
const { Pool } = require('pg');
const mysql = require('mysql2/promise');

const IGNORED = [12, 21, 22]; // confirmed ignored legacy program editions
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const splitTags = (raw) => !raw ? [] : String(raw).split(',').map((t) => t.trim()).filter(Boolean);
const boolFrom = (n) => n === 1 || n === true;

async function main() {
  const pg = new Pool({ connectionString: process.env.DATABASE_URL });
  const my = await mysql.createConnection({
    host: process.env.LEGACY_DB_HOST, port: Number(process.env.LEGACY_DB_PORT || 3306),
    user: process.env.LEGACY_DB_USER, password: process.env.LEGACY_DB_PASSWORD,
    database: process.env.LEGACY_DB_NAME, charset: 'utf8mb4',
  });

  const [rows] = await my.query(
    `SELECT a.id, a.title, a.content, a.img_url, a.meta_title, a.meta_description, a.tags,
            a.is_active, a.created_at, pc.name AS brand_name
       FROM program_announcements a
       JOIN programs p ON p.id = a.program_id
       JOIN program_categories pc ON pc.id = p.program_category_id
      WHERE a.is_deleted = 0 AND a.program_id IN (${IGNORED.join(',')})
      ORDER BY a.id`,
  );

  // Resolve brand -> representative program + existing titles, once per brand.
  const brandCache = new Map();
  async function resolveBrand(name) {
    if (brandCache.has(name)) return brandCache.get(name);
    const b = (await pg.query(`SELECT id FROM brands WHERE lower(name)=lower($1) LIMIT 1`, [name])).rows[0];
    if (!b) { brandCache.set(name, null); return null; }
    const prog = (await pg.query(
      `SELECT id FROM programs WHERE brand_id=$1 AND is_published AND is_visible_to_users ORDER BY year DESC LIMIT 1`, [b.id])).rows[0];
    const titles = new Set((await pg.query(
      `SELECT lower(pa.title) t FROM program_announcements pa JOIN programs p ON p.id=pa.program_id WHERE p.brand_id=$1`, [b.id])).rows.map((r) => r.t));
    const info = { brandId: b.id, programId: prog && prog.id, titles };
    brandCache.set(name, info);
    return info;
  }
  const allSlugs = new Set((await pg.query(`SELECT slug FROM program_announcements WHERE slug IS NOT NULL`)).rows.map((r) => r.slug));
  // Reuse the existing slug for an already-migrated announcement (stable re-runs).
  const slugByLegacy = new Map((await pg.query(`SELECT legacy_id, slug FROM program_announcements WHERE legacy_id IS NOT NULL AND slug IS NOT NULL`)).rows.map((r) => [r.legacy_id, r.slug]));
  const uniqSlug = (base) => { let s = base, n = 1; while (allSlugs.has(s)) s = `${base}-${++n}`; allSlugs.add(s); return s; };

  let inserted = 0, skippedNoProg = 0;
  for (const r of rows) {
    const info = await resolveBrand(r.brand_name);
    if (!info || !info.programId) { skippedNoProg++; continue; }
    // Migrate EVERY legacy announcement (no title dedup) — completeness is required.
    const slug = slugByLegacy.get(r.id) || uniqSlug(slugify(r.title || '') || `announcement-${r.id}`);
    await pg.query(
      `INSERT INTO program_announcements (program_id,title,content,image_url,category,tags,slug,meta_title,meta_description,target_audience,publish_date,is_active,legacy_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,'News',$5,$6,$7,$8,'all',$9,true,$10,now(),now())
       ON CONFLICT (legacy_id) DO UPDATE SET program_id=EXCLUDED.program_id,title=EXCLUDED.title,content=EXCLUDED.content,image_url=EXCLUDED.image_url,tags=EXCLUDED.tags,slug=EXCLUDED.slug,meta_title=EXCLUDED.meta_title,meta_description=EXCLUDED.meta_description,is_active=EXCLUDED.is_active,updated_at=now()`,
      [info.programId, r.title || '(untitled)', r.content || '', r.img_url || null, splitTags(r.tags),
       slug, r.meta_title || null, r.meta_description || null, r.created_at || new Date(), r.id]);
    inserted++;
  }
  console.log(`backfill: inserted/updated=${inserted}, skipped_no_program=${skippedNoProg}, total_source=${rows.length}`);
  await my.end();
  await pg.end();
}
main().catch((e) => { console.error('BACKFILL FAILED:', e); process.exit(1); });
