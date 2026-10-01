/* ============ PULSE SIGNALS — app.js (mock data, no dependencies) ============ */
'use strict';

/* ---------- Helpers ---------- */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const fmt = (n, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
function seededRand(seed) { let a = seed; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const seedFrom = str => [...str].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }

/* ---------- Mock market data ---------- */
const MARKETS = [
  { symbol: 'BTC',   name: 'Bitcoin',       emoji: '₿',    type: 'crypto', price: 67240.50, dec: 0, conf: 78, dir: 1  },
  { symbol: 'ETH',   name: 'Ethereum',      emoji: 'Ξ',    type: 'crypto', price: 3542.18,  dec: 2, conf: 72, dir: 1  },
  { symbol: 'SOL',   name: 'Solana',        emoji: '◎',    type: 'crypto', price: 158.42,   dec: 2, conf: 65, dir: -1 },
  { symbol: 'BNB',   name: 'BNB',           emoji: '🔶',  type: 'crypto', price: 592.10,   dec: 2, conf: 61, dir: 1  },
  { symbol: 'XRP',   name: 'Ripple',        emoji: '✕',    type: 'crypto', price: 0.6142,   dec: 4, conf: 58, dir: -1 },
  { symbol: 'DOGE',  name: 'Dogecoin',      emoji: '🐶',  type: 'crypto', price: 0.1623,   dec: 4, conf: 54, dir: 1  },
  { symbol: 'AAPL',  name: 'Apple Inc.',    emoji: '🍎',  type: 'stock',  price: 232.90,   dec: 2, conf: 74, dir: 1  },
  { symbol: 'TSLA',  name: 'Tesla Inc.',    emoji: '⚡',  type: 'stock',  price: 248.50,   dec: 2, conf: 69, dir: -1 },
  { symbol: 'NVDA',  name: 'NVIDIA Corp.',  emoji: '🟢',  type: 'stock',  price: 131.90,   dec: 2, conf: 81, dir: 1  },
  { symbol: 'AMZN',  name: 'Amazon.com',    emoji: '📦',  type: 'stock',  price: 197.15,   dec: 2, conf: 66, dir: 1  },
  { symbol: 'MSFT',  name: 'Microsoft',     emoji: '🪟',  type: 'stock',  price: 428.30,   dec: 2, conf: 70, dir: 1  },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', emoji: '🔍',  type: 'stock',  price: 176.40,   dec: 2, conf: 63, dir: -1 },
];

/* enrich with change %, sparkline, predicted range */
MARKETS.forEach(m => {
  const r = seededRand(seedFrom(m.symbol));
  m.change = +( (r() - 0.42) * 4 ).toFixed(2);                       // -1.7% .. +2.3%
  m.spark = Array.from({ length: 14 }, () => 0.5 + (r() - 0.5) * 0.9); // 0..1
  const band = (m.conf / 100) * 0.055 + 0.012;                        // range width by confidence
  m.predHigh = m.price * (1 + band * (m.dir > 0 ? 1 : 0.55));
  m.predLow  = m.price * (1 - band * (m.dir > 0 ? 0.55 : 1));
  if (m.predLow > m.price)  m.predLow  = m.price * 0.995;
  if (m.predHigh < m.price) m.predHigh = m.price * 1.005;
});

/* ---------- State ---------- */
const settings = Object.assign(
  { theme: 'dark', markets: 'both', delay: 10, plan: 'Free' },
  JSON.parse(localStorage.getItem('pulse.settings') || '{}')
);
let uiFilter = 'all';
let currentDetail = null;

function saveSettings() { localStorage.setItem('pulse.settings', JSON.stringify(settings)); }

/* ---------- SVG builders ---------- */
function sparkSVG(points, up) {
  const w = 74, h = 26, min = Math.min(...points), max = Math.max(...points), span = (max - min) || 1;
  const pts = points.map((p, i) => `${(i / (points.length - 1) * w).toFixed(1)},${(h - 3 - (p - min) / span * (h - 6)).toFixed(1)}`).join(' ');
  const color = up ? 'var(--up)' : 'var(--down)';
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/></svg>`;
}

function chartSVG(symbol, tf) {
  const r = seededRand(seedFrom(symbol + tf));
  const n = tf === '24H' ? 40 : tf === '7D' ? 42 : 45;
  let v = 50; const data = [];
  for (let i = 0; i < n; i++) { v += (r() - 0.48) * 9; v = Math.max(12, Math.min(88, v)); data.push(v); }
  const min = Math.min(...data), max = Math.max(...data), span = (max - min) || 1;
  const pts = data.map((p, i) => `${(i / (n - 1) * 320).toFixed(1)},${(135 - (p - min) / span * 118 - 4).toFixed(1)}`);
  const line = pts.join(' ');
  const gid = 'cg' + seedFrom(symbol + tf);
  const last = pts[pts.length - 1].split(',');
  return `
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8b5cf6" stop-opacity=".45"/>
      <stop offset="1" stop-color="#06b6d4" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="confGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/><stop offset=".55" stop-color="#3b82f6"/><stop offset="1" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <polygon points="0,140 ${line} 320,140" fill="url(#${gid})"/>
  <polyline points="${line}" fill="none" stroke="url(#confGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#22d3ee" stroke="#fff" stroke-width="1.5"/>`;
}

/* ---------- Renderers ---------- */
function marketCardHTML(m) {
  const up = m.change >= 0;
  return `
  <article class="mkt-card glass-strong" data-symbol="${m.symbol}">
    <div class="mkt-icon">${m.emoji}</div>
    <div class="mkt-main">
      <div class="mkt-sym">${m.symbol}<span style="font-size:9.5px;font-weight:700;color:var(--text-dim);background:var(--card);border:1px solid var(--border);padding:2px 6px;border-radius:6px;">${m.type === 'crypto' ? 'CRYPTO' : 'STOCK'}</span></div>
      <div class="mkt-name">${m.name}</div>
      <div class="mkt-pred"><span>H <b class="up">${fmt(m.predHigh, m.dec)}</b></span><span>L <b class="down">${fmt(m.predLow, m.dec)}</b></span></div>
    </div>
    <div class="mkt-right">
      <div class="mkt-price js-price" data-symbol="${m.symbol}">$${fmt(m.price, m.dec)}</div>
      <div class="mkt-change ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(m.change).toFixed(2)}%</div>
      ${sparkSVG(m.spark, up)}
      <div class="mkt-conf"><div class="conf-track"><div class="conf-fill" style="width:${m.conf}%"></div></div><div class="conf-label">${m.conf}% confidence</div></div>
    </div>
  </article>`;
}

function renderHome() {
  const q = $('#searchInput').value.trim().toUpperCase();
  const typeFilter = uiFilter !== 'all' ? uiFilter : (settings.markets === 'both' ? 'all' : settings.markets);
  const list = MARKETS.filter(m =>
    (typeFilter === 'all' || m.type === typeFilter) &&
    (!q || m.symbol.includes(q) || m.name.toUpperCase().includes(q))
  );
  $('#homeList').innerHTML = list.length
    ? list.map(marketCardHTML).join('')
    : `<div class="glass" style="padding:28px;text-align:center;color:var(--text-dim);font-size:14px;border-radius:16px;">No markets found for “${q}”</div>`;
}

function renderSignals() {
  const sorted = [...MARKETS].sort((a, b) => b.conf - a.conf);
  $('#signalList').innerHTML = sorted.map(m => `
    <article class="sig-card glass-strong" data-symbol="${m.symbol}">
      <span class="sig-badge ${m.dir > 0 ? 'long' : 'short'}">${m.dir > 0 ? 'LONG' : 'SHORT'}</span>
      <div class="sig-main">
        <div class="sig-sym">${m.emoji} ${m.symbol} <span style="color:var(--text-dim);font-weight:600;font-size:12px;">· ${m.name}</span></div>
        <div class="sig-meta">Entry ~$${fmt(m.price, m.dec)} · Target $${fmt(m.predHigh, m.dec)} · ${settings.delay}m delay</div>
      </div>
      <span class="sig-conf">${m.conf}%</span>
    </article>`).join('');
}

/* ---------- Detail view ---------- */
function openDetail(symbol) {
  const m = MARKETS.find(x => x.symbol === symbol);
  if (!m) return;
  currentDetail = m;
  const up = m.dir > 0;
  $('#dEmoji').textContent = m.emoji;
  $('#dSymbol').textContent = m.symbol;
  $('#dName').textContent = `${m.name} · ${m.type === 'crypto' ? 'Crypto' : 'Stock'}`;
  const badge = $('#dBadge');
  badge.textContent = up ? 'LONG' : 'SHORT';
  badge.className = 'badge ' + (up ? 'long' : 'short');
  $('#dPrice').textContent = '$' + fmt(m.price, m.dec);
  const chEl = $('#dChange');
  chEl.textContent = `${m.change >= 0 ? '▲' : '▼'} ${Math.abs(m.change).toFixed(2)}% today`;
  chEl.className = 'price-hero-change ' + (m.change >= 0 ? 'up' : 'down');
  $('#dDelayTag').textContent = `· ${settings.delay}m delayed`;
  $('#dHigh').textContent = '$' + fmt(m.predHigh, m.dec);
  $('#dLow').textContent = '$' + fmt(m.predLow, m.dec);
  /* range bar: fill between low & high relative to a 2.5% outer band */
  const mid = m.price, half = (m.predHigh - m.predLow) / 2, outer = mid * 0.0125 + half;
  const lo = mid - outer, span = outer * 2;
  $('#dRangeFill').style.left = ((m.predLow - lo) / span * 100) + '%';
  $('#dRangeFill').style.width = ((m.predHigh - m.predLow) / span * 100) + '%';
  $('#dRangeMarker').style.left = ((mid - lo) / span * 100) + '%';
  /* confidence ring */
  const ring = $('#confRing');
  ring.style.strokeDashoffset = (326.7 * (1 - m.conf / 100)).toFixed(1);
  $('#dConf').textContent = m.conf;
  $('#dConfText').textContent =
    m.conf >= 75 ? 'Strong signal quality based on recent volatility and trend alignment.' :
    m.conf >= 62 ? 'Moderate signal quality. Expect wider variance around the predicted range.' :
                   'Lower confidence — treat this range as a rough guide only.';
  /* chart */
  setTimeframe('24H');
  $('#dTf').textContent = '24H';
  $('#dDelay').textContent = settings.delay + ' minutes';
  $('#dType').textContent = up ? 'Long bias' : 'Short bias';
  $('#dUpdated').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ` (−${settings.delay}m)`;
  $('#detailView').classList.remove('hidden');
  $('#detailView').scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function setTimeframe(tf) {
  if (!currentDetail) return;
  $$('#tfSeg button').forEach(b => b.classList.toggle('active', b.dataset.tf === tf));
  $('#chartSvg').innerHTML = chartSVG(currentDetail.symbol, tf);
  $('#dTfNote').textContent = `Last ${tf.toLowerCase()} · delayed by ${settings.delay} min`;
}

function closeDetail() {
  $('#detailView').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ---------- Navigation ---------- */
function showView(name) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + name).classList.add('active');
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'signals') renderSignals();
  window.scrollTo(0, 0);
}

/* ---------- Live price drift (mock feed) ---------- */
function startFeed() {
  setInterval(() => {
    MARKETS.forEach(m => {
      m.price *= 1 + (Math.random() - 0.5) * 0.0028;
      m.price = +m.price.toFixed(m.dec);
    });
    $$('.js-price').forEach(el => {
      const m = MARKETS.find(x => x.symbol === el.dataset.symbol);
      if (m) el.textContent = '$' + fmt(m.price, m.dec);
    });
    if (currentDetail && !$('#detailView').classList.contains('hidden')) {
      $('#dPrice').textContent = '$' + fmt(currentDetail.price, currentDetail.dec);
    }
  }, 4000);
}

/* ---------- Settings UI ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  $('#themeToggle').checked = settings.theme === 'dark';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = settings.theme === 'dark' ? '#0b0e1a' : '#eef1f9';
}
function applyMarketSeg() { $$('#marketSeg button').forEach(b => b.classList.toggle('active', b.dataset.val === settings.markets)); }
function applyDelaySeg()  { $$('#delaySeg button').forEach(b => b.classList.toggle('active', +b.dataset.val === settings.delay)); }
function applyPlan() {
  const pro = settings.plan === 'Pro';
  $('#planBadge').textContent = pro ? 'Pro plan' : 'Free plan';
  $('#planPill').textContent = pro ? 'PRO' : 'FREE';
  $('#planPill').classList.toggle('pro', pro);
  $('#planDesc').textContent = pro ? 'Pro — instant signals, all markets, alerts' : 'Free — delayed signals, 12 markets';
  $('#upgradeBtn').textContent = pro ? 'Manage' : 'Upgrade';
}

/* ---------- Boot ---------- */
function boot() {
  applyTheme(); applyMarketSeg(); applyDelaySeg(); applyPlan();

  /* skeleton shimmer, then content */
  $('#homeList').innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  setTimeout(renderHome, 850);

  /* onboarding */
  const slides = $('#obSlides');
  let idx = 0;
  const total = 3;
  function goTo(i) {
    idx = Math.max(0, Math.min(total - 1, i));
    slides.style.transform = `translateX(-${idx * 100}%)`;
    $$('#obDots .dot').forEach((d, j) => d.classList.toggle('active', j === idx));
    $('#obNext').textContent = idx === total - 1 ? 'Get Started' : 'Next';
  }
  function finishOnboarding() {
    localStorage.setItem('pulse.onboarded', '1');
    $('#onboarding').classList.add('hidden');
    $('#mainApp').classList.remove('hidden');
  }
  if (localStorage.getItem('pulse.onboarded')) {
    $('#onboarding').classList.add('hidden');
    $('#mainApp').classList.remove('hidden');
  } else {
    slides.style.display = 'flex';
    goTo(0);
  }
  $('#obNext').addEventListener('click', () => idx === total - 1 ? finishOnboarding() : goTo(idx + 1));
  $('#obSkip').addEventListener('click', finishOnboarding);

  /* navigation */
  $$('.nav-item').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#headerSettings').addEventListener('click', () => showView('profile'));

  /* search + filter chips */
  $('#searchInput').addEventListener('input', renderHome);
  $$('#marketChips .chip').forEach(c => c.addEventListener('click', () => {
    $$('#marketChips .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    uiFilter = c.dataset.filter;
    renderHome();
  }));

  /* card taps (event delegation) */
  $('#homeList').addEventListener('click', e => {
    const card = e.target.closest('[data-symbol]');
    if (card) openDetail(card.dataset.symbol);
  });
  $('#signalList').addEventListener('click', e => {
    const card = e.target.closest('[data-symbol]');
    if (card) openDetail(card.dataset.symbol);
  });

  /* detail */
  $('#detailBack').addEventListener('click', closeDetail);
  $$('#tfSeg button').forEach(b => b.addEventListener('click', () => {
    setTimeframe(b.dataset.tf);
    $('#dTf').textContent = b.dataset.tf;
  }));

  /* settings */
  $('#themeToggle').addEventListener('change', e => {
    settings.theme = e.target.checked ? 'dark' : 'light';
    saveSettings(); applyTheme();
    toast(settings.theme === 'dark' ? 'Dark mode on 🌙' : 'Light mode on ☀️');
  });
  $$('#marketSeg button').forEach(b => b.addEventListener('click', () => {
    settings.markets = b.dataset.val; saveSettings(); applyMarketSeg(); renderHome();
    toast('Default markets: ' + b.dataset.val);
  }));
  $$('#delaySeg button').forEach(b => b.addEventListener('click', () => {
    settings.delay = +b.dataset.val; saveSettings(); applyDelaySeg(); renderSignals();
    toast('Signal delay set to ' + b.dataset.val + ' minutes');
  }));
  $('#upgradeBtn').addEventListener('click', () => {
    if (settings.plan === 'Pro') { toast('Pro management coming soon 💎'); return; }
    settings.plan = 'Pro'; saveSettings(); applyPlan();
    toast('Welcome to Pro! (mock subscription) 💎');
  });

  /* accordions */
  $$('[data-acc] .acc-head').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));

  renderSignals();
  startFeed();

  /* service worker */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
