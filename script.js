// Store — каталог приложений.
// Данные берутся из apps.json. Скачивание идёт напрямую из GitHub Releases.

const REPO = 'PentasOS/app-store';

let APPS = [];

const $ = (id) => document.getElementById(id);

function formatSize(bytes) {
  if (!bytes) return '—';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb.toFixed(1) + ' MB';
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function iconHtml(app) {
  if (app.icon) return `<img src="${app.icon}" alt="${app.name}" onerror="this.replaceWith(document.createTextNode('${app.emoji || '📦'}'))">`;
  return app.emoji || '📦';
}

// Ссылка на скачивание: либо явная, либо собирается из тега релиза и имени файла.
function downloadUrl(app) {
  if (app.downloadUrl) return app.downloadUrl;
  return `https://github.com/${REPO}/releases/download/${app.tag}/${app.file}`;
}

function releaseUrl(app) {
  return `https://github.com/${REPO}/releases/tag/${app.tag}`;
}

function cardHtml(app) {
  return `
    <article class="card" data-id="${app.id}">
      <div class="app-icon">${iconHtml(app)}</div>
      <div class="card-body">
        <div class="card-title">${app.name}</div>
        <div class="app-sub">v${app.version}${app.author ? ' · ' + app.author : ''}</div>
        <p class="card-desc">${app.description || ''}</p>
        <div class="card-foot">
          <span class="chip">${app.size || ''}</span>
          <button class="btn btn-primary" data-download="${app.id}">Скачать</button>
        </div>
      </div>
    </article>`;
}

function render(list) {
  const grid = $('grid');
  grid.innerHTML = list.map(cardHtml).join('');
  $('empty').hidden = list.length > 0;
}

function openModal(app) {
  $('m-icon').innerHTML = iconHtml(app);
  $('m-name').textContent = app.name;
  $('m-sub').textContent = `v${app.version}${app.author ? ' · ' + app.author : ''}`;
  $('m-desc').textContent = app.description || 'Описание не указано.';
  $('m-version').textContent = app.version || '—';
  $('m-size').textContent = app.size || '—';
  $('m-date').textContent = formatDate(app.updated);
  $('m-file').textContent = app.file || '—';

  const dl = $('m-download');
  dl.href = downloadUrl(app);
  dl.setAttribute('download', app.file || '');

  $('m-page').href = releaseUrl(app);
  $('modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('modal').hidden = true;
  document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
  const dl = e.target.closest('[data-download]');
  if (dl) {
    e.stopPropagation();
    const app = APPS.find(a => a.id === dl.dataset.download);
    if (app) window.location.href = downloadUrl(app);
    return;
  }

  if (e.target.closest('[data-close]')) { closeModal(); return; }

  const card = e.target.closest('.card');
  if (card) {
    const app = APPS.find(a => a.id === card.dataset.id);
    if (app) openModal(app);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('modal').hidden) closeModal();
});

$('search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const list = q
    ? APPS.filter(a => (a.name + ' ' + (a.description || '')).toLowerCase().includes(q))
    : APPS;
  render(list);
});

async function init() {
  try {
    const res = await fetch('apps.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    APPS = Array.isArray(data) ? data : (data.apps || []);
  } catch (err) {
    console.error('Не удалось загрузить apps.json:', err);
    APPS = [];
  }
  render(APPS);
  $('count').textContent = `Приложений в каталоге: ${APPS.length} · обновлено ${formatDate(new Date().toISOString())}`;
}

init();
