module.exports = {
  telegram: {
    token: process.env.TELEGRAM_TOKEN || '7583644274:AAHp6JF7VDa9ycKiSPSTs4apS512euatZMw',
    adminChatId: process.env.ADMIN_CHAT_ID || '123456789', // Remplacez par votre ID de chat admin
    webhookUrl: process.env.WEBHOOK_URL || null
  },
  
  dashboard: {
    url: process.env.DASHBOARD_URL || 'http://localhost:3000',
    enabled: process.env.DASHBOARD_ENABLED !== 'false'
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'bot/logs/bot.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_MAX_FILES || 5
  },
  
  photos: {
    maxSize: process.env.PHOTO_MAX_SIZE || 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
    quality: process.env.PHOTO_QUALITY || 'high'
  },
  
  security: {
    allowedUsers: process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',') : [],
    requireAuth: process.env.REQUIRE_AUTH === 'true',
    emergencyNumbers: process.env.EMERGENCY_NUMBERS ? process.env.EMERGENCY_NUMBERS.split(',') : ['112', '18']
  },
  
  railway: {
    apiUrl: process.env.RAILWAY_API_URL || 'https://api.sncf.com',
    apiKey: process.env.RAILWAY_API_KEY || '',
    maxDistance: process.env.MAX_DISTANCE || 2000 // mètres
  },
  
  storage: {
    photosDir: process.env.PHOTOS_DIR || 'bot/photos',
    logsDir: process.env.LOGS_DIR || 'bot/logs',
    dataFile: process.env.DATA_FILE || 'data.json'
  },
  
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    clientId: process.env.FIREBASE_CLIENT_ID,
    authUri: process.env.FIREBASE_AUTH_URI,
    tokenUri: process.env.FIREBASE_TOKEN_URI,
    authProviderX509CertUrl: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    clientX509CertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL
  }
}; 