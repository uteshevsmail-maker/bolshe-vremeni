const fs = require('fs');
const path = require('path');

// Простое хранилище на файле data.json — без нативных модулей и компиляции,
// поэтому работает одинаково на Windows/Mac/Linux без установки Python
// и инструментов сборки C++.

const DATA_FILE = path.join(__dirname, '..', 'data.json');

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error('Не удалось прочитать data.json, начинаю с чистого файла:', e.message);
    }
  }
  return { users: {}, orders: [], nextOrderId: 1 };
}

const data = loadData();

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function upsertUser(user) {
  data.users[user.id] = {
    id: user.id,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
  };
  save();
}

function getUser(id) {
  return data.users[id] || null;
}

function attachUsers(order) {
  const customer = getUser(order.customer_id) || {};
  const executor = order.executor_id ? getUser(order.executor_id) : null;
  return {
    ...order,
    customer_username: customer.username || null,
    customer_name: customer.first_name || null,
    executor_username: executor ? executor.username || null : null,
    executor_name: executor ? executor.first_name || null : null,
  };
}

function createOrder({ customer_id, category, description, address, price, when_text }) {
  const now = new Date().toISOString();
  const order = {
    id: data.nextOrderId++,
    customer_id,
    executor_id: null,
    category,
    description,
    address: address || null,
    price: price || null,
    when_text: when_text || null,
    status: 'open',
    created_at: now,
    updated_at: now,
  };
  data.orders.push(order);
  save();
  return attachUsers(order);
}

function getOrder(id) {
  const order = data.orders.find((o) => o.id === Number(id));
  return order || null;
}

function listOpenOrders() {
  return data.orders
    .filter((o) => o.status === 'open')
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(attachUsers);
}

function listMyOrders(userId) {
  return data.orders
    .filter((o) => o.customer_id === userId || o.executor_id === userId)
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(attachUsers);
}

function takeOrder(id, executorId) {
  const order = getOrder(id);
  if (!order) return null;
  order.status = 'in_progress';
  order.executor_id = executorId;
  order.updated_at = new Date().toISOString();
  save();
  return attachUsers(order);
}

function setOrderStatus(id, status) {
  const order = getOrder(id);
  if (!order) return null;
  order.status = status;
  order.updated_at = new Date().toISOString();
  save();
  return attachUsers(order);
}

module.exports = {
  upsertUser,
  getUser,
  createOrder,
  getOrder,
  listOpenOrders,
  listMyOrders,
  takeOrder,
  setOrderStatus,
};
