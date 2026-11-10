// Admin — управление каталогом магазина через GitHub API.
// Всё ходит напрямую в api.github.com (он отдаёт CORS). Токен живёт в localStorage.

const OWNER = 'PentasOS';
const REPO = 'app-store';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const KEY = 'store_pat';

let token = localStorage.getItem(KEY) || '';
let sha = null;
let catalog = { updated: '', apps: [] };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, bad) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (bad ? ' bad' : '');
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 3500);
}

function status(el, msg, bad) {
  const n = $(el);
  n.textContent = msg;
  n.className = 'status' + (bad ? ' bad' : '');
}

async function api(path, opts = {}) {
  const res = await fetch(path.startsWith('http') ? path : `https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${res.status} ${data && data.message ? data.message : res.statusText}`);
  return data;
}

const b64encode = (str) => btoa(unescape(encodeURIComponent(str)));
const b64decode = (str) => decodeURIComponent(escape(atob(str.replace(/\s/g, ''))));

// ---------------------------------------------------------------- token
async function checkToken() {
  if (!token) { status('auth-status', 'Токен не задан.', true); return false; }
  try {
    const me = await api('/user');
    status('auth-status', `Подключено как ${me.login}`);
    return true;
  } catch (e) {
    status('auth-status', 'Токен не работает: ' + e.message, true);
    return false;
  }
}

$('save-token').onclick = async () => {
  token = $('token').value.trim();
  localStorage.setItem(KEY, token);
  await checkToken();
};

$('clear-token').onclick = () => {
  token = '';
  localStorage.removeItem(KEY);
  $('token').value = '';
  status('auth-status', 'Токен удалён из браузера.');
};

// ---------------------------------------------------------------- catalog
async function loadCatalog() {
  try {
    const res = await api(`${API}/contents/apps.json`);
    sha = res.sha;
    const data = JSON.parse(b64decode(res.content));
    catalog = Array.isArray(data) ? { updated: '', apps: data } : data;
    catalog.apps = catalog.apps || [];
    render();
    status('tools-status', `Загружено приложений: ${catalog.apps.length}`);
  } catch (e) {
    status('tools-status', 'Не удалось загрузить apps.json: ' + e.message, true);
  }
}

async function saveCatalog(message) {
  catalog.updated = new Date().toISOString().slice(0, 10);
  const body = {
    message: message || 'Update catalog',
    content: b64encode(JSON.stringify(catalog, null, 2)),
    branch: 'main',
  };
  if (sha) body.sha = sha;
  const res = await api(`${API}/contents/apps.json`, { method: 'PUT', body: JSON.stringify(body) });
  sha = res.content.sha;
  render();
}

// ---------------------------------------------------------------- render
function render() {
  const box = $('apps');
  $('count').textContent = catalog.apps.length;

  if (!catalog.apps.length) {
    box.innerHTML = '<p class="hint">Каталог пуст. Нажми «Загрузить каталог».</p>';
    return;
  }

  box.innerHTML = catalog.apps.map((app, i) => `
    <div class="app-edit" data-i="${i}">
      <div class="app-edit-head">
        <div class="app-icon small">
          ${app.icon ? `<img src="${esc(app.icon)}" alt="">` : esc(app.emoji || (app.name || '?')[0])}
        </div>
        <div class="grow">
          <b>${esc(app.name)}</b>
          <span class="pill">v${esc(app.version)}</span>
          ${app.hidden ? '<span class="pill warn">скрыто</span>' : ''}
        </div>
        <a class="btn btn-ghost small" target="_blank" rel="noopener"
           href="https://github.com/${OWNER}/${REPO}/releases/tag/${encodeURIComponent(app.tag || '')}">Релиз</a>
        <button class="btn btn-ghost small danger" data-del="${i}">Удалить</button>
      </div>

      <div class="grid2">
        <label>Название<input class="input" data-f="name" value="${esc(app.name)}"></label>
        <label>Версия<input class="input" data-f="version" value="${esc(app.version)}"></label>
        <label class="wide">Описание<textarea class="input" rows="2" data-f="description">${esc(app.description)}</textarea></label>
        <label>Иконка (эмодзи)<input class="input" data-f="emoji" value="${esc(app.emoji)}" maxlength="4"></label>
        <label>Тег релиза<input class="input" data-f="tag" value="${esc(app.tag)}"></label>
        <label>Файл в релизе<input class="input" data-f="file" value="${esc(app.file)}"></label>
        <label>Автор<input class="input" data-f="author" value="${esc(app.author)}"></label>
        <label class="check"><input type="checkbox" data-f="hidden" ${app.hidden ? 'checked' : ''}> Скрыть из каталога</label>
      </div>
    </div>
  `).join('') + `
    <div class="row wrap" style="margin-top:16px">
      <button id="save-catalog" class="btn btn-primary">Сохранить каталог</button>
      <span class="hint">Правки применяются только после сохранения.</span>
    </div>`;

  box.querySelectorAll('.app-edit').forEach((el) => {
    const i = +el.dataset.i;
    el.querySelectorAll('[data-f]').forEach((input) => {
      input.addEventListener('input', () => {
        const f = input.dataset.f;
        catalog.apps[i][f] = input.type === 'checkbox' ? input.checked : input.value;
      });
    });
  });

  box.querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      const i = +btn.dataset.del;
      const app = catalog.apps[i];
      if (!confirm(`Удалить «${app.name}» из каталога? Сам релиз на GitHub останется.`)) return;
      catalog.apps.splice(i, 1);
      try { await saveCatalog(`Remove ${app.id}`); toast('Удалено из каталога'); }
      catch (e) { toast('Ошибка: ' + e.message, true); }
    };
  });

  $('save-catalog').onclick = async () => {
    try { await saveCatalog(); toast('Каталог сохранён, Pages пересоберётся за минуту'); }
    catch (e) { toast('Ошибка: ' + e.message, true); }
  };
}

// ---------------------------------------------------------------- releases
async function fetchReleases() {
  return await api(`${API}/releases?per_page=100`);
}

function apkAsset(release) {
  return (release.assets || []).find((a) => /\.apk$/i.test(a.name));
}

async function syncReleases() {
  status('tools-status', 'Читаю релизы...');
  try {
    const releases = await fetchReleases();
    const known = new Set(catalog.apps.map((a) => a.tag));
    const orphans = releases.filter((r) => !known.has(r.tag_name));

    $('orphans').innerHTML = orphans.length
      ? orphans.map((r) => {
          const apk = apkAsset(r);
          return `<div class="orphan">
            <div class="grow">
              <b>${esc(r.tag_name)}</b>
              <div class="hint">${apk ? esc(apk.name) + ' · ' + (apk.size / 1024 / 1024).toFixed(1) + ' MB' : 'нет .apk в ассетах'}</div>
            </div>
            <button class="btn btn-primary small" data-orf="${esc(r.tag_name)}" ${apk ? '' : 'disabled'}>Добавить в каталог</button>
          </div>`;
        }).join('')
      : '<p class="hint">Все релизы уже в каталоге.</p>';

    $('orphans').querySelectorAll('[data-orf]').forEach((btn) => {
      btn.onclick = () => {
        const r = releases.find((x) => x.tag_name === btn.dataset.orf);
        const apk = apkAsset(r);
        const id = r.tag_name.replace(/-v?[\d.]+[a-z]?$/i, '') || r.tag_name;
        const version = (r.tag_name.match(/-v?(.+)$/) || [, '1.0'])[1];
        catalog.apps.push({
          id,
          name: r.name || id,
          version,
          tag: r.tag_name,
          file: apk.name,
          size: (apk.size / 1024 / 1024).toFixed(1) + ' MB',
          sizeBytes: apk.size,
          description: '',
          updated: (r.published_at || '').slice(0, 10),
        });
        render();
        $('orphans').innerHTML = '<p class="hint">Добавлено в черновик. Не забудь «Сохранить каталог».</p>';
        toast('Добавлено — заполни описание и сохрани');
      };
    });

    status('tools-status', `Релизов: ${releases.length}, новых: ${orphans.length}`);
  } catch (e) {
    status('tools-status', 'Ошибка: ' + e.message, true);
  }
}

async function verifyLinks() {
  status('tools-status', 'Проверяю ссылки...');
  const bad = [];
  for (const app of catalog.apps) {
    try {
      const r = await api(`${API}/releases/tags/${encodeURIComponent(app.tag)}`);
      const apk = apkAsset(r);
      if (!apk) { bad.push(`${app.name}: в релизе ${app.tag} нет .apk`); continue; }
      if (app.file && apk.name !== app.file) bad.push(`${app.name}: файл называется ${apk.name}, а в каталоге ${app.file}`);
    } catch (e) {
      bad.push(`${app.name}: релиз ${app.tag} — ${e.message}`);
    }
  }
  status('tools-status', bad.length ? 'Проблемы: ' + bad.join('; ') : `Все ${catalog.apps.length} ссылок живые.`, bad.length > 0);
}

// ---------------------------------------------------------------- init
$('load').onclick = loadCatalog;
$('sync').onclick = syncReleases;
$('verify').onclick = verifyLinks;

(async function init() {
  $('token').value = token;
  if (await checkToken()) await loadCatalog();
})();
