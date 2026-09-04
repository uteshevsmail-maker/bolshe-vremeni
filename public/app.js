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

const CATEGORY_FALLBACK = [
  { id: 'dog_walk', label: 'Выгулять собаку', emoji: '🐕' },
  { id: 'pvz', label: 'Забрать с ПВЗ', emoji: '📦' },
  { id: 'groceries', label: 'Купить продукты', emoji: '🛒' },
  { id: 'cleaning', label: 'Уборка', emoji: '🧹' },
  { id: 'queue', label: 'Постоять в очереди', emoji: '⏳' },
  { id: 'other', label: 'Другое поручение', emoji: '✋' },
];
let categories = CATEGORY_FALLBACK;
let selectedCategory = null;

const view = document.getElementById('view');
const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

function switchTab(tab) {
  tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'feed') renderFeed();
  if (tab === 'create') renderCreate();
  if (tab === 'mine') renderMine();
}

function statusLabel(s) {
  return { open: 'Открыт', in_progress: 'В работе', done: 'Выполнен', cancelled: 'Отменён' }[s] || s;
}
function categoryInfo(id) {
  return categories.find((c) => c.id === id) || { label: id, emoji: '✋' };
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

function orderCard(o, opts = {}) {
  const { showTake = false, showManage = false } = opts;
  const c = categoryInfo(o.category);
  const meta = [
    o.address ? `📍 ${escapeHtml(o.address)}` : null,
    o.when_text ? `🕒 ${escapeHtml(o.when_text)}` : null,
    o.price ? `💰 ${o.price} ₽` : null,
  ].filter(Boolean).join(' · ');

  const author = o.customer_username ? '@' + o.customer_username : (o.customer_name || 'пользователь');
  const executor = o.executor_username ? '@' + o.executor_username : o.executor_name;

  let actions = '';
  if (showTake) {
    actions = `<button class="btn small" data-take="${o.id}">Откликнуться</button>`;
  } else if (showManage && (o.status === 'open' || o.status === 'in_progress')) {
    actions = `<div class="card-actions">
      <button class="btn small" data-done="${o.id}">Готово</button>
      <button class="btn small ghost" data-cancel="${o.id}">Отменить</button>
    </div>`;
  }

  return `
    <div class="card">
      <div class="card-top">
        <span class="badge">${c.emoji} ${escapeHtml(c.label)}</span>
        <span class="status status-${o.status}">${statusLabel(o.status)}</span>
      </div>
      <p class="desc">${escapeHtml(o.description)}</p>
      ${meta ? `<p class="meta">${meta}</p>` : ''}
      <p class="author">от ${escapeHtml(author)}${executor ? ` · исполнитель: ${escapeHtml(executor)}` : ''}</p>
      ${actions}
    </div>`;
}

async function renderFeed() {
  view.innerHTML = '<p class="loading">Загрузка…</p>';
  try {
    const orders = await api('/orders?scope=open');
    if (!orders.length) {
      view.innerHTML = '<p class="empty">Пока нет открытых заказов.<br>Стань первым — вкладка «Создать».</p>';
      return;
    }
    view.innerHTML = `<div class="list">${orders.map((o) => orderCard(o, { showTake: true })).join('')}</div>`;
    view.querySelectorAll('[data-take]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/orders/${btn.dataset.take}/take`, { method: 'POST' });
          haptic('success');
          showToast('Вы откликнулись на заказ!');
          renderFeed();
        } catch (e) {
          haptic('error');
          showToast(e.message);
        }
      });
    });
  } catch (e) {
    view.innerHTML = `<p class="empty">Ошибка: ${escapeHtml(e.message)}</p>`;
  }
}

/* ===================== Создание заказа ===================== */

async function renderCreate() {
  try {
    categories = await api('/categories');
  } catch {
    // используем CATEGORY_FALLBACK
  }
  selectedCategory = selectedCategory || categories[0].id;

  view.innerHTML = `
    <div class="cat-grid">
      ${categories.map((c) => `
        <button type="button" class="cat-btn ${c.id === selectedCategory ? 'selected' : ''}" data-cat="${c.id}">
          <span class="cat-emoji">${c.emoji}</span>
          <span>${escapeHtml(c.label)}</span>
        </button>`).join('')}
    </div>
    <form id="order-form" class="form">
      <label>Что нужно сделать
        <textarea name="description" placeholder="Опишите поручение подробнее" required></textarea>
      </label>
      <label>Адрес
        <input name="address" placeholder="Куда прийти" />
      </label>
      <label>Когда
        <button type="button" id="when-field" class="field-btn">
          <span id="when-field-text" class="placeholder">Выбрать дату и время</span>
          <span class="chev">📅</span>
        </button>
      </label>
      <label>Бюджет, ₽
        <input name="price" type="number" min="0" placeholder="Необязательно" />
      </label>
      <button type="submit" class="btn primary">Опубликовать заказ</button>
    </form>
  `;

  view.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      selectedCategory = btn.dataset.cat;
      view.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('selected', b === btn));
    });
  });

  document.getElementById('when-field').addEventListener('click', openDateTimeSheet);
  updateWhenFieldDisplay();

  document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          category: selectedCategory,
          description: fd.get('description'),
          address: fd.get('address'),
          when_text: formatSelectedDateTime() || '',
          price: fd.get('price') || null,
        }),
      });
      haptic('success');
      showToast('Заказ опубликован!');
      e.target.reset();
      resetDateTimeState();
      switchTab('feed');
    } catch (err) {
      haptic('error');
      showToast(err.message);
    }
  });
}

/* ===================== Выбор даты и времени ===================== */

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const TIME_PRESETS = ['09:00', '12:00', '15:00', '18:00', '20:00'];

let dtState = { mode: null, date: null, time: null }; // mode: 'asap' | 'date' | null
let calViewMonth = startOfMonth(new Date());

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function addDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function resetDateTimeState() {
  dtState = { mode: null, date: null, time: null };
  calViewMonth = startOfMonth(new Date());
}

function formatSelectedDateTime() {
  if (dtState.mode === 'asap') return 'Как можно скорее';
  if (!dtState.date) return null;

  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  let datePart;
  if (isSameDay(dtState.date, today)) datePart = 'сегодня';
  else if (isSameDay(dtState.date, tomorrow)) datePart = 'завтра';
  else {
    const wd = WEEKDAYS_SHORT[(dtState.date.getDay() + 6) % 7];
    datePart = `${wd}, ${dtState.date.getDate()} ${MONTHS_GEN[dtState.date.getMonth()]}`;
  }
  return dtState.time ? `${datePart} · ${dtState.time}` : datePart;
}

function updateWhenFieldDisplay() {
  const el = document.getElementById('when-field-text');
  if (!el) return;
  const label = formatSelectedDateTime();
  el.textContent = label ? label[0].toUpperCase() + label.slice(1) : 'Выбрать дату и время';
  el.classList.toggle('placeholder', !label);
}

function openDateTimeSheet() {
  renderSheet();
  const overlay = document.getElementById('sheet-overlay');
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('show'));
}

function closeDateTimeSheet() {
  const overlay = document.getElementById('sheet-overlay');
  overlay.classList.remove('show');
  setTimeout(() => { overlay.hidden = true; }, 250);
}

function renderSheet() {
  const sheet = document.getElementById('sheet');
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const isCurrentMonth = calViewMonth.getFullYear() === today.getFullYear() && calViewMonth.getMonth() === today.getMonth();

  // сетка дней месяца, понедельник — первый день недели
  const firstDay = calViewMonth;
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  let dayCells = '';
  for (let i = 0; i < leadingBlanks; i++) {
    dayCells += `<span class="cal-day empty"></span>`;
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
    const isPast = cellDate < today;
    const isToday = isSameDay(cellDate, today);
    const isSelected = dtState.mode === 'date' && dtState.date && isSameDay(cellDate, dtState.date);
    const cls = ['cal-day'];
    if (isPast) cls.push('muted');
    if (isToday) cls.push('today');
    if (isSelected) cls.push('selected');
    dayCells += `<button type="button" class="${cls.join(' ')}" data-day="${cellDate.toISOString()}" ${isPast ? 'disabled' : ''}>${day}</button>`;
  }

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <p class="sheet-title">Когда нужно сделать</p>

    <div class="chip-row">
      <button type="button" class="chip ${dtState.mode === 'asap' ? 'selected' : ''}" data-quick="asap">🚀 Как можно скорее</button>
      <button type="button" class="chip ${dtState.mode === 'date' && dtState.date && isSameDay(dtState.date, today) ? 'selected' : ''}" data-quick="today">Сегодня</button>
      <button type="button" class="chip ${dtState.mode === 'date' && dtState.date && isSameDay(dtState.date, tomorrow) ? 'selected' : ''}" data-quick="tomorrow">Завтра</button>
    </div>

    <p class="sheet-section-title">Дата</p>
    <div class="cal-head">
      <button type="button" class="cal-nav-btn" id="cal-prev" ${isCurrentMonth ? 'disabled' : ''}>‹</button>
      <span class="cal-month">${MONTHS_NOM[firstDay.getMonth()]} ${firstDay.getFullYear()}</span>
      <button type="button" class="cal-nav-btn" id="cal-next">›</button>
    </div>
    <div class="cal-grid">
      ${WEEKDAYS_SHORT.map((w) => `<span class="cal-weekday">${w}</span>`).join('')}
      ${dayCells}
    </div>

    <p class="sheet-section-title">Время (необязательно)</p>
    <div class="chip-row">
      ${TIME_PRESETS.map((t) => `<button type="button" class="chip ${dtState.time === t ? 'selected' : ''}" data-time="${t}">${t}</button>`).join('')}
    </div>
    <div class="time-custom">
      <input type="time" id="time-custom-input" value="${dtState.time && !TIME_PRESETS.includes(dtState.time) ? dtState.time : ''}" placeholder="Своё время" />
    </div>

    <div class="sheet-actions">
      <button type="button" class="btn ghost" id="dt-clear">Очистить</button>
      <button type="button" class="btn primary" id="dt-done">Готово</button>
    </div>
  `;

  sheet.querySelectorAll('[data-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      dtState.mode = 'date';
      dtState.date = new Date(btn.dataset.day);
      renderSheet();
    });
  });

  sheet.querySelectorAll('[data-quick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      const kind = btn.dataset.quick;
      if (kind === 'asap') {
        dtState.mode = dtState.mode === 'asap' ? null : 'asap';
        dtState.date = null;
      } else {
        const target = kind === 'today' ? today : tomorrow;
        dtState.mode = 'date';
        dtState.date = target;
        calViewMonth = startOfMonth(target);
      }
      renderSheet();
    });
  });

  sheet.querySelectorAll('[data-time]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic('light');
      dtState.time = dtState.time === btn.dataset.time ? null : btn.dataset.time;
      renderSheet();
    });
  });

  document.getElementById('time-custom-input').addEventListener('change', (e) => {
    dtState.time = e.target.value || null;
  });

  document.getElementById('cal-prev').addEventListener('click', () => {
    calViewMonth = new Date(calViewMonth.getFullYear(), calViewMonth.getMonth() - 1, 1);
    renderSheet();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calViewMonth = new Date(calViewMonth.getFullYear(), calViewMonth.getMonth() + 1, 1);
    renderSheet();
  });

  document.getElementById('dt-clear').addEventListener('click', () => {
    resetDateTimeState();
    updateWhenFieldDisplay();
    closeDateTimeSheet();
  });
  document.getElementById('dt-done').addEventListener('click', () => {
    updateWhenFieldDisplay();
    closeDateTimeSheet();
  });
}

document.getElementById('sheet-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'sheet-overlay') closeDateTimeSheet();
});

/* ===================== Мои заказы ===================== */

async function renderMine() {
  view.innerHTML = '<p class="loading">Загрузка…</p>';
  try {
    const orders = await api('/orders?scope=mine');
    if (!orders.length) {
      view.innerHTML = '<p class="empty">У вас пока нет заказов.</p>';
      return;
    }
    view.innerHTML = `<div class="list">${orders.map((o) => orderCard(o, { showManage: true })).join('')}</div>`;
    view.querySelectorAll('[data-done]').forEach((b) =>
      b.addEventListener('click', () => updateStatus(b.dataset.done, 'done'))
    );
    view.querySelectorAll('[data-cancel]').forEach((b) =>
      b.addEventListener('click', () => updateStatus(b.dataset.cancel, 'cancelled'))
    );
  } catch (e) {
    view.innerHTML = `<p class="empty">Ошибка: ${escapeHtml(e.message)}</p>`;
  }
}

async function updateStatus(id, status) {
  try {
    await api(`/orders/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    haptic('success');
    showToast(status === 'done' ? 'Отмечено как выполнено' : 'Заказ отменён');
    renderMine();
  } catch (e) {
    haptic('error');
    showToast(e.message);
  }
}

(async () => {
  try {
    categories = await api('/categories');
  } catch {
    // используем CATEGORY_FALLBACK
  }
  renderFeed();
})();
