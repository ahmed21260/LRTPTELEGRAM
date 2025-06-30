require('dotenv').config();

module.exports = {
  // Telegram Configuration
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '7583644274:AAHp6JF7VDa9ycKiSPSTs4apS512euatZMw',
    adminChatId: process.env.ADMIN_CHAT_ID || 7648184043
  },

  // Firebase Configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'telegr-railway',
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    clientId: process.env.FIREBASE_CLIENT_ID,
    authUri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    tokenUri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    authProviderX509CertUrl: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
    clientX509CertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL
  },

  // Geoportail SNCF API
  geoportal: {
    apiKey: process.env.GEOPORTAL_API_KEY,
    baseUrl: process.env.GEOPORTAL_BASE_URL || 'https://api.geoportail.gouv.fr'
  },

  // Application Settings
  app: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    dataPath: './data.json',
    photoDir: './data/photos'
  }
};