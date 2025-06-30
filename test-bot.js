const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Configuration simple pour test
const config = {
  telegram: {
    token: '7583644274:AAHp6JF7VDa9ycKiSPSTs4apS512euatZMw',
    adminChatId: 7648184043
  }
};

// Initialize bot without polling
const bot = new TelegramBot(config.telegram.token, { polling: false });

// Menu principal
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📸 Envoyer une photo', '📍 Partager ma position'],
      ['✅ Checklist sécurité', '⚠️ Déclencher une urgence'],
      ['🚨 Mise hors voie urgente', '🚪 Portail d\'accès SNCF'],
      ['📘 Fiches techniques', 'ℹ️ Aide'],
      ['📊 Historique', '🔧 Paramètres']
    ],
    resize_keyboard: true
  }
};

// Test function to send menu
async function testBot() {
  try {
    console.log('🧪 Test du bot LR ASSIST...');
    
    // Test sending message to admin
    const testMessage = `🧪 *TEST BOT LR ASSIST*\n\n` +
      `✅ Bot fonctionnel\n` +
      `🚦 Fonctionnalités d'urgence activées\n` +
      `🚪 Portails d'accès SNCF disponibles\n` +
      `📍 Géométrie ferroviaire précise\n\n` +
      `Test effectué le: ${new Date().toLocaleString('fr-FR')}`;
    
    await bot.sendMessage(config.telegram.adminChatId, testMessage, {
      parse_mode: 'Markdown',
      ...mainMenu
    });
    
    console.log('✅ Test réussi ! Menu envoyé à l\'administrateur.');
    console.log('📱 Vérifiez votre Telegram pour voir le menu.');
    
  } catch (error) {
    console.error('❌ Erreur test bot:', error);
  }
}

// Run test
testBot(); 