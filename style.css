const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

function applyTheme() {
  const root = document.documentElement.style;
  const tp = tg?.themeParams || {};
  root.setProperty('--tg-bg', tp.bg_color || '#ffffff');
  root.setProperty('--tg-text', tp.text_color || '#111111');
  root.setProperty('--tg-hint', tp.hint_color || '#8e8e93');
  root.setProperty('--tg-link', tp.link_color || '#2481cc');
  root.setProperty('--tg-button', tp.button_color || '#2481cc');
  root.setProperty('--tg-button-text', tp.button_text_color || '#ffffff');
  root.setProperty('--tg-secondary-bg', tp.secondary_bg_color || '#f2f2f7');
}
applyTheme();
tg?.onEvent('themeChanged', applyTheme);

const initData = tg?.initData || '';

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

function haptic(kind = 'light') {
  if (!tg?.HapticFeedback) return;
  if (kind === 'success' || kind === 'error' || kind === 'warning') {
    tg.HapticFeedback.notificationOccurred(kind);
  } else {
    tg.HapticFeedback.impactOccurred(kind);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const appTitle = document.getElementById('app-title');
const appSubtitle = document.getElementById('app-subtitle');

let me = null;
let employees = [];
let currentTab = 'assign';
let allFilter = 'all'; // фильтр по сотруднику на вкладке «Все задачи»

/* ===================== Общие штуки ===================== */

const EMPLOYEE_EMOJI = { 'Рената': '🌸', 'Дарья': '🌿', 'Замир': '⚙️', 'Маден': '🚀', 'Асхат': '🛠', 'Виктория': '⭐' };

function statusLabel(s) {
  return { new: 'Новая', in_progress: 'В работе', done: 'Готово', cancelled: 'Отменена' }[s] || s;
}

function formatDeadline(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((target - today) / 86400000);
  let label;
  if (diffDays === 0) label = 'сегодня';
  else if (diffDays === 1) label = 'завтра';
  else {
    label = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
    if (d.getFullYear() !== today.getFullYear()) label += ` ${d.getFullYear()}`;
  }
  return { label, overdue: target < today };
}

function taskCard(t, opts = {}) {
  const { showAssignee = false, canChangeStatus = false, canCancel = false } = opts;
  const dl = formatDeadline(t.deadline);

  let actions = '';
  if (canChangeStatus && (t.status === 'new' || t.status === 'in_progress')) {
    const parts = [];
    if (t.status === 'new') parts.push(`<button class="btn small" data-status="${t.id}:in_progress">Взять в работу</button>`);
    parts.push(`<button class="btn small" data-status="${t.id}:done">Готово</button>`);
    if (canCancel) parts.push(`<button class="btn small ghost" data-status="${t.id}:cancelled">Отменить</button>`);
    actions = `<div class="card-actions">${parts.join('')}</div>`;
  }

  const comments = (t.comments || []).map((c) => `
    <div class="comment-item"><b>${escapeHtml(c.author_name)}:</b> <span class="c-text">${escapeHtml(c.text)}</span></div>
  `).join('');

  return `
    <div class="card" data-task="${t.id}">
      <div class="card-top">
        ${showAssignee
          ? `<span class="badge">${EMPLOYEE_EMOJI[t.assignee] || '👤'} ${escapeHtml(t.assignee)}</span>`
          : `<span></span>`}
        <span class="status status-${t.status === 'new' ? 'open' : t.status}">${statusLabel(t.status)}</span>
      </div>
      <p class="task-title">${escapeHtml(t.title)}</p>
      ${t.description ? `<p class="desc">${escapeHtml(t.description)}</p>` : ''}
      ${dl ? `<p class="meta deadline ${dl.overdue && t.status !== 'done' && t.status !== 'cancelled' ? 'overdue' : ''}">📅 Срок: ${dl.label}</p>` : ''}
      ${actions}
      <div class="comments">
        ${comments}
        <form class="comment-form" data-comment-form="${t.id}">
          <input type="text" placeholder="Написать комментарий…" required />
          <button type="submit" class="btn small">➤</button>
        </form>
      </div>
    </div>`;
}

function bindTaskCardEvents(container, onChanged) {
  container.querySelectorAll('[data-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const [id, status] = btn.dataset.status.split(':');
      try {
        await api(`/tasks/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
        haptic('success');
        showToast(status === 'done' ? 'Отмечено как выполнено' : status === 'cancelled' ? 'Задача отменена' : 'Взято в работу');
        onChanged();
      } catch (e) {
        haptic('error');
        showToast(e.message);
      }
    });
  });
  container.querySelectorAll('[data-comment-form]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = form.dataset.commentForm;
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      try {
        await api(`/tasks/${id}/comment`, { method: 'POST', body: JSON.stringify({ text }) });
        haptic('light');
        input.value = '';
        onChanged();
      } catch (e2) {
        haptic('error');
        showToast(e2.message);
      }
    });
  });
}

/* ===================== Онбординг: выбор сотрудника ===================== */

function renderOnboarding() {
  view.innerHTML = `
    <div class="onboarding">
      <div class="big-emoji">👋</div>
      <h2>Кто вы?</h2>
      <p>Выберите своё имя из списка — это нужно, чтобы показывать именно ваши задачи.</p>
      <div class="name-grid">
        ${employees.map((n) => `<button type="button" class="name-btn" data-pick="${escapeHtml(n)}">${EMPLOYEE_EMOJI[n] || '👤'} ${escapeHtml(n)}</button>`).join('')}
      </div>
    </div>`;
  view.querySelectorAll('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api('/me/employee', { method: 'POST', body: JSON.stringify({ employee_name: btn.dataset.pick }) });
        haptic('success');
        await boot();
      } catch (e) {
        haptic('error');
        showToast(e.message);
      }
    });
  });
}

/* ===================== Директор: раздать задачу ===================== */

let selectedAssignee = null;

async function renderAssign() {
  selectedAssignee = selectedAssignee || employees[0];
  view.innerHTML = `
    <div class="cat-grid">
      ${employees.map((n) => `
        <button type="button" class="cat-btn ${n === selectedAssignee ? 'selected' : ''}" data-assignee="${escapeHtml(n)}">
          <span class="cat-emoji">${EMPLOYEE_EMOJI[n] || '👤'}</span>
          <span>${escapeHtml(n)}</span>
        </button>`).join('')}
    </div>
    <form id="task-form" class="form">
      <label>Что нужно сделать
        <input name="title" placeholder="Название задачи" required />
      </label>
      <label>Подробности
        <textarea name="description" placeholder="Необязательно"></textarea>
      </label>
      <label>Срок
        <button type="button" id="when-field" class="field-btn">
          <span id="when-field-text" class="placeholder">Без срока</span>
          <span class="chev">📅</span>
        </button>
      </label>
      <button type="submit" class="btn primary">Поставить задачу</button>
    </form>
  `;

  view.querySelectorAll('[data-assignee]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      selectedAssignee = btn.dataset.assignee;
      view.querySelectorAll('[data-assignee]').forEach((b) => b.classList.toggle('selected', b === btn));
    });
  });

  document.getElementById('when-field').addEventListener('click', openDeadlineSheet);
  updateWhenFieldDisplay();

  document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          assignee: selectedAssignee,
          title: fd.get('title'),
          description: fd.get('description'),
          deadline: dtState.date ? dtState.date.toISOString() : null,
        }),
      });
      haptic('success');
      showToast('Задача поставлена!');
      e.target.reset();
      resetDeadlineState();
      switchTab('all');
    } catch (err) {
      haptic('error');
      showToast(err.message);
    }
  });
}

/* ===================== Выбор срока (дедлайна) ===================== */

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

let dtState = { date: null };
let calViewMonth = startOfMonth(new Date());

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfDay(d) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }

function resetDeadlineState() {
  dtState = { date: null };
  calViewMonth = startOfMonth(new Date());
}

function formatSelectedDeadline() {
  if (!dtState.date) return null;
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  if (isSameDay(dtState.date, today)) return 'Сегодня';
  if (isSameDay(dtState.date, tomorrow)) return 'Завтра';
  const wd = WEEKDAYS_SHORT[(dtState.date.getDay() + 6) % 7];
  return `${wd}, ${dtState.date.getDate()} ${MONTHS_GEN[dtState.date.getMonth()]}`;
}

function updateWhenFieldDisplay() {
  const el = document.getElementById('when-field-text');
  if (!el) return;
  const label = formatSelectedDeadline();
  el.textContent = label || 'Без срока';
  el.classList.toggle('placeholder', !label);
}

function openDeadlineSheet() {
  renderDeadlineSheet();
  const overlay = document.getElementById('sheet-overlay');
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('show'));
}
function closeDeadlineSheet() {
  const overlay = document.getElementById('sheet-overlay');
  overlay.classList.remove('show');
  setTimeout(() => { overlay.hidden = true; }, 250);
}

function renderDeadlineSheet() {
  const sheet = document.getElementById('sheet');
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const isCurrentMonth = calViewMonth.getFullYear() === today.getFullYear() && calViewMonth.getMonth() === today.getMonth();

  const firstDay = calViewMonth;
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  let dayCells = '';
  for (let i = 0; i < leadingBlanks; i++) dayCells += `<span class="cal-day empty"></span>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
    const isPast = cellDate < today;
    const isToday = isSameDay(cellDate, today);
    const isSelected = dtState.date && isSameDay(cellDate, dtState.date);
    const cls = ['cal-day'];
    if (isPast) cls.push('muted');
    if (isToday) cls.push('today');
    if (isSelected) cls.push('selected');
    dayCells += `<button type="button" class="${cls.join(' ')}" data-day="${cellDate.toISOString()}" ${isPast ? 'disabled' : ''}>${day}</button>`;
  }

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <p class="sheet-title">Срок выполнения</p>

    <div class="chip-row">
      <button type="button" class="chip ${dtState.date && isSameDay(dtState.date, today) ? 'selected' : ''}" data-quick="today">Сегодня</button>
      <button type="button" class="chip ${dtState.date && isSameDay(dtState.date, tomorrow) ? 'selected' : ''}" data-quick="tomorrow">Завтра</button>
    </div>

    <div class="cal-head">
      <button type="button" class="cal-nav-btn" id="cal-prev" ${isCurrentMonth ? 'disabled' : ''}>‹</button>
      <span class="cal-month">${MONTHS_NOM[firstDay.getMonth()]} ${firstDay.getFullYear()}</span>
      <button type="button" class="cal-nav-btn" id="cal-next">›</button>
    </div>
    <div class="cal-grid">
      ${WEEKDAYS_SHORT.map((w) => `<span class="cal-weekday">${w}</span>`).join('')}
      ${dayCells}
    </div>

    <div class="sheet-actions">
      <button type="button" class="btn ghost" id="dt-clear">Без срока</button>
      <button type="button" class="btn primary" id="dt-done">Готово</button>
    </div>
  `;

  sheet.querySelectorAll('[data-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      dtState.date = new Date(btn.dataset.day);
      renderDeadlineSheet();
    });
  });
  sheet.querySelectorAll('[data-quick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      const target = btn.dataset.quick === 'today' ? today : tomorrow;
      dtState.date = target;
      calViewMonth = startOfMonth(target);
      renderDeadlineSheet();
    });
  });
  document.getElementById('cal-prev').addEventListener('click', () => {
    calViewMonth = new Date(calViewMonth.getFullYear(), calViewMonth.getMonth() - 1, 1);
    renderDeadlineSheet();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calViewMonth = new Date(calViewMonth.getFullYear(), calViewMonth.getMonth() + 1, 1);
    renderDeadlineSheet();
  });
  document.getElementById('dt-clear').addEventListener('click', () => {
    resetDeadlineState();
    updateWhenFieldDisplay();
    closeDeadlineSheet();
  });
  document.getElementById('dt-done').addEventListener('click', () => {
    updateWhenFieldDisplay();
    closeDeadlineSheet();
  });
}

document.getElementById('sheet-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'sheet-overlay') closeDeadlineSheet();
});

/* ===================== Директор: все задачи ===================== */

async function renderAll() {
  view.innerHTML = '<p class="loading">Загрузка…</p>';
  try {
    const tasks = await api('/tasks');
    const filterRow = `
      <div class="chip-row" style="margin-bottom:14px;">
        <button type="button" class="chip ${allFilter === 'all' ? 'selected' : ''}" data-filter="all">Все</button>
        ${employees.map((n) => `<button type="button" class="chip ${allFilter === n ? 'selected' : ''}" data-filter="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('')}
      </div>`;
    const filtered = allFilter === 'all' ? tasks : tasks.filter((t) => t.assignee === allFilter);

    view.innerHTML = filterRow + (filtered.length
      ? `<div class="list">${filtered.map((t) => taskCard(t, { showAssignee: true, canChangeStatus: true, canCancel: true })).join('')}</div>`
      : '<p class="empty">Задач пока нет.</p>');

    view.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        allFilter = btn.dataset.filter;
        renderAll();
      });
    });
    bindTaskCardEvents(view, renderAll);
  } catch (e) {
    view.innerHTML = `<p class="empty">Ошибка: ${escapeHtml(e.message)}</p>`;
  }
}

/* ===================== Сотрудник: мои задачи ===================== */

async function renderMine() {
  view.innerHTML = '<p class="loading">Загрузка…</p>';
  try {
    const tasks = await api('/tasks');
    view.innerHTML = `<p class="whoami">Вы вошли как: <b>${escapeHtml(me.employee_name)}</b> · <button id="change-name">это не я</button></p>` + (tasks.length
      ? `<div class="list">${tasks.map((t) => taskCard(t, { canChangeStatus: true, canCancel: false })).join('')}</div>`
      : '<p class="empty">Пока нет задач для вас.</p>');
    document.getElementById('change-name').addEventListener('click', async () => {
      selectedAssignee = null;
      me.employee_name = null;
      renderOnboarding();
    });
    bindTaskCardEvents(view, renderMine);
  } catch (e) {
    view.innerHTML = `<p class="empty">Ошибка: ${escapeHtml(e.message)}</p>`;
  }
}

/* ===================== Навигация и запуск ===================== */

function switchTab(tab) {
  currentTab = tab;
  tabbar.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'assign') renderAssign();
  if (tab === 'all') renderAll();
}

function setupUiForRole() {
  if (me.isDirector) {
    appSubtitle.textContent = 'Вы раздаёте задачи сотрудникам';
    tabbar.hidden = false;
    tabbar.innerHTML = `
      <button class="tab-btn active" data-tab="assign"><span>➕</span><span>Раздать</span></button>
      <button class="tab-btn" data-tab="all"><span>📋</span><span>Все задачи</span></button>
    `;
    tabbar.querySelectorAll('.tab-btn').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    switchTab('assign');
  } else {
    appSubtitle.textContent = 'Ваши задачи от директора';
    tabbar.hidden = true;
    renderMine();
  }
}

async function boot() {
  view.innerHTML = '<p class="loading">Загрузка…</p>';
  try {
    employees = await api('/employees');
    me = await api('/me');
  } catch (e) {
    view.innerHTML = `<p class="empty">Ошибка: ${escapeHtml(e.message)}</p>`;
    return;
  }

  if (!me.isDirector && !me.employee_name) {
    appSubtitle.textContent = 'Выберите, кто вы';
    tabbar.hidden = true;
    renderOnboarding();
    return;
  }

  setupUiForRole();
}

boot();
