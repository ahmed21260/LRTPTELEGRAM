const TelegramBot = require('node-telegram-bot-api');

// Configuration
const config = {
  telegram: {
    token: '7583644274:AAHp6JF7VDa9ycKiSPSTs4apS512euatZMw',
    adminChatId: 7648184043
  }
};

// Initialize bot without polling
const bot = new TelegramBot(config.telegram.token, { polling: false });

// Menu principal avec toutes les fonctionnalités
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

// Fonction pour envoyer le menu de démarrage
async function sendStartMenu() {
  try {
    console.log('🚦 Envoi du menu de démarrage LR ASSIST...');
    
    const welcome = `👋 Bonjour, bienvenue sur *LR ASSIST* !\n\n` +
      `🚦 Application de terrain pour opérateurs ferroviaires\n` +
      `📱 Fonctionnalités disponibles:\n\n` +
      `📸 *Photo* : Signalement avec métadonnées\n` +
      `📍 *Position* : GPS avec calcul PK SNCF précis\n` +
      `✅ *Checklist* : Étapes sécurité avant intervention\n` +
      `⚠️ *Urgence* : Déclenche alerte immédiate\n` +
      `🚨 *Mise hors voie* : Procédure d'urgence avec portail d'accès\n` +
      `🚪 *Portail d'accès* : Trouve le point d'accès SNCF le plus proche\n` +
      `📘 *Fiches techniques* : Documents machines ferroviaires\n` +
      `📊 *Historique* : Consultation actions récentes\n\n` +
      `Utilise le menu ci-dessous pour accéder aux fonctions 👇`;
    
    await bot.sendMessage(config.telegram.adminChatId, welcome, {
      parse_mode: 'Markdown',
      ...mainMenu
    });
    
    console.log('✅ Menu de démarrage envoyé avec succès !');
    console.log('📱 Vérifiez votre Telegram pour voir le menu complet.');
    
  } catch (error) {
    console.error('❌ Erreur envoi menu:', error);
  }
}

// Exécuter
sendStartMenu(); 