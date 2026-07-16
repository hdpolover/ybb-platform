/* eslint-disable */
/**
 * Legacy asset re-homing (Phase B) — raw SQL.
 * Downloads every storage.ybbfoundation.com asset referenced in the (scratch) DB,
 * re-uploads it to the file service, and rewrites the stored URL. Idempotent: rows
 * whose URL no longer points at the legacy host are skipped.
 * Dry runs set ASSET_BUCKET_PREFIX=dryrun- to isolate uploads; MAX_PER_SET caps rows for smoke tests.
 */
const { Pool } = require('pg');
const axios = require('axios');
const FormData = require('form-data');

const LEGACY_HOST = 'storage.ybbfoundation.com';
const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL;
const KEY = process.env.FILE_SERVICE_INTERNAL_KEY || process.env.INTERNAL_SERVICE_KEY || '';
const PREFIX = process.env.ASSET_BUCKET_PREFIX || '';
const MAX = process.env.MAX_PER_SET ? Number(process.env.MAX_PER_SET) : Infinity;
const pg = new Pool({ connectionString: process.env.DATABASE_URL });
const cache = {};
let sysUser = null;

async function getSysUser() {
  if (sysUser) return sysUser;
  const e = process.env.SYSTEM_USER_ID;
  if (e) { const u = await pg.query('SELECT id FROM users WHERE id=$1', [e]); if (!u.rowCount) throw new Error('SYSTEM_USER_ID not found'); sysUser = e; return e; }
  const u = await pg.query('SELECT id FROM users LIMIT 1'); sysUser = u.rows[0].id; return sysUser;
}
async function rehome(url, brandId, bucket) {
  if (cache[url]) return cache[url];
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  const buf = Buffer.from(resp.data);
  const filename = url.split('/').pop() || 'asset';
  const ct = resp.headers['content-type'] || 'application/octet-stream';
  const form = new FormData();
  form.append('file', buf, { filename, contentType: ct });
  form.append('user_id', await getSysUser());
  form.append('brand_id', brandId);
  form.append('bucket', PREFIX + bucket);
  const up = await axios.post(`${FILE_SERVICE_URL}/api/v1/files/upload`, form, {
    headers: { ...form.getHeaders(), 'x-internal-service-key': KEY },
    maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 60000,
  });
  const nu = up.data && up.data.file && (up.data.file.url || up.data.file.download_url);
  if (!nu) throw new Error('upload returned no url: ' + JSON.stringify(up.data).slice(0, 200));
  cache[url] = nu;
  return nu;
}
async function processSet(label, selectSql, updateSql, bucket) {
  let rows = (await pg.query(selectSql)).rows;
  if (rows.length > MAX) rows = rows.slice(0, MAX);
  let ok = 0, fail = 0;
  for (const r of rows) {
    try { const nu = await rehome(r.url, r.brand_id, bucket); await pg.query(updateSql, [nu, r.id]); ok++; }
    catch (e) { fail++; console.warn(`  ${label} ${r.id} FAIL: ${(e.response && e.response.status) || ''} ${e.message}`); }
  }
  console.log(`${label}: ${ok} ok, ${fail} fail (of ${rows.length})`);
}
(async () => {
  if (!KEY) throw new Error('FILE_SERVICE_INTERNAL_KEY missing');
  const L = `%${LEGACY_HOST}%`;
  await processSet('brand.logo', `SELECT id, logo_url url, id brand_id FROM brands WHERE logo_url LIKE '${L}'`, `UPDATE brands SET logo_url=$1, updated_at=now() WHERE id=$2`, 'brand');
  await processSet('brand.banner', `SELECT id, banner_url url, id brand_id FROM brands WHERE banner_url LIKE '${L}'`, `UPDATE brands SET banner_url=$1, updated_at=now() WHERE id=$2`, 'brand');
  await processSet('program.banner', `SELECT id, banner_url url, brand_id FROM programs WHERE banner_url LIKE '${L}'`, `UPDATE programs SET banner_url=$1, updated_at=now() WHERE id=$2`, 'program');
  await processSet('gallery', `SELECT g.id, g.image_url url, p.brand_id FROM program_gallery g JOIN programs p ON p.id=g.program_id WHERE g.image_url LIKE '${L}'`, `UPDATE program_gallery SET image_url=$1, updated_at=now() WHERE id=$2`, 'gallery');
  await processSet('speaker', `SELECT s.id, s.photo_url url, p.brand_id FROM program_speakers s JOIN programs p ON p.id=s.program_id WHERE s.photo_url LIKE '${L}'`, `UPDATE program_speakers SET photo_url=$1, updated_at=now() WHERE id=$2`, 'speaker');
  await processSet('announcement', `SELECT a.id, a.image_url url, p.brand_id FROM program_announcements a JOIN programs p ON p.id=a.program_id WHERE a.image_url LIKE '${L}'`, `UPDATE program_announcements SET image_url=$1, updated_at=now() WHERE id=$2`, 'announcement');
  await processSet('testimonial', `SELECT id, avatar_url url, brand_id FROM program_testimonials WHERE avatar_url LIKE '${L}' AND brand_id IS NOT NULL`, `UPDATE program_testimonials SET avatar_url=$1, updated_at=now() WHERE id=$2`, 'testimonial');
  await pg.end();
  console.log('Phase B done');
})().catch((e) => { console.error('REHOME FAILED:', e); process.exit(1); });
