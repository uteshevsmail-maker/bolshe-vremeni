const crypto = require('crypto');

/**
 * Проверяет initData, которую Telegram Mini App передаёт клиенту,
 * по алгоритму из документации Telegram:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Возвращает объект пользователя Telegram, если подпись верна, иначе null.
 */
function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  if (!hash) return null;
  urlParams.delete('hash');

  const pairs = [];
  for (const key of [...urlParams.keys()].sort()) {
    pairs.push(`${key}=${urlParams.get(key)}`);
  }
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return null;

  // На всякий случай отбрасываем совсем старые initData (> 24ч)
  const authDate = Number(urlParams.get('auth_date') || 0);
  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > 86400) return null;

  const userRaw = urlParams.get('user');
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

module.exports = { validateInitData };
