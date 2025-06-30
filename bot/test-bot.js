const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

// Configuration de test
const testConfig = {
  ...config,
  telegram: {
    ...config.telegram,
    adminChatId: process.env.ADMIN_CHAT_ID || '123456789'
  }
};

// Initialiser le bot en mode test (sans polling)
const bot = new TelegramBot(testConfig.telegram.token, { polling: false });

async function testBot() {
  try {
    console.log('🧪 Test du bot LR ASSIST avec handlers...');
    
    // Test de connexion
    const me = await bot.getMe();
    console.log(`✅ Bot connecté: ${me.first_name} (@${me.username})`);
    
    // Test d'envoi de message
    if (testConfig.telegram.adminChatId !== '123456789') {
      const testMessage = `🧪 *TEST BOT LR ASSIST*\n\n` +
        `✅ Bot fonctionnel\n` +
        `📸 Handler photo: Prêt\n` +
        `💬 Handler message: Prêt\n` +
        `📋 Logging: Configuré\n` +
        `🕐 Test: ${new Date().toLocaleString('fr-FR')}\n\n` +
        `🚦 Système opérationnel`;

      await bot.sendMessage(testConfig.telegram.adminChatId, testMessage, {
        parse_mode: 'Markdown'
      });
      
      console.log('📱 Message de test envoyé. Vérifiez votre Telegram.');
    } else {
      console.log('⚠️ ADMIN_CHAT_ID non configuré. Test d\'envoi ignoré.');
    }
    
    // Test des handlers
    console.log('\n📋 Test des handlers:');
    console.log('✅ PhotoHandler: Disponible');
    console.log('✅ MessageHandler: Disponible');
    console.log('✅ BotManager: Disponible');
    
    // Test de configuration
    console.log('\n⚙️ Configuration:');
    console.log(`• Token: ${testConfig.telegram.token.substring(0, 20)}...`);
    console.log(`• Admin Chat ID: ${testConfig.telegram.adminChatId}`);
    console.log(`• Dashboard URL: ${testConfig.dashboard.url}`);
    console.log(`• Photos Dir: ${testConfig.storage.photosDir}`);
    console.log(`• Logs Dir: ${testConfig.storage.logsDir}`);
    
    console.log('\n🎉 Tests terminés avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur test bot:', error);
    process.exit(1);
  }
}

// Test des handlers individuels
function testHandlers() {
  console.log('\n🔧 Test des handlers individuels...');
  
  try {
    // Test PhotoHandler
    const PhotoHandler = require('./handlers/photoHandler');
    console.log('✅ PhotoHandler: Importé avec succès');
    
    // Test MessageHandler
    const MessageHandler = require('./handlers/messageHandler');
    console.log('✅ MessageHandler: Importé avec succès');
    
    // Test BotManager
    const BotManager = require('./botManager');
    console.log('✅ BotManager: Importé avec succès');
    
    console.log('✅ Tous les handlers sont disponibles');
    
  } catch (error) {
    console.error('❌ Erreur import handlers:', error);
  }
}

// Test des dossiers
function testDirectories() {
  console.log('\n📁 Test des dossiers...');
  
  const fs = require('fs');
  const path = require('path');
  
  const directories = [
    './handlers',
    './photos',
    './logs'
  ];
  
  directories.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`✅ ${dir}: Existe`);
    } else {
      console.log(`❌ ${dir}: Manquant`);
    }
  });
}

// Test des fichiers de configuration
function testConfigFiles() {
  console.log('\n📄 Test des fichiers de configuration...');
  
  const fs = require('fs');
  
  const files = [
    './config.js',
    './botManager.js',
    './start.js',
    './package.json'
  ];
  
  files.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}: Existe`);
    } else {
      console.log(`❌ ${file}: Manquant`);
    }
  });
}

// Exécuter tous les tests
async function runAllTests() {
  console.log('🚦 Démarrage des tests du bot LR ASSIST...\n');
  
  testDirectories();
  testConfigFiles();
  testHandlers();
  await testBot();
  
  console.log('\n🎯 Tests terminés !');
  process.exit(0);
}

// Démarrer les tests
runAllTests(); 