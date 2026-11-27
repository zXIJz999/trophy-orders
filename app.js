const MAX_GAMES = 300;
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
  statPlats: document.getElementById('stat-plats'),
  statPoints: document.getElementById('stat-points'),
  statLevel: document.getElementById('stat-level'),
  calcNote: document.getElementById('calc-note')
};

const regionNames = { US: 'US', EU: 'EU', JP: 'JP', AS: 'ASIA', KR: 'KR' };

let games = [];
let matches = [];
const selected = new Map();

document.getElementById('max').textContent = MAX_GAMES;

function loadLibrary() {
  fetch('catalog.json')
    .then(res => res.json())
    .then(rows => {
      games = rows.map(([id, name, region, points = null, plat = null]) => ({
        id, name, region, points, plat, key: name.toLowerCase()
      }));
      els.libraryCount.textContent = games.length.toLocaleString() + ' games';
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
  els.selectedCount.textContent = selected.size + ' / ' + MAX_GAMES;
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

function updateCalculator() {
  const rawLvl = Number(els.startLevel.value);
  const startLvl = Math.max(1, Math.min(999, Number.isFinite(rawLvl) ? Math.floor(rawLvl) : 1));
  const rawPct = Number(els.startPct.value);
  const startPct = startLvl >= 999 ? 0 : Math.max(0, Math.min(99, Number.isFinite(rawPct) ? Math.floor(rawPct) : 0));

  let orderPts = 0;
  let plats = 0;
  let known = 0;
  let noPlat = 0;
  selected.forEach(g => {
    if (typeof g.points === 'number') {
      known++;
      orderPts += g.points;
    }
    if (typeof g.plat === 'number') {
      if (g.plat > 0) plats += g.plat;
      else noPlat++;
    }
  });

  const startBase = basePoints(startLvl) + (startLvl < 999 ? Math.floor((startPct / 100) * levelCost(startLvl)) : 0);
  const after = calcLevel(startBase + orderPts);
  const gained = after.level - startLvl;

  els.statPlats.textContent = String(plats) + (noPlat ? ` (${noPlat} no-plat)` : '');
  els.statPoints.textContent = '+' + orderPts.toLocaleString();
  els.statLevel.textContent = `Lvl ${after.level} (${after.pct}%)` + (gained > 0 ? ` +${gained}` : '');

  const missing = selected.size - known;
  if (selected.size === 0) {
    els.calcNote.hidden = true;
  } else if (missing > 0) {
    els.calcNote.hidden = false;
    els.calcNote.textContent = `${after.tier} tier · ${known}/${selected.size} games have point data (${missing} uncached).`;
  } else {
    els.calcNote.hidden = false;
    els.calcNote.textContent = `${after.tier} tier · all ${selected.size} games calculated.`;
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
      selected.set(game.id, game);
    } else if (selected.size < MAX_GAMES) {
      selected.set(game.id, game);
    } else {
      els.selectedCount.textContent = 'Order is full';
      return;
    }
  }
  refresh();
}

function addAllResults() {
  const haveNames = new Set([...selected.values()].map(gameKey));
  for (const game of matches) {
    if (selected.size >= MAX_GAMES) {
      break;
    }
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
els.startLevel.addEventListener('input', updateCalculator);
els.startPct.addEventListener('input', updateCalculator);

drawPicked();
loadLibrary();
