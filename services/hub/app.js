// services/hub/app.js
// Pure helpers are exported for `node --test`; the DOM code only runs in a browser.
'use strict';

const PORTAL_PATHS = {
  '/dashboard': 'your dashboard',
  '/dashboard/documents': 'your documents',
  '/dashboard/payments': 'your payments',
  '/dashboard/submission': 'your submission',
  '/login': 'login',
};

// Returns an http(s) origin without trailing slash, or null if unusable.
function normalizeWebsiteUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim();
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch (_) {
    return null;
  }
}

// Only the path/query/hash of the current location survive; the host always comes from brandBase.
function buildTargetUrl(brandBase, loc) {
  const u = new URL(new URL(brandBase).origin);
  // Collapse leading slashes/backslashes so "//evil.com" is a path, never a host.
  u.pathname = String(loc.pathname || '/').replace(/^[/\\]+/, '/');
  u.search = loc.search || '';
  u.hash = loc.hash || '';
  return u.href;
}

function hasRealLogo(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname !== 'placehold.co';
  } catch (_) {
    return false;
  }
}

function initials(name) {
  const letters = String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase());
  return letters.join('') || '?';
}

// Active, not deleted, has a usable website -> card models, sorted by name.
function toCards(brands) {
  if (!Array.isArray(brands)) return [];
  return brands
    .filter((b) => b && b.isActive && !b.deletedAt)
    .map((b) => ({
      id: b.id,
      name: String(b.name || '').trim(),
      base: normalizeWebsiteUrl(b.websiteUrl),
      logo: hasRealLogo(b.logoUrl) ? b.logoUrl : null,
      color: /^#[0-9a-f]{3,8}$/i.test(b.primaryColor || '') ? b.primaryColor : null,
    }))
    .filter((c) => c.base && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function describePath(pathname) {
  const key = (pathname || '/').replace(/\/+$/, '') || '/';
  if (key === '/') return null;
  return PORTAL_PATHS[key] || 'where you left off';
}

// Black or white text, whichever reads better on the badge colour.
function textOn(hex) {
  const h = hex.slice(1);
  const full = h.length < 6 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#14171f' : '#ffffff';
}

if (typeof module !== 'undefined') {
  module.exports = { normalizeWebsiteUrl, buildTargetUrl, hasRealLogo, toCards, describePath, initials };
}

if (typeof document !== 'undefined') {
  const out = document.getElementById('out');
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };

  const badge = (card) => {
    const b = el('div', 'badge', initials(card.name));
    b.style.setProperty('background', card.color || 'var(--gray-badge)');
    b.style.setProperty('color', card.color ? textOn(card.color) : '#ffffff');
    return b;
  };

  const renderCard = (card) => {
    const li = el('li');
    const a = el('a', 'card');
    a.href = buildTargetUrl(card.base, location);
    a.rel = 'noopener';
    const tile = el('div', 'tile');
    if (card.logo) {
      const img = el('img');
      img.src = card.logo;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => img.replaceWith(badge(card)), { once: true });
      tile.append(img);
    } else {
      tile.append(badge(card));
    }
    a.append(tile, el('span', 'name', card.name));
    li.append(a);
    return li;
  };

  const showError = () => {
    const box = el('div', 'notice');
    box.append(el('p', null, 'We could not load the program list right now.'));
    const link = el('a', 'link', 'Go to youthbreaktheboundaries.com');
    link.href = 'https://youthbreaktheboundaries.com';
    box.append(link);
    out.replaceChildren(box);
    out.setAttribute('aria-busy', 'false');
  };

  const what = describePath(location.pathname);
  if (what) {
    document.getElementById('sub').textContent =
      'Pick your program and we will take you to its portal to continue to ' + what + '.';
  }

  fetch('/api/brands', { headers: { accept: 'application/json' } })
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then((body) => {
      const cards = toCards(body && body.data);
      if (!cards.length) throw new Error('no brands');
      const ul = el('ul', 'grid');
      ul.append(...cards.map(renderCard));
      out.replaceChildren(ul);
      out.setAttribute('aria-busy', 'false');
    })
    .catch(showError);
}
