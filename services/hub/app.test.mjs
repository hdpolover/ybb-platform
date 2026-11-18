// services/hub/app.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { normalizeWebsiteUrl, buildTargetUrl, hasRealLogo, toCards, describePath, initials, logoWidth } =
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

test('no pathname, query or hash can change the target host or scheme', () => {
  const paths = ['//evil.com', '///evil.com/x', '/\\evil.com', '\\\\evil.com', '/@evil.com', '/%2F%2Fevil.com',
    'evil.com', 'https://evil.com', '/https://evil.com', '/..//evil.com', '/\t//evil.com', ''];
  for (const p of paths) {
    for (const [search, hash] of [['?a=b', ''], ['?next=//evil.com', '#//evil.com'], ['?@evil.com', '#@evil.com']]) {
      const u = new URL(buildTargetUrl('https://istanbulyouthsummit.com', loc(p, search, hash)));
      assert.equal(u.origin, 'https://istanbulyouthsummit.com', JSON.stringify([p, search, hash]));
      assert.equal(u.search, search);
    }
  }
});

test('brand base path is ignored, only origin is used', () => {
  assert.equal(buildTargetUrl('https://a.com/en/', loc('/login')), 'https://a.com/login');
});

test('prepends https:// to a scheme-less websiteUrl', () => {
  assert.equal(normalizeWebsiteUrl('koreayouthsummit.com'), 'https://koreayouthsummit.com');
});

test('strips path and trailing slash, upgrades http to https', () => {
  assert.equal(normalizeWebsiteUrl('https://a.com/'), 'https://a.com');
  assert.equal(normalizeWebsiteUrl('https://a.com/en/home'), 'https://a.com');
  assert.equal(normalizeWebsiteUrl('http://a.com'), 'https://a.com');
  assert.equal(normalizeWebsiteUrl(' WWW.A.COM '), 'https://www.a.com');
});

test('rejects empty, null and non-http websiteUrl values', () => {
  for (const v of [null, undefined, '', '   ', 'javascript:alert(1)', 'ftp://a.com', 'data:text/html,x',
    'https://user:pw@a.com', 'localhost', 'not a url', 42]) {
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
  assert.equal(describePath('/dashboard/documents'), 'open your documents');
  assert.equal(describePath('/dashboard/documents/'), 'open your documents');
  assert.equal(describePath('/login'), 'sign in');
  assert.equal(describePath('/something/else'), 'continue where you left off');
});

test('cards carry a display host and only 3- or 6-digit hex colours', () => {
  const base = { id: '1', name: 'A', isActive: true, logoUrl: null };
  const [a] = toCards([{ ...base, websiteUrl: 'https://www.a.com/x', primaryColor: '#FA0000' }]);
  assert.equal(a.host, 'a.com');
  assert.equal(a.color, '#FA0000');
  for (const c of ['#FA000080', 'red', 'url(x)', '#12', null]) {
    assert.equal(toCards([{ ...base, websiteUrl: 'a.com', primaryColor: c }])[0].color, null, String(c));
  }
});

test('initials give the programme abbreviation', () => {
  assert.equal(initials('Vietnam Youth Summit'), 'VYS');
  assert.equal(initials('  world youth   fest '), 'WYF');
  assert.equal(initials(''), '?');
});

test('logoWidth gives wide and square logos the same area inside the stage', () => {
  const area = (r) => { const w = logoWidth(r) / 100; return w * (w * 4) / (3 * r); };
  assert.ok(Math.abs(area(1) - area(2.5)) < 0.01);
  assert.ok(logoWidth(2.5) > logoWidth(1));
  for (const r of [0.2, 0.9, 1, 2.2, 10]) {
    const w = logoWidth(r) / 100;
    assert.ok(w <= 0.84 && (w * 4) / (3 * r) <= 0.7001, String(r));
  }
  for (const r of [0, NaN, Infinity, -1]) assert.equal(logoWidth(r), 50);
});
