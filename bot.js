const fs = require('fs');
const path = require('path');

// Простое хранилище на файле data.json — без нативных модулей и компиляции,
// поэтому работает одинаково на Windows/Mac/Linux без установки Python
// и инструментов сборки C++.

const DATA_FILE = path.join(__dirname, '..', 'data.json');

const EMPLOYEES = ['Рената', 'Дарья', 'Замир', 'Маден', 'Асхат', 'Виктория'];

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error('Не удалось прочитать data.json, начинаю с чистого файла:', e.message);
    }
  }
  return { users: {}, tasks: [], nextTaskId: 1 };
}

const data = loadData();
// На случай обновления со старой версии хранилища (заказы услуг).
if (!Array.isArray(data.tasks)) data.tasks = [];
if (!data.nextTaskId) data.nextTaskId = 1;

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function upsertUser(user) {
  const existing = data.users[user.id] || {};
  data.users[user.id] = {
    id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    employee_name: existing.employee_name || null,
  };
  save();
  return data.users[user.id];
}

function getUser(id) {
  return data.users[id] || null;
}

function setEmployeeName(userId, name) {
  if (!EMPLOYEES.includes(name)) return null;
  const user = data.users[userId];
  if (!user) return null;
  user.employee_name = name;
  save();
  return user;
}

function attachAuthors(task) {
  const author = getUser(task.created_by) || {};
  return {
    ...task,
    created_by_name: author.first_name || null,
    comments: (task.comments || []).map((c) => ({ ...c })),
  };
}

function createTask({ title, description, assignee, deadline, created_by }) {
  const now = new Date().toISOString();
  const task = {
    id: data.nextTaskId++,
    title,
    description: description || null,
    assignee,
    deadline: deadline || null,
    status: 'new',
    comments: [],
    created_by,
    created_at: now,
    updated_at: now,
  };
  data.tasks.push(task);
  save();
  return attachAuthors(task);
}

function getTask(id) {
  const task = data.tasks.find((t) => t.id === Number(id));
  return task || null;
}

function listAllTasks() {
  return data.tasks
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(attachAuthors);
}

function listTasksForEmployee(name) {
  return data.tasks
    .filter((t) => t.assignee === name)
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(attachAuthors);
}

function setTaskStatus(id, status) {
  const task = getTask(id);
  if (!task) return null;
  task.status = status;
  task.updated_at = new Date().toISOString();
  save();
  return attachAuthors(task);
}

function addComment(id, { author_id, author_name, text }) {
  const task = getTask(id);
  if (!task) return null;
  task.comments.push({
    author_id,
    author_name: author_name || 'Пользователь',
    text,
    at: new Date().toISOString(),
  });
  task.updated_at = new Date().toISOString();
  save();
  return attachAuthors(task);
}

module.exports = {
  EMPLOYEES,
  upsertUser,
  getUser,
  setEmployeeName,
  createTask,
  getTask,
  listAllTasks,
  listTasksForEmployee,
  setTaskStatus,
  addComment,
};
