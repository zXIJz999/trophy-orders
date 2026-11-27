const RESULT_LIMIT = 200;
const PREFIX = 'TO1.';

const els = {
  search: document.getElementById('search'),
  region: document.getElementById('region'),
  results: document.getElementById('results'),
  resultCount: document.getElementById('result-count'),
  libraryCount: document.getElementById('library-count'),
  addAll: document.getElementById('add-all'),
  picked: document.getElementById('picked'),
  selectedCount: document.getElementById('selected-count'),
  empty: document.getElementById('empty'),
  generate: document.getElementById('generate'),
  clear: document.getElementById('clear'),
  codeBox: document.getElementById('code-box'),
  code: document.getElementById('code'),
  copy: document.getElementById('copy'),
  startLevel: document.getElementById('start-level'),
  startPct: document.getElementById('start-pct'),
  targetLevel: document.getElementById('target-level'),
  platsOnly: document.getElementById('plats-only'),
  autoFill: document.getElementById('auto-fill'),
  statPlats: document.getElementById('stat-plats'),
  statGold: document.getElementById('stat-gold'),
  statSilver: document.getElementById('stat-silver'),
  statBronze: document.getElementById('stat-bronze'),
  statPoints: document.getElementById('stat-points'),
  statLevel: document.getElementById('stat-level'),
  statEta: document.getElementById('stat-eta'),
  statPrice: document.getElementById('stat-price'),
  statReg: document.getElementById('stat-reg'),
  statSave: document.getElementById('stat-save'),
  bundlesGrid: document.getElementById('bundles-grid'),
  toggleBundles: document.getElementById('toggle-bundles'),
  calcNote: document.getElementById('calc-note')
};

const regionNames = { US: 'US', EU: 'EU', JP: 'JP', AS: 'ASIA', KR: 'KR' };

const BUNDLE_DEFS = [
  { id: 'cod', name: 'Call of Duty', studio: 'Activision', match: k => k.includes('call of duty') },
  { id: 'rockstar', name: 'Rockstar Games', studio: 'Full Studio', match: k => k.startsWith('grand theft auto') || k.startsWith('red dead redemption') || k === 'bully' || k === 'l.a. noire' || k === 'l.a. noire: the vr case files' || k === 'manhunt' },
  { id: 'gta', name: 'Grand Theft Auto', studio: 'Rockstar Games', match: k => k.startsWith('grand theft auto') },
  { id: 'ac', name: "Assassin's Creed", studio: 'Ubisoft', match: k => k.includes("assassin's creed") || k.includes('assassins creed') },
  { id: 'fifa', name: 'FIFA & EA FC', studio: 'EA Sports', match: k => k.startsWith('fifa ') || k.startsWith('ea sports fc') },
  { id: 'ps', name: 'PlayStation Studios', studio: 'Sony Interactive', match: k => /^(god of war|uncharted:|uncharted |the last of us|marvel's spider-man|horizon |ghost of tsushima|infamous |ratchet & clank|days gone)/.test(k) && !k.startsWith('horizon chase') && !k.startsWith('uncharted tides') },
  { id: 're', name: 'Resident Evil', studio: 'Capcom', match: k => k.startsWith('resident evil') },
  { id: 'lego', name: 'LEGO Collection', studio: 'TT Games / WB', match: k => k.startsWith('lego ') },
  { id: 'farcry', name: 'Far Cry', studio: 'Ubisoft', match: k => k.startsWith('far cry') },
  { id: 'ea_action', name: 'Battlefield & NFS', studio: 'Electronic Arts', match: k => k.startsWith('battlefield') || k.startsWith('need for speed') },
  { id: '2ksports', name: '2K Sports (NBA/WWE)', studio: '2K Games', match: k => k.startsWith('nba 2k') || k.startsWith('wwe 2k') || k.startsWith('pga tour 2k') || k.startsWith('topspin 2k') },
  { id: 'fromsoft', name: 'FromSoftware Souls', studio: 'FromSoftware', match: k => k.startsWith('dark souls') || k.startsWith('bloodborne') || k.startsWith('sekiro') || k.startsWith('elden ring') || k.startsWith('armored core') },
  { id: 'yakuza', name: 'Yakuza / LaD', studio: 'RGG / SEGA', match: k => k.includes('yakuza') || k.includes('like a dragon') },
  { id: 'ff', name: 'Final Fantasy', studio: 'Square Enix', match: k => k.includes('final fantasy') },
  { id: 'tombraider', name: 'Tomb Raider', studio: 'Crystal Dynamics', match: k => k.includes('tomb raider') },
  { id: '2kshooter', name: 'Borderlands & BioShock', studio: '2K Games', match: k => k.startsWith('borderlands') || k.startsWith('bioshock') || k.startsWith('tiny tina') }
];

let games = [];
let matches = [];
let bundles = [];
let showAllBundles = false;
const selected = new Map();

function buildBundles() {
  const byName = new Map();
  for (const g of games) {
    if (!(g.plat > 0)) continue;
    const k = gameKey(g);
    let bucket = byName.get(k);
    if (!bucket) {
      bucket = [];
      byName.set(k, bucket);
    }
    bucket.push(g);
  }
  bundles = BUNDLE_DEFS.map(def => {
    const items = [];
    const keys = new Set();
    byName.forEach((bucket, k) => {
      if (!def.match(k)) return;
      const pref = bucket.find(x => x.region === 'US') || bucket.find(x => x.region === 'EU') || bucket[0];
      items.push(pref);
      keys.add(k);
    });
    const platCount = items.length;
    const regular = platCount;
    const price = Math.round(platCount * 0.65);
    return { ...def, items, keys, platCount, regular, price, savings: regular - price };
  }).filter(b => b.platCount > 0);
  drawBundles();
}

function isBundleInOrder(bundle) {
  if (!bundle.keys.size) return false;
  const selKeys = new Set([...selected.values()].map(gameKey));
  for (const k of bundle.keys) {
    if (!selKeys.has(k)) return false;
  }
  return true;
}

function toggleBundle(bundle) {
  if (isBundleInOrder(bundle)) {
    for (const [id, g] of selected.entries()) {
      if (bundle.keys.has(gameKey(g))) selected.delete(id);
    }
  } else {
    const region = els.region.value;
    for (const item of bundle.items) {
      const k = gameKey(item);
      const existing = findSelectedByName(k);
      if (existing) selected.delete(existing.id);
      let pick = item;
      if (region) {
        const regMatch = games.find(g => g.plat > 0 && g.region === region && gameKey(g) === k);
        if (regMatch) pick = regMatch;
      }
      selected.set(pick.id, pick);
    }
  }
  refresh();
}

function drawBundles() {
  if (!els.bundlesGrid) return;
  const visible = showAllBundles ? bundles : bundles.slice(0, 8);
  const frag = document.createDocumentFragment();
  visible.forEach(b => {
    const active = isBundleInOrder(b);
    const card = document.createElement('div');
    card.className = 'bundle-card' + (active ? ' active' : '');

    const top = document.createElement('div');
    top.className = 'bundle-top';
    const st = document.createElement('span');
    st.className = 'bundle-studio';
    st.textContent = b.studio;
    const pl = document.createElement('span');
    pl.className = 'bundle-plats';
    pl.textContent = b.platCount + ' plats';
    top.append(st, pl);

    const title = document.createElement('h3');
    title.className = 'bundle-title';
    title.textContent = b.name;

    const bottom = document.createElement('div');
    bottom.className = 'bundle-bottom';
    const pricing = document.createElement('div');
    pricing.className = 'bundle-pricing';
    const pr = document.createElement('span');
    pr.className = 'bundle-price';
    pr.textContent = '$' + b.price;
    const reg = document.createElement('span');
    reg.className = 'bundle-reg';
    reg.textContent = '$' + b.regular;
    pricing.append(pr, reg);

    const btn = document.createElement('button');
    btn.className = 'btn ghost small';
    btn.type = 'button';
    btn.textContent = active ? 'Added ✓' : 'Add bundle';
    btn.addEventListener('click', () => toggleBundle(b));

    bottom.append(pricing, btn);
    card.append(top, title, bottom);
    frag.append(card);
  });
  els.bundlesGrid.replaceChildren(frag);
  if (els.toggleBundles) {
    els.toggleBundles.hidden = bundles.length <= 8;
    els.toggleBundles.textContent = showAllBundles ? 'Show top 8 bundles' : `Show all ${bundles.length} bundles`;
  }
}

function calculatePricing() {
  const platKeys = new Set();
  selected.forEach(g => {
    if (g.plat > 0) platKeys.add(gameKey(g));
  });
  const regular = platKeys.size;
  const claimed = new Set();
  const matched = [];
  let price = 0;

  const ranked = [...bundles].sort((a, b) => b.savings - a.savings || b.platCount - a.platCount);
  for (const b of ranked) {
    if (b.savings <= 0) continue;
    let ok = true;
    for (const k of b.keys) {
      if (!platKeys.has(k) || claimed.has(k)) { ok = false; break; }
    }
    if (ok) {
      for (const k of b.keys) claimed.add(k);
      matched.push(b);
      price += b.price;
    }
  }
  price += regular - claimed.size;
  return { price, regular, savings: regular - price, matched };
}

function loadLibrary() {
  fetch('catalog.json?v=4')
    .then(res => res.json())
    .then(rows => {
      games = rows.map(([id, name, region, points = null, plat = null, bronze = null, silver = null, gold = null]) => ({
        id, name, region, points, plat, bronze, silver, gold, key: name.toLowerCase()
      }));
      els.libraryCount.textContent = games.length.toLocaleString() + ' games';
      buildBundles();
      runSearch();
      updateCalculator();
    })
    .catch(() => {
      els.libraryCount.textContent = 'Could not load the library';
    });
}

function runSearch() {
  const words = els.search.value.toLowerCase().split(/\s+/).filter(Boolean);
  const region = els.region.value;

  if (!words.length && !region) {
    matches = [];
    els.resultCount.textContent = 'Type to search';
    els.addAll.disabled = true;
    els.results.innerHTML = '';
    return;
  }

  matches = games.filter(g => (!region || g.region === region) && words.every(w => g.key.includes(w)));

  const lead = words.join(' ');
  if (lead) {
    matches.sort((a, b) => Number(b.key.startsWith(lead)) - Number(a.key.startsWith(lead)));
  }

  const shown = Math.min(matches.length, RESULT_LIMIT);
  els.resultCount.textContent = matches.length
    ? matches.length.toLocaleString() + ' results' + (matches.length > shown ? ', showing ' + shown : '')
    : 'No games found';
  els.addAll.disabled = !matches.length;
  drawResults(matches.slice(0, RESULT_LIMIT));
}

function makeRow(game, onClick) {
  const li = document.createElement('li');
  li.className = 'item' + (selected.has(game.id) ? ' on' : '');
  li.dataset.id = game.id;

  const tick = document.createElement('span');
  tick.className = 'tick';

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = game.name;
  name.title = game.name;

  li.append(tick, name);

  if (game.plat === 0) {
    const np = document.createElement('span');
    np.className = 'tag noplat';
    np.textContent = 'NO PLAT';
    li.append(np);
  }

  if (typeof game.points === 'number') {
    const pts = document.createElement('span');
    pts.className = 'tag pts';
    pts.textContent = game.points.toLocaleString() + ' PTS';
    li.append(pts);
  }

  if (game.region) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = regionNames[game.region] || game.region;
    li.append(tag);
  }

  if (onClick) {
    li.addEventListener('click', onClick);
  }
  return li;
}

function drawResults(list) {
  const frag = document.createDocumentFragment();
  list.forEach(game => frag.append(makeRow(game, () => toggle(game))));
  els.results.replaceChildren(frag);
}

function drawPicked() {
  const frag = document.createDocumentFragment();

  [...selected.values()].forEach(game => {
    const row = makeRow(game);
    row.classList.remove('on');
    row.querySelector('.tick').remove();

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Remove ' + game.name);
    remove.addEventListener('click', () => toggle(game));
    row.append(remove);

    frag.append(row);
  });

  els.picked.replaceChildren(frag);
  els.selectedCount.textContent = selected.size + (selected.size === 1 ? ' game' : ' games');
  els.empty.hidden = selected.size > 0;
  els.generate.disabled = selected.size === 0;
  els.clear.disabled = selected.size === 0;
  els.codeBox.hidden = true;
  updateCalculator();
}

function levelCost(level) {
  if (level < 100) return 60;
  if (level < 200) return 90;
  if (level < 300) return 450;
  if (level < 400) return 900;
  if (level < 500) return 1350;
  if (level < 600) return 1800;
  if (level < 700) return 2250;
  if (level < 800) return 2700;
  if (level < 900) return 3150;
  return 3600;
}

function basePoints(level) {
  const clamped = Math.max(1, Math.min(999, level | 0));
  let pts = 0;
  for (let lv = 1; lv < clamped; lv++) pts += levelCost(lv);
  return pts;
}

function tierName(level) {
  if (level >= 999) return 'Platinum';
  if (level >= 600) return 'Gold';
  if (level >= 300) return 'Silver';
  return 'Bronze';
}

function calcLevel(totalPoints) {
  let pts = Math.max(0, totalPoints);
  let acc = 0;
  for (let lv = 1; lv < 999; lv++) {
    const cost = levelCost(lv);
    if (pts < acc + cost) {
      return { level: lv, pct: Math.floor(((pts - acc) * 100) / cost), tier: tierName(lv) };
    }
    acc += cost;
  }
  return { level: 999, pct: 0, tier: 'Platinum' };
}

function formatEta(gameCount, totalTrophies) {
  if (!gameCount) return '--';
  const secs = Math.round(gameCount * 14 + totalTrophies * 0.25);
  if (secs < 60) return `~${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `~${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `~${hrs}h ${rem}m` : `~${hrs}h`;
}

function updateCalculator(customNote = '') {
  const rawLvl = Number(els.startLevel.value);
  const startLvl = Math.max(1, Math.min(999, Number.isFinite(rawLvl) ? Math.floor(rawLvl) : 1));
  const rawPct = Number(els.startPct.value);
  const startPct = startLvl >= 999 ? 0 : Math.max(0, Math.min(99, Number.isFinite(rawPct) ? Math.floor(rawPct) : 0));

  let orderPts = 0;
  let plats = 0;
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  let totalTrophies = 0;
  let known = 0;
  let noPlat = 0;
  selected.forEach(g => {
    if (typeof g.points === 'number') {
      known++;
      orderPts += g.points;
    }
    let gameTrophies = 0;
    if (typeof g.plat === 'number') {
      if (g.plat > 0) plats += g.plat;
      else noPlat++;
      gameTrophies += g.plat;
    }
    if (typeof g.gold === 'number') { gold += g.gold; gameTrophies += g.gold; }
    if (typeof g.silver === 'number') { silver += g.silver; gameTrophies += g.silver; }
    if (typeof g.bronze === 'number') { bronze += g.bronze; gameTrophies += g.bronze; }
    totalTrophies += gameTrophies > 0 ? gameTrophies : 25;
  });

  const startBase = basePoints(startLvl) + (startLvl < 999 ? Math.floor((startPct / 100) * levelCost(startLvl)) : 0);
  const after = calcLevel(startBase + orderPts);
  const gained = after.level - startLvl;

  els.statPlats.textContent = plats.toLocaleString();
  els.statGold.textContent = gold.toLocaleString();
  els.statSilver.textContent = silver.toLocaleString();
  els.statBronze.textContent = bronze.toLocaleString();
  els.statPoints.textContent = '+' + orderPts.toLocaleString();
  els.statLevel.textContent = `Lvl ${after.level} (${after.pct}%)` + (gained > 0 ? ` +${gained}` : '');
  els.statEta.textContent = formatEta(selected.size, totalTrophies);

  const pricing = calculatePricing();
  els.statPrice.textContent = '$' + pricing.price.toLocaleString();
  if (pricing.savings > 0) {
    els.statReg.hidden = false;
    els.statReg.textContent = '$' + pricing.regular.toLocaleString();
    els.statSave.hidden = false;
    els.statSave.textContent = 'Save $' + pricing.savings.toLocaleString();
  } else {
    els.statReg.hidden = true;
    els.statSave.hidden = true;
  }

  const missing = selected.size - known;
  if (customNote) {
    els.calcNote.hidden = false;
    els.calcNote.textContent = customNote;
  } else if (selected.size === 0) {
    els.calcNote.hidden = true;
  } else {
    const bits = [`${after.tier} tier`];
    if (pricing.matched.length > 0) bits.push('Bundles: ' + pricing.matched.map(b => b.name).join(', '));
    if (noPlat > 0) bits.push(`${noPlat} free bonus (no-plat)`);
    if (missing > 0) bits.push(`${known}/${selected.size} games have point data`);
    els.calcNote.hidden = false;
    els.calcNote.textContent = bits.join(' · ') + '.';
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

async function pickRandomToTarget() {
  if (!games.length) {
    updateCalculator('Library is still loading, please try again in a second.');
    return;
  }
  const rawStart = Number(els.startLevel.value);
  const startLvl = Math.max(1, Math.min(999, Number.isFinite(rawStart) ? Math.floor(rawStart) : 1));
  const rawPct = Number(els.startPct.value);
  const startPct = startLvl >= 999 ? 0 : Math.max(0, Math.min(99, Number.isFinite(rawPct) ? Math.floor(rawPct) : 0));
  const rawTarget = Number(els.targetLevel.value);
  const targetLvl = Number.isFinite(rawTarget) ? Math.min(999, Math.floor(rawTarget)) : 0;

  if (targetLvl <= startLvl) {
    els.targetLevel.focus();
    updateCalculator('Enter a target level higher than your current level.');
    return;
  }

  const startBase = basePoints(startLvl) + (startLvl < 999 ? Math.floor((startPct / 100) * levelCost(startLvl)) : 0);
  const targetBase = basePoints(targetLvl);
  let remainingPts = targetBase - startBase;
  if (remainingPts <= 0) {
    updateCalculator('You are already at or above the target level.');
    return;
  }

  const region = els.region.value;
  const platsOnly = els.platsOnly.checked;
  const groups = new Map();
  for (const g of games) {
    if (typeof g.points !== 'number' || g.points <= 0) continue;
    if (region && g.region !== region) continue;
    if (platsOnly && !(g.plat > 0)) continue;
    const k = gameKey(g);
    let bucket = groups.get(k);
    if (!bucket) {
      bucket = [];
      groups.set(k, bucket);
    }
    bucket.push(g);
  }

  const pool = [];
  groups.forEach(bucket => {
    pool.push(bucket[Math.floor(Math.random() * bucket.length)]);
  });
  shuffle(pool);

  const picked = [];
  for (let i = 0; i < pool.length && remainingPts > 0; i++) {
    const chosen = pool[i];
    picked.push(chosen);
    remainingPts -= chosen.points;
  }

  selected.clear();
  picked.forEach(g => selected.set(g.id, g));
  let note = '';
  if (remainingPts > 0) {
    const reached = calcLevel(targetBase - remainingPts);
    note = `Added all ${picked.length.toLocaleString()} matching games (Lvl ${reached.level} ${reached.pct}%) — ${remainingPts.toLocaleString()} pts short of Lvl ${targetLvl}.`;
  }
  refresh();
  if (note) updateCalculator(note);
  if (selected.size > 0) {
    await showCode();
  }
}

function gameKey(game) {
  return game.name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function findSelectedByName(key) {
  for (const g of selected.values()) {
    if (gameKey(g) === key) return g;
  }
  return null;
}

function toggle(game) {
  if (selected.has(game.id)) {
    selected.delete(game.id);
  } else {
    const existing = findSelectedByName(gameKey(game));
    if (existing) {
      selected.delete(existing.id);
    }
    selected.set(game.id, game);
  }
  refresh();
}

function addAllResults() {
  const haveNames = new Set([...selected.values()].map(gameKey));
  for (const game of matches) {
    const key = gameKey(game);
    if (selected.has(game.id) || haveNames.has(key)) {
      continue;
    }
    haveNames.add(key);
    selected.set(game.id, game);
  }
  refresh();
}

function refresh() {
  drawPicked();
  drawBundles();
  els.results.querySelectorAll('.item').forEach(row => {
    row.classList.toggle('on', selected.has(Number(row.dataset.id)));
  });
}

function writeVarint(bytes, value) {
  while (value >= 0x80) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
}

function toBase64Url(bytes) {
  let text = '';
  bytes.forEach(b => {
    text += String.fromCharCode(b);
  });
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function buildCode() {
  const ids = [...selected.keys()].sort((a, b) => a - b);
  const bytes = [];
  let last = 0;
  ids.forEach(id => {
    writeVarint(bytes, id - last);
    last = id;
  });

  if (typeof CompressionStream === 'undefined') {
    return 'TO0.' + toBase64Url(bytes);
  }
  return PREFIX + toBase64Url(await deflate(new Uint8Array(bytes)));
}

async function showCode() {
  els.code.value = await buildCode();
  els.codeBox.hidden = false;
  els.copy.textContent = 'Copy code';
  els.codeBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function copyCode() {
  els.code.select();
  const done = () => {
    els.copy.textContent = 'Copied';
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(els.code.value).then(done);
  } else {
    document.execCommand('copy');
    done();
  }
}

function clearOrder() {
  selected.clear();
  refresh();
}

let timer;
els.search.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(runSearch, 120);
});
els.region.addEventListener('change', runSearch);
els.addAll.addEventListener('click', addAllResults);
els.generate.addEventListener('click', showCode);
els.copy.addEventListener('click', copyCode);
els.clear.addEventListener('click', clearOrder);
els.startLevel.addEventListener('input', () => updateCalculator());
els.startPct.addEventListener('input', () => updateCalculator());
els.targetLevel.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    pickRandomToTarget();
  }
});
els.autoFill.addEventListener('click', pickRandomToTarget);
if (els.toggleBundles) {
  els.toggleBundles.addEventListener('click', () => {
    showAllBundles = !showAllBundles;
    drawBundles();
  });
}

drawPicked();
loadLibrary();
