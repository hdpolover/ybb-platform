// services/hub/app.js
// Pure helpers are exported for `node --test`; the DOM code only runs in a browser.
'use strict';

// What the participant is heading to, finishing "Choose your program to ...".
const PORTAL_PATHS = {
  '/dashboard': 'open your dashboard',
  '/dashboard/documents': 'open your documents',
  '/dashboard/payments': 'open your payments',
  '/dashboard/submission': 'open your submission',
  '/dashboard/progress': 'see your progress',
  '/dashboard/settings': 'open your settings',
  '/login': 'sign in',
};

// Returns an https origin without trailing slash, or null if unusable.
// http is upgraded: forwarded query strings can carry tokens.
function normalizeWebsiteUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim();
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password || !u.hostname.includes('.')) return null;
    return 'https://' + u.host;
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

// "Vietnam Youth Summit" -> "VYS", matching how the programs abbreviate themselves.
function initials(name) {
  const letters = String(name || '').split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0].toUpperCase());
  return letters.join('') || '?';
}

// Active, not deleted, has a usable website -> card models, sorted by name.
function toCards(brands) {
  if (!Array.isArray(brands)) return [];
  return brands
    .filter((b) => b && b.isActive && !b.deletedAt)
    .map((b) => {
      const base = normalizeWebsiteUrl(b.websiteUrl);
      return {
        id: b.id,
        name: String(b.name || '').trim(),
        base,
        host: base ? new URL(base).hostname.replace(/^www\./, '') : null,
        logo: hasRealLogo(b.logoUrl) ? b.logoUrl : null,
        color: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(b.primaryColor || '') ? b.primaryColor : null,
      };
    })
    .filter((c) => c.base && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function describePath(pathname) {
  const key = (pathname || '/').replace(/\/+$/, '') || '/';
  if (key === '/') return null;
  return PORTAL_PATHS[key] || 'continue where you left off';
}

// Logo width as % of a 4:3 stage so every logo covers about the same area:
// wide lockups get wide, square emblems stay compact, nothing touches the edges.
const LOGO_AREA = 0.3;
const LOGO_MAX_W = 0.84;
const LOGO_MAX_H = 0.7;
function logoWidth(ratio) {
  if (!(ratio > 0) || !isFinite(ratio)) return 50;
  const toH = 4 / (3 * ratio); // height fraction per width fraction on a 4:3 stage
  const w = Math.min(Math.sqrt(LOGO_AREA / toH), LOGO_MAX_W, LOGO_MAX_H / toH);
  return Math.round(w * 1000) / 10;
}

// Black or white text, whichever reads better on the badge colour.
function textOn(hex) {
  const h = hex.slice(1);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#14171f' : '#ffffff';
}

if (typeof module !== 'undefined') {
  module.exports = { normalizeWebsiteUrl, buildTargetUrl, hasRealLogo, toCards, describePath, initials, textOn, logoWidth };
}

if (typeof document !== 'undefined') {
  const out = document.getElementById('out');
  const status = document.getElementById('status');
  const skeleton = out.firstElementChild.cloneNode(true);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };

  // Logo-less (or broken-logo) programs get a typographic seal, not an error box.
  const monogram = (card) => {
    const m = el('span', 'monogram', initials(card.name));
    // Dark brand colours read on the light stage; light ones only tint the ring.
    if (card.color && textOn(card.color) === '#ffffff') m.style.setProperty('color', card.color);
    return m;
  };

  const renderCard = (card) => {
    const a = el('a', 'card');
    a.href = buildTargetUrl(card.base, location);
    if (card.color) a.style.setProperty('--brand', card.color);
    const stage = el('span', 'stage');
    stage.setAttribute('aria-hidden', 'true');
    if (card.logo) {
      const img = el('img');
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('load', () => {
        img.style.width = logoWidth(img.naturalWidth / img.naturalHeight) + '%';
        img.classList.add('is-ready');
      }, { once: true });
      img.addEventListener('error', () => img.replaceWith(monogram(card)), { once: true });
      img.src = card.logo;
      stage.append(img);
    } else {
      stage.append(monogram(card));
    }
    const meta = el('span', 'meta');
    const host = el('span', 'host');
    // Let long domains wrap before a dot ("middleeastyouthsummit" / ".com"), not mid-word.
    host.append(...card.host.split(/(?=\.)/).flatMap((part, i) => (i ? [el('wbr'), part] : [part])));
    meta.append(el('span', 'name', card.name), host);
    a.append(stage, meta);
    const li = el('li');
    li.append(a);
    return li;
  };

  const showError = (fromRetry) => {
    const box = el('div', 'notice');
    box.setAttribute('role', 'alert');
    box.append(el('p', 'notice-title', 'We could not load the programs.'));
    box.append(el('p', null, 'Check your connection and try again.'));
    const actions = el('div', 'actions');
    const retry = el('button', 'btn', 'Try again');
    retry.type = 'button';
    retry.addEventListener('click', () => load(true));
    const home = el('a', 'link', 'Go to youthbreaktheboundaries.com');
    home.href = 'https://youthbreaktheboundaries.com';
    actions.append(retry, home);
    box.append(actions);
    out.replaceChildren(box);
    status.textContent = '';
    // The retry button was just removed by the reload; give focus back to its replacement.
    if (fromRetry) retry.focus({ preventScroll: true });
  };

  function load(fromRetry) {
    out.replaceChildren(skeleton.cloneNode(true));
    status.textContent = 'Loading programs';
    fetch('/api/brands', { headers: { accept: 'application/json' }, cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((body) => {
        const cards = toCards(body && body.data);
        if (!cards.length) throw new Error('no brands');
        const ul = el('ul', 'grid');
        ul.setAttribute('aria-label', 'Programs');
        ul.append(...cards.map(renderCard));
        out.replaceChildren(ul);
        status.textContent = cards.length + ' programs';
      })
      .catch(() => showError(fromRetry === true));
  }

  const what = describePath(location.pathname);
  if (what) document.getElementById('sub').textContent = 'Choose your program to ' + what + '.';
  load();
}
