const BotManager = require('./botManager');
const config = require('./config');

// Gestion des signaux pour arrêt propre
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du bot...');
  if (global.botManager) {
    global.botManager.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt du bot...');
  if (global.botManager) {
    global.botManager.stop();
  }
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur non capturée:', error);
  if (global.botManager) {
    global.botManager.stop();
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  if (global.botManager) {
    global.botManager.stop();
  }
  process.exit(1);
});

async function startBot() {
  try {
    console.log('🚦 Démarrage du bot LR ASSIST avec handlers améliorés...');
    
    // Créer et initialiser le gestionnaire de bot
    global.botManager = new BotManager(config);
    
    console.log('✅ Bot démarré avec succès');
    console.log('📸 Handler photo: Actif');
    console.log('💬 Handler message: Actif');
    console.log('📋 Logging: Activé');
    console.log('🕐 Horodatage:', new Date().toLocaleString('fr-FR'));
    
    // Afficher les informations de configuration
    console.log('\n📋 Configuration:');
    console.log(`• Token: ${config.telegram.token.substring(0, 20)}...`);
    console.log(`• Admin Chat ID: ${config.telegram.adminChatId}`);
    console.log(`• Dashboard URL: ${config.dashboard.url}`);
    console.log(`• Photos Dir: ${config.storage.photosDir}`);
    console.log(`• Logs Dir: ${config.storage.logsDir}`);
    
    console.log('\n🤖 Le bot est maintenant en écoute...');
    console.log('📱 Envoyez /start sur Telegram pour commencer');
    
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du bot:', error);
    process.exit(1);
  }
}

// Démarrer le bot
startBot(); 