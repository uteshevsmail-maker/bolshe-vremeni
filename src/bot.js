require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

function createBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN не задан в .env');

  const webAppUrl = process.env.WEBAPP_URL;
  if (!webAppUrl) throw new Error('WEBAPP_URL не задан в .env');

  const bot = new Telegraf(token);

  const openAppKeyboard = Markup.inlineKeyboard([
    Markup.button.webApp('🚀 Открыть «Больше времени»', webAppUrl),
  ]);

  bot.start(async (ctx) => {
    await ctx.reply(
      [
        'Привет! 👋',
        '',
        '«Больше времени» — сервис бытовых поручений: выгулять собаку, забрать',
        'посылку с ПВЗ, сходить в магазин, постоять в очереди и другие мелкие дела.',
        '',
        'Опубликуйте заказ или откликнитесь на чужой — прямо в мини-приложении.',
      ].join('\n'),
      openAppKeyboard
    );
  });

  bot.command('app', async (ctx) => {
    await ctx.reply('Открыть приложение:', openAppKeyboard);
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      'Команды:\n/start — начать\n/app — открыть мини-приложение',
      openAppKeyboard
    );
  });

  // Кнопка меню рядом с полем ввода — открывает Mini App в один тап
  bot.telegram
    .setChatMenuButton({
      menuButton: { type: 'web_app', text: 'Больше времени', web_app: { url: webAppUrl } },
    })
    .catch((e) => console.error('Не удалось установить menu button:', e.message));

  return bot;
}

module.exports = { createBot };
