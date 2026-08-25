import 'dotenv/config';

export const config = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/brandmarketian',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  corsOrigin: (process.env.CORS_ORIGIN || '*').split(','),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    notifyTo: process.env.LEAD_NOTIFY_TO || 'growth@brandmarketian.com'
  },
  whatsapp: {
    phoneId: process.env.WA_PHONE_ID,
    token: process.env.WA_TOKEN,
    to: process.env.WA_NOTIFY_TO
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'growth@brandmarketian.com',
    password: process.env.ADMIN_PASSWORD || 'changeme123'
  }
};
