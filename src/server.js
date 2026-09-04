require('dotenv').config();
const express = require('express');
const path = require('path');
const { createBot } = require('./bot');
const ordersRouter = require('./routes/orders');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', ordersRouter);

const PORT = process.env.PORT || 3000;

async function main() {
  const bot = createBot();

  if (process.env.WEBHOOK_URL) {
    // Продакшен-режим: Telegram сам стучится к нам по HTTPS
    const secretPath = `/tg/${bot.secretPathComponent()}`;
    app.use(bot.webhookCallback(secretPath));
    app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
    await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}${secretPath}`);
    console.log('Бот работает через webhook:', process.env.WEBHOOK_URL + secretPath);
  } else {
    // Простой режим для разработки/небольшого запуска: long polling
    app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
    await bot.launch();
    console.log('Бот работает через long polling');
  }

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('Ошибка запуска:', err);
  process.exit(1);
});
