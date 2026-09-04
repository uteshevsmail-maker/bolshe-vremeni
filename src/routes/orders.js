const express = require('express');
const db = require('../db');
const { validateInitData } = require('../auth');

const router = express.Router();

const CATEGORIES = [
  { id: 'dog_walk', label: 'Выгулять собаку', emoji: '🐕' },
  { id: 'pvz', label: 'Забрать с ПВЗ', emoji: '📦' },
  { id: 'groceries', label: 'Купить продукты', emoji: '🛒' },
  { id: 'cleaning', label: 'Уборка', emoji: '🧹' },
  { id: 'queue', label: 'Постоять в очереди', emoji: '⏳' },
  { id: 'other', label: 'Другое поручение', emoji: '✋' },
];

// Проверяем подпись Telegram на каждый запрос к API.
// DEV_NO_AUTH=1 в .env позволяет открыть API из обычного браузера при локальной разработке.
router.use((req, res, next) => {
  const initData = req.header('X-Telegram-Init-Data') || '';
  const user = validateInitData(initData, process.env.BOT_TOKEN);

  if (!user) {
    if (process.env.DEV_NO_AUTH === '1') {
      req.tgUser = { id: 1, username: 'dev', first_name: 'Тест' };
      return next();
    }
    return res.status(401).json({ error: 'Не удалось подтвердить пользователя Telegram' });
  }

  db.upsertUser(user);
  req.tgUser = user;
  next();
});

router.get('/categories', (req, res) => {
  res.json(CATEGORIES);
});

router.get('/me', (req, res) => {
  res.json(req.tgUser);
});

router.post('/orders', (req, res) => {
  const { category, description, address, price, when_text } = req.body;

  if (!category || !description || !String(description).trim()) {
    return res.status(400).json({ error: 'Укажите категорию и описание заказа' });
  }
  if (!CATEGORIES.find((c) => c.id === category)) {
    return res.status(400).json({ error: 'Неизвестная категория' });
  }

  const order = db.createOrder({
    customer_id: req.tgUser.id,
    category,
    description: String(description).trim(),
    address: address || null,
    price: price ? Math.max(0, Number(price)) : null,
    when_text: when_text || null,
  });

  res.status(201).json(order);
});

router.get('/orders', (req, res) => {
  const scope = req.query.scope || 'open';

  if (scope === 'open') {
    return res.json(db.listOpenOrders());
  }
  if (scope === 'mine') {
    return res.json(db.listMyOrders(req.tgUser.id));
  }
  return res.status(400).json({ error: 'Некорректный scope' });
});

router.post('/orders/:id/take', (req, res) => {
  const order = db.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (order.status !== 'open') return res.status(409).json({ error: 'Заказ уже не свободен' });
  if (order.customer_id === req.tgUser.id) {
    return res.status(400).json({ error: 'Нельзя откликнуться на свой заказ' });
  }

  const updated = db.takeOrder(req.params.id, req.tgUser.id);
  res.json(updated);
});

router.post('/orders/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['done', 'cancelled', 'open'].includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус' });
  }

  const order = db.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (order.customer_id !== req.tgUser.id && order.executor_id !== req.tgUser.id) {
    return res.status(403).json({ error: 'Нет доступа к этому заказу' });
  }

  const updated = db.setOrderStatus(req.params.id, status);
  res.json(updated);
});

module.exports = router;
