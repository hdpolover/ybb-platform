// services/hub/app.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { normalizeWebsiteUrl, buildTargetUrl, hasRealLogo, toCards, describePath } =
  createRequire(import.meta.url)('./app.js');

const loc = (pathname, search = '', hash = '') => ({ pathname, search, hash });

test('passes path and query through to the brand host', () => {
  assert.equal(
    buildTargetUrl('https://istanbulyouthsummit.com', loc('/dashboard/documents', '?x=1')),
    'https://istanbulyouthsummit.com/dashboard/documents?x=1',
  );
});

test('root path links to the brand root, hash is kept', () => {
  assert.equal(buildTargetUrl('https://a.com', loc('/')), 'https://a.com/');
  assert.equal(buildTargetUrl('https://a.com', loc('/p', '', '#top')), 'https://a.com/p#top');
});

test('pathname //evil.com cannot change the target host', () => {
  for (const p of ['//evil.com', '///evil.com/x', '/\\evil.com']) {
    const u = new URL(buildTargetUrl('https://istanbulyouthsummit.com', loc(p, '?a=b')));
    assert.equal(u.host, 'istanbulyouthsummit.com', p);
    assert.equal(u.search, '?a=b');
  }
});

test('brand base path is ignored, only origin is used', () => {
  assert.equal(buildTargetUrl('https://a.com/en/', loc('/login')), 'https://a.com/login');
});

test('prepends https:// to a scheme-less websiteUrl', () => {
  assert.equal(normalizeWebsiteUrl('koreayouthsummit.com'), 'https://koreayouthsummit.com');
});

test('strips trailing slash and keeps explicit scheme', () => {
  assert.equal(normalizeWebsiteUrl('https://a.com/'), 'https://a.com');
  assert.equal(normalizeWebsiteUrl('http://a.com'), 'http://a.com');
});

test('rejects empty, null and non-http websiteUrl values', () => {
  for (const v of [null, undefined, '', '   ', 'javascript:alert(1)', 'ftp://a.com']) {
    assert.equal(normalizeWebsiteUrl(v), null, String(v));
  }
});

test('filters out inactive, deleted and no-website brands, sorted by name', () => {
  const ok = { isActive: true, deletedAt: null, logoUrl: null, primaryColor: null };
  const cards = toCards([
    { ...ok, id: '1', name: 'Zeta Summit', websiteUrl: 'zeta.com' },
    { ...ok, id: '2', name: 'Alpha Summit', websiteUrl: 'https://alpha.com/' },
    { ...ok, id: '3', name: 'Inactive', websiteUrl: 'i.com', isActive: false },
    { ...ok, id: '4', name: 'Deleted', websiteUrl: 'd.com', deletedAt: '2026-01-01' },
    { ...ok, id: '5', name: 'No site', websiteUrl: null },
    { ...ok, id: '6', name: 'Blank site', websiteUrl: '' },
  ]);
  assert.deepEqual(cards.map((c) => c.name), ['Alpha Summit', 'Zeta Summit']);
  assert.deepEqual(cards.map((c) => c.base), ['https://alpha.com', 'https://zeta.com']);
});

test('placeholder, missing or invalid logo gives a text card', () => {
  assert.equal(hasRealLogo('https://placehold.co/100x100/E62C4F/FFF?text=CYS'), false);
  assert.equal(hasRealLogo(null), false);
  assert.equal(hasRealLogo(''), false);
  assert.equal(hasRealLogo('not a url'), false);
  assert.equal(hasRealLogo('https://cdn.ybbhub.com/prod/x/logo.png'), true);
  const [c] = toCards([{ id: '1', name: 'A', isActive: true, websiteUrl: 'a.com', logoUrl: 'https://placehold.co/1x1', primaryColor: 'red' }]);
  assert.equal(c.logo, null);
  assert.equal(c.color, null);
});

test('describePath maps known portal paths, generic otherwise, null at root', () => {
  assert.equal(describePath('/'), null);
  assert.equal(describePath('/dashboard/documents'), 'your documents');
  assert.equal(describePath('/dashboard/documents/'), 'your documents');
  assert.equal(describePath('/something/else'), 'where you left off');
});
