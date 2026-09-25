const express = require('express');
const db = require('../db');
const { validateInitData } = require('../auth');

const router = express.Router();

const STATUSES = ['new', 'in_progress', 'done', 'cancelled'];

function isDirector(tgUser) {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) return false;
  return Number(tgUser.id) === Number(adminId);
}

// Проверяем подпись Telegram на каждый запрос к API.
// DEV_NO_AUTH=1 в .env позволяет открыть API из обычного браузера при локальной разработке.
router.use((req, res, next) => {
  const initData = req.header('X-Telegram-Init-Data') || '';
  const user = validateInitData(initData, process.env.BOT_TOKEN);

  if (!user) {
    if (process.env.DEV_NO_AUTH === '1') {
      req.tgUser = { id: 1, username: 'dev', first_name: 'Тест' };
    } else {
      return res.status(401).json({ error: 'Не удалось подтвердить пользователя Telegram' });
    }
  } else {
    req.tgUser = user;
  }

  db.upsertUser(req.tgUser);
  req.isDirector = isDirector(req.tgUser);
  next();
});

router.get('/employees', (req, res) => {
  res.json(db.EMPLOYEES);
});

router.get('/me', (req, res) => {
  const stored = db.getUser(req.tgUser.id) || {};
  res.json({
    ...req.tgUser,
    isDirector: req.isDirector,
    employee_name: stored.employee_name || null,
  });
});

router.post('/me/employee', (req, res) => {
  if (req.isDirector) {
    return res.status(400).json({ error: 'Директору выбирать сотрудника не нужно' });
  }
  const { employee_name } = req.body;
  if (!db.EMPLOYEES.includes(employee_name)) {
    return res.status(400).json({ error: 'Неизвестное имя сотрудника' });
  }
  const updated = db.setEmployeeName(req.tgUser.id, employee_name);
  res.json({ employee_name: updated.employee_name });
});

router.post('/tasks', (req, res) => {
  if (!req.isDirector) {
    return res.status(403).json({ error: 'Только директор может раздавать задачи' });
  }
  const { title, description, assignee, deadline } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Укажите название задачи' });
  }
  if (!db.EMPLOYEES.includes(assignee)) {
    return res.status(400).json({ error: 'Выберите сотрудника из списка' });
  }

  const task = db.createTask({
    title: String(title).trim(),
    description: description ? String(description).trim() : null,
    assignee,
    deadline: deadline || null,
    created_by: req.tgUser.id,
  });

  res.status(201).json(task);
});

router.get('/tasks', (req, res) => {
  if (req.isDirector) {
    return res.json(db.listAllTasks());
  }
  const stored = db.getUser(req.tgUser.id) || {};
  if (!stored.employee_name) {
    return res.status(400).json({ error: 'Сначала выберите, кто вы' });
  }
  res.json(db.listTasksForEmployee(stored.employee_name));
});

function canAccessTask(req, task) {
  if (!task) return false;
  if (req.isDirector) return true;
  const stored = db.getUser(req.tgUser.id) || {};
  return stored.employee_name && stored.employee_name === task.assignee;
}

router.post('/tasks/:id/status', (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус' });
  }
  const task = db.getTask(req.params.id);
  if (!canAccessTask(req, task)) {
    return res.status(403).json({ error: 'Нет доступа к этой задаче' });
  }
  if (status === 'cancelled' && !req.isDirector) {
    return res.status(403).json({ error: 'Отменить задачу может только директор' });
  }
  const updated = db.setTaskStatus(req.params.id, status);
  res.json(updated);
});

router.post('/tasks/:id/comment', (req, res) => {
  const { text } = req.body;
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Пустой комментарий' });
  }
  const task = db.getTask(req.params.id);
  if (!canAccessTask(req, task)) {
    return res.status(403).json({ error: 'Нет доступа к этой задаче' });
  }
  const stored = db.getUser(req.tgUser.id) || {};
  const authorName = req.isDirector
    ? 'Директор'
    : stored.employee_name || req.tgUser.first_name || 'Сотрудник';
  const updated = db.addComment(req.params.id, {
    author_id: req.tgUser.id,
    author_name: authorName,
    text: String(text).trim(),
  });
  res.json(updated);
});

module.exports = router;
