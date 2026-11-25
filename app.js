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
  copy: document.getElementById('copy')
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
      games = rows.map(([id, name, region]) => ({ id, name, region, key: name.toLowerCase() }));
      els.libraryCount.textContent = games.length.toLocaleString() + ' games';
      runSearch();
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
}

function toggle(game) {
  if (selected.has(game.id)) {
    selected.delete(game.id);
  } else if (selected.size < MAX_GAMES) {
    selected.set(game.id, game);
  } else {
    els.selectedCount.textContent = 'Order is full';
    return;
  }
  refresh();
}

function addAllResults() {
  for (const game of matches) {
    if (selected.size >= MAX_GAMES) {
      break;
    }
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

drawPicked();
loadLibrary();
