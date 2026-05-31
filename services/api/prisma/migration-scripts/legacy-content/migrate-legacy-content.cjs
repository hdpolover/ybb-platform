/* eslint-disable */
/**
 * Legacy content migration (Phase A) — raw-SQL ETL.
 *
 * Runs in-container against a Postgres DB (DATABASE_URL) and reads the legacy MySQL
 * (LEGACY_DB_*). Idempotent via legacy_id upserts. De-dup: brands matched by name;
 * programs in PROGRAM_IGNORE (or exact-slug matches with an existing program) are
 * skipped entirely; orphan-year photos get auto-created "history" program stubs.
 *
 * Raw SQL (not Prisma) so it never touches the live API's generated Prisma client.
 */
const { Pool } = require('pg');
const mysql = require('mysql2/promise');

const RUNDOWN_OFFSET = 2_000_000;
const VIDEO_TESTIMONY_OFFSET = 2_000_000;
const PHOTO_HISTORY_BASE = 9_000_000;
// Stakeholder-confirmed: new DB is authoritative for these legacy programs.
const PROGRAM_IGNORE = new Set([12, 21, 22]);

// ---------- pure mappers ----------
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function deriveYear(name, startDate) {
  const m = String(name || '').match(/\b(19|20)\d{2}\b/g);
  if (m && m.length) return Number(m[m.length - 1]);
  if (startDate) return new Date(startDate).getUTCFullYear();
  return 0;
}
function mapFaqCategory(c) {
  return c === 'payments' ? 'payment'
    : c === 'registration' ? 'registration'
    : c === 'event_details' ? 'event_details' : 'general';
}
function mapAwardTier(t) {
  return t === 'winner' ? 'gold' : t === 'runner_up' ? 'silver' : t === 'mention' ? 'honorable_mention' : null;
}
const splitTags = (raw) => !raw ? [] : String(raw).split(',').map((t) => t.trim()).filter(Boolean);
const boolFrom = (n) => n === 1 || n === true;
const youtubeThumb = (id) => id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
const scheduleDay = (d) => new Date(d).toISOString().slice(0, 10);
const hhmm = (d) => new Date(d).toISOString().slice(11, 16);
function videoTestimonialName(desc) {
  const t = (desc || '').trim();
  if (!t) return 'Alumni Testimonial';
  const first = t.split(/\r?\n/)[0].trim();
  return first.length > 80 ? first.slice(0, 77) + '...' : first;
}
function socialLinks(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (v && String(v).trim()) out[k] = String(v).trim();
  return out;
}

async function main() {
  const pg = new Pool({ connectionString: process.env.DATABASE_URL });
  const my = await mysql.createConnection({
    host: process.env.LEGACY_DB_HOST, port: Number(process.env.LEGACY_DB_PORT || 3306),
    user: process.env.LEGACY_DB_USER, password: process.env.LEGACY_DB_PASSWORD,
    database: process.env.LEGACY_DB_NAME, charset: 'utf8mb4',
  });
  const mq = async (sql, p = []) => (await my.query(sql, p))[0];
  const counts = {};
  const bump = (k, n = 1) => (counts[k] = (counts[k] || 0) + n);

  // ---------- 1. Brands ----------
  const brandMap = new Map(); // legacy category id -> brand uuid
  const cats = await mq(`SELECT id,name,description,about,core_values,objectives,benefits,web_url,
    logo_url,main_banner_url,tagline,contact,location,email,instagram,tiktok,youtube,telegram,is_active
    FROM program_categories WHERE is_deleted=0`);
  for (const r of cats) {
    const social = socialLinks({ instagram: r.instagram, tiktok: r.tiktok, youtube: r.youtube, telegram: r.telegram });
    const metadata = JSON.stringify({ coreValues: r.core_values || null, objectives: r.objectives || null, benefits: r.benefits || null, tagline: r.tagline || null });
    const ex = (await pg.query(
      `SELECT id, about, description, website_url, logo_url, banner_url, contact_email
       FROM brands WHERE legacy_id=$1 OR lower(name)=lower($2) LIMIT 1`, [r.id, r.name])).rows[0];
    let brandId;
    if (ex) {
      const u = await pg.query(
        `UPDATE brands SET legacy_id=$1,
           about=COALESCE(NULLIF(about,''),$2), description=COALESCE(NULLIF(description,''),$3),
           website_url=COALESCE(NULLIF(website_url,''),$4), logo_url=COALESCE(NULLIF(logo_url,''),$5),
           banner_url=COALESCE(NULLIF(banner_url,''),$6), contact_email=COALESCE(NULLIF(contact_email,''),$7),
           updated_at=now()
         WHERE id=$8 RETURNING id`,
        [r.id, r.about || null, r.description || null, r.web_url || null, r.logo_url || null, r.main_banner_url || null, r.email || null, ex.id]);
      brandId = u.rows[0].id;
      bump('brands_anchored');
    } else {
      const ins = await pg.query(
        `INSERT INTO brands (name, slug, description, about, website_url, logo_url, banner_url,
           contact_email, contact_phone, contact_address, social_media_links, is_active, metadata, legacy_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::json,$12,$13::json,$14, now(), now()) RETURNING id`,
        [r.name, slugify(r.name), r.description || null, r.about || null, r.web_url || null, r.logo_url || null,
         r.main_banner_url || null, r.email || null, r.contact || null, r.location || null,
         JSON.stringify(social), boolFrom(r.is_active), metadata, r.id]);
      brandId = ins.rows[0].id;
      bump('brands_created');
    }
    brandMap.set(r.id, brandId);
  }

  // ---------- 2. Program mapping (create vs ignore) ----------
  const legacyPrograms = await mq(`SELECT id, program_category_id, name, banner_url, description,
    essay_guideline_url, registration_video_url, theme, start_date, end_date, usd_in_idr, is_active
    FROM programs WHERE is_deleted=0`);
  // Only ADMIN-owned programs (no legacy_id) count as a dedup match. Programs WE created
  // in a prior run carry a legacy_id and must NOT cause their source rows to be ignored.
  const existingPrograms = (await pg.query(`SELECT id, slug, brand_id, year FROM programs WHERE legacy_id IS NULL`)).rows;
  const ignore = new Set(PROGRAM_IGNORE);
  for (const lp of legacyPrograms) {
    const brandId = brandMap.get(lp.program_category_id);
    if (!brandId) continue;
    const slug = slugify(lp.name);
    if (existingPrograms.some((p) => p.brand_id === brandId && p.slug === slug)) ignore.add(lp.id);
  }

  // ---------- 3. Programs ----------
  const programMap = new Map(); // legacy program id -> {programId, brandId, year}

  // Pre-compute human-friendly slugs. Same-named editions within a brand are ordered by
  // (start_date, id); the earliest keeps the base slug, the rest get -2, -3, ... This is
  // deterministic (independent of processing order) so re-runs produce identical slugs.
  const slugGroups = new Map(); // `${brandId}|${base}` -> [{id, t}]
  for (const r of legacyPrograms) {
    if (ignore.has(r.id)) continue;
    const brandId = brandMap.get(r.program_category_id); if (!brandId) continue;
    const key = `${brandId}|${slugify(r.name)}`;
    if (!slugGroups.has(key)) slugGroups.set(key, []);
    slugGroups.get(key).push({ id: r.id, t: r.start_date ? new Date(r.start_date).getTime() : 0 });
  }
  const niceSlug = new Map(); // legacy id -> slug
  for (const [key, arr] of slugGroups) {
    const base = key.split('|')[1];
    arr.sort((a, b) => a.t - b.t || a.id - b.id);
    arr.forEach((x, i) => niceSlug.set(x.id, i === 0 ? base : `${base}-${i + 1}`));
  }
  // Final safety guard against any collision with an existing (e.g. admin) program slug.
  const uniqueSlug = async (brandId, base, legacyId) => {
    const c = await pg.query(`SELECT 1 FROM programs WHERE brand_id=$1 AND slug=$2 AND (legacy_id IS NULL OR legacy_id<>$3) LIMIT 1`, [brandId, base, legacyId]);
    return c.rowCount ? `${base}-${legacyId}` : base;
  };
  const now = new Date();
  for (const r of legacyPrograms) {
    if (ignore.has(r.id)) { bump('programs_ignored'); continue; }
    const brandId = brandMap.get(r.program_category_id);
    if (!brandId) { console.warn(`  skip program ${r.id}: no brand`); continue; }
    const year = deriveYear(r.name, r.start_date);
    const start = r.start_date || now;
    const end = r.end_date || start;
    const isPast = new Date(end) < now;
    const slug = await uniqueSlug(brandId, niceSlug.get(r.id) || slugify(r.name), r.id);
    const ins = await pg.query(
      `INSERT INTO programs (brand_id, name, slug, year, start_date, end_date, application_deadline,
         description, theme, banner_url, video_url, essay_guideline_url, usd_in_idr,
         is_published, is_visible_to_users, allow_registration, is_active, status, legacy_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,true,false,$14,$15,$16, now(), now())
       ON CONFLICT (legacy_id) DO UPDATE SET brand_id=EXCLUDED.brand_id, name=EXCLUDED.name, slug=EXCLUDED.slug,
         year=EXCLUDED.year, start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date,
         application_deadline=EXCLUDED.application_deadline, description=EXCLUDED.description, theme=EXCLUDED.theme,
         banner_url=EXCLUDED.banner_url, video_url=EXCLUDED.video_url, essay_guideline_url=EXCLUDED.essay_guideline_url,
         usd_in_idr=EXCLUDED.usd_in_idr, status=EXCLUDED.status, updated_at=now()
       RETURNING id`,
      [brandId, r.name, slug, year, start, end, start, r.description || null, r.theme || null,
       r.banner_url || null, r.registration_video_url || null, r.essay_guideline_url || null,
       r.usd_in_idr ?? null, boolFrom(r.is_active), isPast ? 'completed' : 'published', r.id]);
    programMap.set(r.id, { programId: ins.rows[0].id, brandId, year });
    bump('programs_created');
  }
  const progId = (legacyProgramId) => programMap.get(legacyProgramId)?.programId ?? null;

  // ---------- 4. Per-program content ----------
  for (const r of await mq(`SELECT id,program_id,question,answer,faq_category,order_number,is_active FROM program_faqs WHERE is_deleted=0`)) {
    const pid = progId(r.program_id); if (!pid) continue;
    await pg.query(`INSERT INTO program_faqs (program_id,question,answer,category,"order",is_active,legacy_id,created_at,updated_at)
      VALUES ($1,$2,$3,$4::"FaqCategory",$5,$6,$7,now(),now())
      ON CONFLICT (legacy_id) DO UPDATE SET program_id=EXCLUDED.program_id,question=EXCLUDED.question,answer=EXCLUDED.answer,category=EXCLUDED.category,"order"=EXCLUDED."order",is_active=EXCLUDED.is_active,updated_at=now()`,
      [pid, r.question, r.answer, mapFaqCategory(r.faq_category), r.order_number ?? 0, boolFrom(r.is_active), r.id]);
    bump('faqs');
  }
  for (const r of await mq(`SELECT id,program_id,photo_url,linkedin_url,instagram_url,email,organization,expertise_areas,is_keynote,session_title,session_description,session_time,order_number,name,title,bio,is_active FROM program_speakers WHERE is_deleted=0`)) {
    const pid = progId(r.program_id); if (!pid) continue;
    await pg.query(`INSERT INTO program_speakers (program_id,name,title,organization,bio,photo_url,email,linkedin_url,instagram_url,session_title,session_description,session_time,is_keynote,expertise_areas,"order",is_active,legacy_id,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now())
      ON CONFLICT (legacy_id) DO UPDATE SET program_id=EXCLUDED.program_id,name=EXCLUDED.name,title=EXCLUDED.title,organization=EXCLUDED.organization,bio=EXCLUDED.bio,photo_url=EXCLUDED.photo_url,email=EXCLUDED.email,linkedin_url=EXCLUDED.linkedin_url,instagram_url=EXCLUDED.instagram_url,session_title=EXCLUDED.session_title,session_description=EXCLUDED.session_description,session_time=EXCLUDED.session_time,is_keynote=EXCLUDED.is_keynote,expertise_areas=EXCLUDED.expertise_areas,"order"=EXCLUDED."order",is_active=EXCLUDED.is_active,updated_at=now()`,
      [pid, r.name, r.title || null, r.organization || null, r.bio || null, r.photo_url || null, r.email || null,
       r.linkedin_url || null, r.instagram_url || null, r.session_title || null, r.session_description || null,
       r.session_time || null, boolFrom(r.is_keynote), r.expertise_areas || null, r.order_number ?? 0, boolFrom(r.is_active), r.id]);
    bump('speakers');
  }
  for (const r of await mq(`SELECT id,program_id,title,description,award_type,order_number,is_active FROM program_awards WHERE COALESCE(is_deleted,0)=0`)) {
    const pid = progId(r.program_id); if (!pid) continue;
    await pg.query(`INSERT INTO program_awards (program_id,name,description,tier,"order",is_active,legacy_id,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
      ON CONFLICT (legacy_id) DO UPDATE SET program_id=EXCLUDED.program_id,name=EXCLUDED.name,description=EXCLUDED.description,tier=EXCLUDED.tier,"order"=EXCLUDED."order",is_active=EXCLUDED.is_active,updated_at=now()`,
      [pid, r.title, r.description || null, mapAwardTier(r.award_type), r.order_number ?? 0, r.is_active == null ? true : boolFrom(r.is_active), r.id]);
    bump('awards');
  }
  {
    const annRows = (await mq(`SELECT id,program_id,title,content,img_url,visible_to,slug,meta_title,meta_description,tags,is_active,created_at FROM program_announcements WHERE is_deleted=0`))
      .filter((r) => progId(r.program_id));
    // Legacy announcement slugs are unreliable (mangled — missing leading letters — plus
    // duplicates and nulls). Regenerate from the title with deterministic global uniqueness.
    // Old site is being retired, so there is no legacy URL/SEO continuity to preserve.
    const seen = new Map();
    const annSlug = new Map();
    for (const r of [...annRows].sort((a, b) => a.id - b.id)) {
      const base = slugify(r.title || '') || `announcement-${r.id}`;
      const n = (seen.get(base) || 0) + 1; seen.set(base, n);
      annSlug.set(r.id, n === 1 ? base : `${base}-${n}`);
    }
    for (const r of annRows) {
      const pid = progId(r.program_id);
      await pg.query(`INSERT INTO program_announcements (program_id,title,content,image_url,category,tags,slug,meta_title,meta_description,target_audience,publish_date,is_active,legacy_id,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
        ON CONFLICT (legacy_id) DO UPDATE SET program_id=EXCLUDED.program_id,title=EXCLUDED.title,content=EXCLUDED.content,image_url=EXCLUDED.image_url,category=EXCLUDED.category,tags=EXCLUDED.tags,slug=EXCLUDED.slug,meta_title=EXCLUDED.meta_title,meta_description=EXCLUDED.meta_description,is_active=EXCLUDED.is_active,updated_at=now()`,
        [pid, r.title || '(untitled)', r.content || '', r.img_url || null, 'News', splitTags(r.tags),
         annSlug.get(r.id), r.meta_title || null, r.meta_description || null, 'all', r.created_at || now, boolFrom(r.is_active), r.id]);
      bump('announcements');
    }
  }
  for (const r of await mq(`SELECT id,program_id,name,description,start_date,end_date,order_number,is_active FROM program_schedules WHERE is_deleted=0`)) {
    const pid = progId(r.program_id); if (!pid) continue;
    await pg.query(`INSERT INTO program_schedules (program_id,day,start_time,end_time,activity,description,"order",is_active,legacy_id,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
      ON CONFLICT (legacy_id) DO UPDATE SET program_id=EXCLUDED.program_id,day=EXCLUDED.day,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,activity=EXCLUDED.activity,description=EXCLUDED.description,"order"=EXCLUDED."order",is_active=EXCLUDED.is_active,updated_at=now()`,
      [pid, scheduleDay(r.start_date), hhmm(r.start_date), r.end_date ? hhmm(r.end_date) : null, r.name, r.description || null, r.order_number ?? 0, boolFrom(r.is_active), r.id]);
    bump('schedules');
  }
  for (const r of await mq(`SELECT id,program_id,start_date,end_date,title,description,order_number,is_active FROM program_rundowns WHERE is_deleted=0`)) {
    const pid = progId(r.program_id); if (!pid) continue;
    const anchor = r.id + RUNDOWN_OFFSET;
    await pg.query(`INSERT INTO program_schedules (program_id,day,start_time,end_time,activity,description,"order",is_active,legacy_id,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
      ON CONFLICT (legacy_id) DO UPDATE SET program_id=EXCLUDED.program_id,day=EXCLUDED.day,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,activity=EXCLUDED.activity,description=EXCLUDED.description,"order"=EXCLUDED."order",is_active=EXCLUDED.is_active,updated_at=now()`,
      [pid, r.start_date ? scheduleDay(r.start_date) : 'TBD', r.start_date ? hhmm(r.start_date) : null, r.end_date ? hhmm(r.end_date) : null, r.title || '(untitled)', r.description || null, r.order_number ?? 0, boolFrom(r.is_active), anchor]);
    bump('rundowns');
  }
  for (const r of await mq(`SELECT id,program_id,youtube_url,youtube_video_id,description,display_order,is_active FROM program_video_testimonies WHERE is_deleted=0`)) {
    const pid = progId(r.program_id); if (!pid) continue;
    const anchor = r.id + VIDEO_TESTIMONY_OFFSET;
    await pg.query(`INSERT INTO program_testimonials (program_id,brand_id,name,testimonial,type,category,video_url,thumbnail_url,"order",is_active,legacy_id,created_at,updated_at)
      VALUES ($1,NULL,$2,$3,'video','alumni',$4,$5,$6,$7,$8,now(),now())
      ON CONFLICT (legacy_id) DO UPDATE SET program_id=EXCLUDED.program_id,name=EXCLUDED.name,testimonial=EXCLUDED.testimonial,video_url=EXCLUDED.video_url,thumbnail_url=EXCLUDED.thumbnail_url,"order"=EXCLUDED."order",is_active=EXCLUDED.is_active,updated_at=now()`,
      [pid, videoTestimonialName(r.description), r.description || 'Video testimonial', r.youtube_url, youtubeThumb(r.youtube_video_id), r.display_order ?? 0, boolFrom(r.is_active), anchor]);
    bump('video_testimonials');
  }

  // ---------- 5. Brand-level: text testimonials ----------
  const adminTestiBrands = new Set(
    (await pg.query(`SELECT DISTINCT brand_id FROM program_testimonials WHERE legacy_id IS NULL AND brand_id IS NOT NULL`)).rows.map((x) => x.brand_id));
  for (const r of await mq(`SELECT id,program_category_id,person_name,testimony,occupation,institution,img_url,is_active FROM program_testimonies WHERE is_deleted=0`)) {
    const brandId = r.program_category_id ? brandMap.get(r.program_category_id) ?? null : null;
    if (brandId && adminTestiBrands.has(brandId)) {
      const seen = await pg.query(`SELECT 1 FROM program_testimonials WHERE legacy_id=$1`, [r.id]);
      if (!seen.rowCount) { bump('testimonials_skipped_admin_brand'); continue; }
    }
    await pg.query(`INSERT INTO program_testimonials (program_id,brand_id,name,role,company,testimonial,category,type,avatar_url,is_active,legacy_id,created_at,updated_at)
      VALUES (NULL,$1,$2,$3,$4,$5,'alumni','text',$6,$7,$8,now(),now())
      ON CONFLICT (legacy_id) DO UPDATE SET brand_id=EXCLUDED.brand_id,name=EXCLUDED.name,role=EXCLUDED.role,company=EXCLUDED.company,testimonial=EXCLUDED.testimonial,avatar_url=EXCLUDED.avatar_url,is_active=EXCLUDED.is_active,updated_at=now()`,
      [brandId, r.person_name || 'Anonymous', r.occupation || null, r.institution || null, r.testimony || '', r.img_url || null, boolFrom(r.is_active), r.id]);
    bump('text_testimonials');
  }

  // ---------- 6. History stubs for orphan photo years, then gallery ----------
  const photoGroups = await mq(`SELECT DISTINCT program_category_id, year FROM program_photos WHERE is_deleted=0`);
  const createdByBrandYear = new Set([...programMap.values()].map((r) => `${r.brandId}:${r.year}`));
  for (const g of photoGroups) {
    const brandId = brandMap.get(g.program_category_id);
    if (!brandId) continue;
    const year = g.year ?? 0;
    if (createdByBrandYear.has(`${brandId}:${year}`)) continue;
    const synthetic = PHOTO_HISTORY_BASE + g.program_category_id * 10000 + year;
    const ex = await pg.query(`SELECT id, legacy_id FROM programs WHERE brand_id=$1 AND year=$2 LIMIT 1`, [brandId, year]);
    if (ex.rowCount && ex.rows[0].legacy_id !== synthetic) { bump('photo_years_left_to_admin'); continue; }
    const bn = (await pg.query(`SELECT name FROM brands WHERE id=$1`, [brandId])).rows[0]?.name || 'Program';
    const label = year ? `${bn} ${year}` : `${bn} (Archive)`;
    const slug = await uniqueSlug(brandId, slugify(label), synthetic);
    const jan1 = new Date(Date.UTC(year || 1970, 0, 1));
    const ins = await pg.query(
      `INSERT INTO programs (brand_id,name,slug,year,start_date,end_date,application_deadline,is_published,is_visible_to_users,allow_registration,is_active,status,legacy_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5::date,$5::date,$5::timestamptz,true,true,false,false,'completed',$6,now(),now())
       ON CONFLICT (legacy_id) DO UPDATE SET updated_at=now() RETURNING id`,
      [brandId, label, slug, year, jan1, synthetic]);
    programMap.set(synthetic, { programId: ins.rows[0].id, brandId, year });
    bump('history_stubs');
  }
  // rebuild (brand,year)->programId including stubs
  const byBrandYear = new Map();
  for (const [legacyId, ref] of programMap.entries()) {
    const key = `${ref.brandId}:${ref.year}`;
    const cur = byBrandYear.get(key);
    if (!cur || legacyId < cur.legacyId) byBrandYear.set(key, { programId: ref.programId, legacyId });
  }
  for (const r of await mq(`SELECT id,program_category_id,title,year,description,img_url,is_active FROM program_photos WHERE is_deleted=0`)) {
    const brandId = brandMap.get(r.program_category_id);
    if (!brandId || !r.img_url) { if (!r.img_url) bump('photos_no_url'); continue; }
    const target = byBrandYear.get(`${brandId}:${r.year ?? 0}`);
    if (!target) { bump('photos_skipped_no_program'); continue; }
    await pg.query(`INSERT INTO program_gallery (program_id,image_url,title,description,year,type,"order",is_active,legacy_id,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,'image',$6,$7,$8,now(),now())
      ON CONFLICT (legacy_id) DO UPDATE SET program_id=EXCLUDED.program_id,image_url=EXCLUDED.image_url,title=EXCLUDED.title,description=EXCLUDED.description,year=EXCLUDED.year,"order"=EXCLUDED."order",is_active=EXCLUDED.is_active,updated_at=now()`,
      [target.programId, r.img_url, r.title || null, r.description || null, r.year ?? null, r.id, boolFrom(r.is_active), r.id]);
    bump('gallery');
  }

  console.log('\n=== Phase A summary ===');
  for (const k of Object.keys(counts).sort()) console.log(`  ${k}: ${counts[k]}`);
  await my.end();
  await pg.end();
}

main().catch((e) => { console.error('MIGRATION FAILED:', e); process.exit(1); });
