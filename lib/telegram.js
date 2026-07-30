const axios = require('axios');
const config = require('./config');

async function sendTelegramMessage(message) {
  if (!config.telegram.enabled || !config.telegram.botToken || !config.telegram.chatId) {
    return false;
  }
  try {
    await axios.post(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
      chat_id: config.telegram.chatId,
      text: message,
      parse_mode: 'HTML',
    });
    return true;
  } catch (err) {
    console.error('Telegram send error:', err.message);
    return false;
  }
}

function getBrowserAndOS(ua) {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'Internet Explorer';

  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'Mac OS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';

  return { browser, os };
}

function getRealIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const cf = req.headers['cf-connecting-ip'];
  const real = req.headers['x-real-ip'];

  if (cf) return cf;
  if (forwarded) return forwarded.split(',')[0].trim();
  if (real) return real;
  return req.ip || req.connection.remoteAddress || '127.0.0.1';
}

module.exports = { sendTelegramMessage, getBrowserAndOS, getRealIP };
