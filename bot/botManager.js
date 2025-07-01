const TelegramBot = require('node-telegram-bot-api');
const PhotoHandler = require('./handlers/photoHandler');
const MessageHandler = require('./handlers/messageHandler');

class BotManager {
  constructor(config) {
    this.config = config;
    this.bot = null;
    this.handlers = {};
    
    this.init();
  }

  init() {
    try {
      console.log('🚦 Initialisation du bot LR ASSIST...');
      
      // Créer l'instance du bot
      if (this.config.telegram.webhookUrl) {
        this.bot = new TelegramBot(this.config.telegram.token, {
          webHook: {
            port: process.env.BOT_PORT || 8443
          },
          parse_mode: 'Markdown'
        });
        // Enregistrement automatique du webhook
        this.bot.setWebHook(this.config.telegram.webhookUrl + '/bot' + this.config.telegram.token)
          .then(() => {
            console.log('🌐 Webhook Telegram enregistré automatiquement :', this.config.telegram.webhookUrl);
          })
          .catch(err => {
            console.error('❌ Erreur enregistrement webhook Telegram :', err.message);
          });
        console.log('🌐 Bot Telegram démarré en mode webhook:', this.config.telegram.webhookUrl);
      } else {
        this.bot = new TelegramBot(this.config.telegram.token, {
          polling: true,
          parse_mode: 'Markdown'
        });
        console.log('🤖 Bot Telegram démarré en mode polling');
      }

      // Gérer les erreurs de polling
      this.bot.on('polling_error', (error) => {
        if (error.code === 'ETELEGRAM' && error.response.body.error_code === 409) {
          console.log('⚠️ Une autre instance du bot est déjà en cours d\'exécution.');
        } else {
          console.error('❌ Erreur polling Telegram:', error);
        }
      });

      // Initialiser les handlers
      this.initHandlers();
      
      // Initialiser les handlers de base
      this.initBaseHandlers();
      
      console.log('✅ Bot LR ASSIST initialisé avec succès');
      
    } catch (error) {
      console.error('❌ Erreur initialisation bot:', error);
      throw error;
    }
  }

  initHandlers() {
    // Initialiser le handler photo
    this.handlers.photo = new PhotoHandler(this.bot, this.config);
    
    // Initialiser le handler message
    this.handlers.message = new MessageHandler(this.bot, this.config);
    
    console.log('📋 Handlers initialisés');
  }

  initBaseHandlers() {
    // Handler pour /start
    this.bot.onText(/\/start/, (msg) => {
      this.handleStart(msg);
    });

    // Handler pour les boutons du menu
    this.bot.on('message', (msg) => {
      if (msg.text) {
        this.handleMenuButton(msg);
      }
    });

    // Handler pour les callback queries (checklist)
    this.bot.on('callback_query', (query) => {
      this.handleCallbackQuery(query);
    });

    console.log('🔧 Handlers de base initialisés');
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name || 'Utilisateur';
    
    console.log(`👋 Nouvel utilisateur: ${userName} (${userId})`);
    
    const welcome = `🚦 *Bienvenue sur LR ASSIST*\n\n` +
      `Je suis votre assistant ferroviaire intelligent.\n\n` +
      `📸 Envoyez des photos pour documentation\n` +
      `📍 Partagez votre position GPS\n` +
      `🚨 Signalez des urgences\n` +
      `📋 Suivez les checklists de sécurité\n\n` +
      `Utilisez le menu ci-dessous 👇`;

    const mainMenu = {
      reply_markup: {
        keyboard: [
          ['📸 Envoyer Photo', '📍 Partager Position'],
          ['🚨 Alerte Urgence', '📋 Checklist'],
          ['🔍 Portail Accès', '📊 Historique'],
          ['⚙️ Paramètres', '❓ Aide']
        ],
        resize_keyboard: true
      }
    };

    await this.bot.sendMessage(chatId, welcome, mainMenu);
  }

  async handleMenuButton(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    switch (text) {
      case '📸 Envoyer Photo':
        await this.bot.sendMessage(chatId, '📸 Envoie ta photo directement ici. Elle sera sauvegardée avec métadonnées.');
        break;
        
      case '📍 Partager Position':
        await this.bot.sendMessage(chatId, '📍 Clique pour envoyer ta position GPS. Le PK SNCF sera calculé automatiquement 👇', {
          reply_markup: {
            keyboard: [[{ text: '📍 Partager ma position', request_location: true }]],
            resize_keyboard: true
          }
        });
        break;
        
      case '🚨 Alerte Urgence':
        await this.handleEmergency(chatId, msg.from.first_name || 'Utilisateur', msg.from.id.toString());
        break;
        
      case '📋 Checklist':
        await this.sendChecklist(chatId);
        break;
        
      case '🔍 Portail Accès':
        await this.findNearestAccessPortal(chatId, msg.from.first_name || 'Utilisateur', msg.from.id.toString());
        break;
        
      case '📊 Historique':
        await this.sendHistory(chatId, msg.from.id.toString());
        break;
        
      case '⚙️ Paramètres':
        await this.sendSettings(chatId);
        break;
        
      case '❓ Aide':
        await this.sendHelp(chatId);
        break;
        
      default:
        // Les autres messages sont traités par le MessageHandler
        break;
    }
  }

  async handleCallbackQuery(query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const userName = query.from.first_name || 'Utilisateur';
    const data = query.data;

    try {
      if (data.startsWith('check')) {
        const step = parseInt(data.replace('check', ''));
        const steps = [
          { label: 'Position train vérifiée', callback_data: 'check1' },
          { label: 'Chef chantier contacté', callback_data: 'check2' },
          { label: 'Signalisations activées', callback_data: 'check3' },
          { label: 'Circulation voie bloquée', callback_data: 'check4' },
          { label: 'Mise hors voie confirmée', callback_data: 'check5' }
        ];

        if (step >= 1 && step <= steps.length) {
          await this.bot.answerCallbackQuery(query.id, { text: `✅ ${steps[step-1].label}` });
          
          // Mettre à jour le message avec le statut
          const updatedText = query.message.text + `\n✅ ${steps[step-1].label}`;
          await this.bot.editMessageText(updatedText, {
            chat_id: chatId,
            message_id: query.message.message_id
          });
        }
      }
    } catch (error) {
      console.error('❌ Erreur callback query:', error);
      await this.bot.answerCallbackQuery(query.id, { text: "❌ Erreur" });
    }
  }

  async handleEmergency(chatId, userName, userId) {
    try {
      // Récupérer la dernière position connue
      const data = this.handlers.photo.loadData();
      const lastLocation = data.locations.find(loc => loc.userId === userId);
      
      if (lastLocation) {
        const alertMsg = `🚨 *ALERTE D'URGENCE*\n\n` +
          `👤 Opérateur: ${userName}\n` +
          `🆔 ID: ${userId}\n` +
          `📍 Position: ${lastLocation.latitude}, ${lastLocation.longitude}\n` +
          `🚦 PK SNCF: ${lastLocation.pkSNCF}\n` +
          `🛤️ Ligne: ${lastLocation.lineName}\n` +
          `🕐 Horodatage: ${new Date().toLocaleString('fr-FR')}\n\n` +
          `⚠️ Intervention requise immédiatement`;

        await this.bot.sendMessage(this.config.telegram.adminChatId, alertMsg, {
          parse_mode: 'Markdown'
        });

        await this.bot.sendMessage(chatId, "🚨 Alerte d'urgence envoyée aux administrateurs\n\nVotre position a été transmise. Restez en sécurité.", {
          reply_markup: {
            keyboard: [
              ['📸 Envoyer Photo', '📍 Partager Position'],
              ['🚨 Alerte Urgence', '📋 Checklist'],
              ['🔍 Portail Accès', '📊 Historique'],
              ['⚙️ Paramètres', '❓ Aide']
            ],
            resize_keyboard: true
          }
        });
      } else {
        await this.bot.sendMessage(chatId, "❌ ERREUR CRITIQUE - Votre position n'est pas connue. Envoyez immédiatement votre position GPS pour la mise hors voie d'urgence.", {
          reply_markup: {
            keyboard: [[{ text: '📍 Partager ma position', request_location: true }]],
            resize_keyboard: true
          }
        });
      }
    } catch (error) {
      console.error('❌ Erreur alerte urgence:', error);
      await this.bot.sendMessage(chatId, "❌ Erreur lors de l'envoi de l'alerte. Contactez directement les secours.", {
        reply_markup: {
          keyboard: [
            ['📸 Envoyer Photo', '📍 Partager Position'],
            ['🚨 Alerte Urgence', '📋 Checklist'],
            ['🔍 Portail Accès', '📊 Historique'],
            ['⚙️ Paramètres', '❓ Aide']
          ],
          resize_keyboard: true
        }
      });
    }
  }

  async sendChecklist(chatId) {
    const keyboard = [
      [{ text: "❌ Vérifier position train", callback_data: 'check1' }],
      [{ text: "❌ Contacter chef chantier", callback_data: 'check2' }],
      [{ text: "❌ Activer signalisations", callback_data: 'check3' }],
      [{ text: "❌ Bloquer circulation voie", callback_data: 'check4' }],
      [{ text: "❌ Confirmer mise hors voie", callback_data: 'check5' }]
    ];
    
    await this.bot.sendMessage(chatId, "✅ Checklist de sécurité ferroviaire :", {
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  async findNearestAccessPortal(chatId, userName, userId) {
    try {
      const data = this.handlers.photo.loadData();
      const lastLocation = data.locations.find(loc => loc.userId === userId);
      
      if (lastLocation) {
        // Ici vous pouvez intégrer la logique de recherche de portail
        const pkMsg = `PK ${lastLocation.pkSNCF} (${lastLocation.lineName})`;
        const portalMsg = `Portail d'accès le plus proche: [À implémenter]`;
        
        await this.bot.sendMessage(chatId, `📍 Depuis votre position :\n${pkMsg}\n\n${portalMsg}`, {
          reply_markup: {
            keyboard: [
              ['📸 Envoyer Photo', '📍 Partager Position'],
              ['🚨 Alerte Urgence', '📋 Checklist'],
              ['🔍 Portail Accès', '📊 Historique'],
              ['⚙️ Paramètres', '❓ Aide']
            ],
            resize_keyboard: true
          }
        });
      } else {
        await this.bot.sendMessage(chatId, "❌ Votre position n'est pas connue. Envoyez d'abord votre position GPS.", {
          reply_markup: {
            keyboard: [
              ['📸 Envoyer Photo', '📍 Partager Position'],
              ['🚨 Alerte Urgence', '📋 Checklist'],
              ['🔍 Portail Accès', '📊 Historique'],
              ['⚙️ Paramètres', '❓ Aide']
            ],
            resize_keyboard: true
          }
        });
      }
    } catch (error) {
      console.error('❌ Erreur recherche portail:', error);
      await this.bot.sendMessage(chatId, "❌ Erreur lors de la recherche du portail d'accès.", {
        reply_markup: {
          keyboard: [
            ['📸 Envoyer Photo', '📍 Partager Position'],
            ['🚨 Alerte Urgence', '📋 Checklist'],
            ['🔍 Portail Accès', '📊 Historique'],
            ['⚙️ Paramètres', '❓ Aide']
          ],
          resize_keyboard: true
        }
      });
    }
  }

  async sendHistory(chatId, userId) {
    try {
      const data = this.handlers.photo.loadData();
      const userMessages = data.messages.filter(msg => msg.userId === userId).slice(-5);
      
      if (userMessages.length > 0) {
        let historyMsg = "📊 Vos 5 dernières actions :\n\n";
        userMessages.forEach((msg, index) => {
          const date = new Date(msg.timestamp).toLocaleString('fr-FR');
          historyMsg += `${index + 1}. ${msg.message} (${date})\n`;
        });
        
        await this.bot.sendMessage(chatId, historyMsg, {
          reply_markup: {
            keyboard: [
              ['📸 Envoyer Photo', '📍 Partager Position'],
              ['🚨 Alerte Urgence', '📋 Checklist'],
              ['🔍 Portail Accès', '📊 Historique'],
              ['⚙️ Paramètres', '❓ Aide']
            ],
            resize_keyboard: true
          }
        });
      } else {
        await this.bot.sendMessage(chatId, "📊 Aucun historique disponible.", {
          reply_markup: {
            keyboard: [
              ['📸 Envoyer Photo', '📍 Partager Position'],
              ['🚨 Alerte Urgence', '📋 Checklist'],
              ['🔍 Portail Accès', '📊 Historique'],
              ['⚙️ Paramètres', '❓ Aide']
            ],
            resize_keyboard: true
          }
        });
      }
    } catch (error) {
      console.error('❌ Erreur historique:', error);
      await this.bot.sendMessage(chatId, "❌ Erreur lors de la récupération de l'historique.", {
        reply_markup: {
          keyboard: [
            ['📸 Envoyer Photo', '📍 Partager Position'],
            ['🚨 Alerte Urgence', '📋 Checklist'],
            ['🔍 Portail Accès', '📊 Historique'],
            ['⚙️ Paramètres', '❓ Aide']
          ],
          resize_keyboard: true
        }
      });
    }
  }

  async sendSettings(chatId) {
    const settingsMsg = `⚙️ *Paramètres*\n\n` +
      `🔔 Notifications: Activées\n` +
      `📸 Qualité photo: Haute\n` +
      `📍 Précision GPS: Élevée\n` +
      `🕐 Fuseau horaire: Europe/Paris\n\n` +
      `*Statut:* Opérationnel`;

    await this.bot.sendMessage(chatId, settingsMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          ['📸 Envoyer Photo', '📍 Partager Position'],
          ['🚨 Alerte Urgence', '📋 Checklist'],
          ['🔍 Portail Accès', '📊 Historique'],
          ['⚙️ Paramètres', '❓ Aide']
        ],
        resize_keyboard: true
      }
    });
  }

  async sendHelp(chatId) {
    const helpMsg = `❓ *Aide LR ASSIST*\n\n` +
      `📸 *Photos* : Envoyez des photos pour documentation\n` +
      `📍 *Position* : Partagez votre position GPS\n` +
      `🚨 *Urgence* : Signalez une situation d'urgence\n` +
      `📋 *Checklist* : Suivez les procédures de sécurité\n` +
      `🔍 *Portail* : Trouvez le portail d'accès le plus proche\n` +
      `📊 *Historique* : Consultez vos actions récentes\n\n` +
      `*Commandes disponibles:*\n` +
      `/start - Menu principal\n` +
      `/help - Cette aide\n` +
      `/status - Statut du système`;

    await this.bot.sendMessage(chatId, helpMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          ['📸 Envoyer Photo', '📍 Partager Position'],
          ['🚨 Alerte Urgence', '📋 Checklist'],
          ['🔍 Portail Accès', '📊 Historique'],
          ['⚙️ Paramètres', '❓ Aide']
        ],
        resize_keyboard: true
      }
    });
  }

  stop() {
    if (this.bot) {
      console.log('🛑 Arrêt du bot LR ASSIST...');
      this.bot.stopPolling();
    }
  }

  getBot() {
    return this.bot;
  }

  getHandlers() {
    return this.handlers;
  }
}

module.exports = BotManager; 