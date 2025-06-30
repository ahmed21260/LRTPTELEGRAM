const fs = require('fs');
const path = require('path');

class MessageHandler {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.logsDir = path.join(__dirname, '..', 'logs');
    
    // Créer les dossiers s'ils n'existent pas
    this.ensureDirectories();
    
    // Initialiser le handler
    this.init();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  init() {
    // Handler pour les messages texte
    this.bot.on('text', async (msg) => {
      await this.handleTextMessage(msg);
    });

    console.log('💬 Handler message initialisé');
  }

  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name || 'Utilisateur';
    const userLastName = msg.from.last_name || '';
    const username = msg.from.username || 'sans_username';
    const messageText = msg.text;
    const timestamp = Date.now();
    const date = new Date().toISOString();

    try {
      console.log('💬 Traitement message reçu...');
      
      // Détecter le type de message
      const messageType = this.detectMessageType(messageText);
      
      // Créer l'entrée de log
      const logEntry = {
        action: 'MESSAGE_RECEIVED',
        timestamp: date,
        operator: {
          userId: userId,
          userName: userName,
          userLastName: userLastName,
          username: username,
          chatId: chatId
        },
        message: {
          text: messageText,
          type: messageType.type,
          priority: messageType.priority,
          messageId: msg.message_id,
          date: msg.date
        },
        metadata: {
          isCommand: messageText.startsWith('/'),
          length: messageText.length,
          hasKeywords: this.detectKeywords(messageText)
        }
      };

      // Sauvegarder dans les données locales
      await this.saveToLocalData(logEntry);
      
      // Logger l'action
      await this.logAction(logEntry);
      
      // Traiter selon le type
      await this.processMessageByType(chatId, logEntry);
      
      // Émettre vers le dashboard
      await this.emitToDashboard(logEntry);
      
      console.log(`✅ Message traité: ${messageType.type} (${messageText.substring(0, 50)}...)`);

    } catch (error) {
      console.error('❌ Erreur traitement message:', error);
      
      // Logger l'erreur
      await this.logError({
        action: 'MESSAGE_ERROR',
        timestamp: date,
        operator: {
          userId: userId,
          userName: userName,
          chatId: chatId
        },
        error: {
          message: error.message,
          stack: error.stack
        },
        message: {
          text: messageText,
          messageId: msg.message_id
        }
      });
      
      await this.bot.sendMessage(chatId, "❌ Erreur lors du traitement du message. Réessayez.", {
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

  detectMessageType(text) {
    const lowerText = text.toLowerCase();
    
    // Détecter les alertes d'urgence
    if (lowerText.includes('urgence') || lowerText.includes('danger') || lowerText.includes('accident')) {
      return { type: 'alert', priority: 'high' };
    }
    
    // Détecter les commandes
    if (text.startsWith('/')) {
      return { type: 'command', priority: 'medium' };
    }
    
    // Détecter les questions
    if (text.includes('?') || lowerText.includes('comment') || lowerText.includes('quoi') || lowerText.includes('où')) {
      return { type: 'question', priority: 'medium' };
    }
    
    // Détecter les rapports
    if (lowerText.includes('rapport') || lowerText.includes('signalement') || lowerText.includes('problème')) {
      return { type: 'report', priority: 'medium' };
    }
    
    // Message normal
    return { type: 'normal', priority: 'low' };
  }

  detectKeywords(text) {
    const lowerText = text.toLowerCase();
    const keywords = {
      train: lowerText.includes('train'),
      voie: lowerText.includes('voie'),
      signal: lowerText.includes('signal'),
      sécurité: lowerText.includes('sécurité'),
      maintenance: lowerText.includes('maintenance'),
      incident: lowerText.includes('incident'),
      panne: lowerText.includes('panne'),
      travaux: lowerText.includes('travaux')
    };
    
    return keywords;
  }

  async saveToLocalData(logEntry) {
    try {
      // Charger les données existantes
      let data = this.loadData();
      
      // Ajouter le message
      data.messages.push({
        userId: logEntry.operator.userId,
        userName: logEntry.operator.userName,
        message: logEntry.message.text,
        type: logEntry.message.type,
        status: 'normal',
        priority: logEntry.message.priority,
        chatId: logEntry.operator.chatId,
        timestamp: Date.now(),
        keywords: logEntry.metadata.hasKeywords
      });
      
      // Si c'est une alerte, l'ajouter aux alertes
      if (logEntry.message.type === 'alert') {
        data.alerts.push({
          userId: logEntry.operator.userId,
          userName: logEntry.operator.userName,
          message: logEntry.message.text,
          type: 'text_alert',
          priority: 'high',
          chatId: logEntry.operator.chatId,
          timestamp: Date.now(),
          status: 'active'
        });
      }
      
      // Sauvegarder
      this.saveData(data);
      
    } catch (error) {
      console.error('❌ Erreur sauvegarde données locales:', error);
      throw error;
    }
  }

  async logAction(logEntry) {
    try {
      const logFile = path.join(this.logsDir, `message_actions_${new Date().toISOString().split('T')[0]}.json`);
      
      let logs = [];
      if (fs.existsSync(logFile)) {
        logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      }
      
      logs.push(logEntry);
      
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
      
      // Log console pour debug
      console.log(`📝 Message loggé: ${logEntry.message.type} - ${logEntry.operator.userName} (${logEntry.operator.userId})`);
      
    } catch (error) {
      console.error('❌ Erreur logging action:', error);
    }
  }

  async logError(errorEntry) {
    try {
      const logFile = path.join(this.logsDir, `message_errors_${new Date().toISOString().split('T')[0]}.json`);
      
      let logs = [];
      if (fs.existsSync(logFile)) {
        logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      }
      
      logs.push(errorEntry);
      
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
      
    } catch (error) {
      console.error('❌ Erreur logging erreur:', error);
    }
  }

  async processMessageByType(chatId, logEntry) {
    const messageType = logEntry.message.type;
    const messageText = logEntry.message.text;
    
    switch (messageType) {
      case 'alert':
        await this.handleAlert(chatId, logEntry);
        break;
        
      case 'command':
        await this.handleCommand(chatId, logEntry);
        break;
        
      case 'question':
        await this.handleQuestion(chatId, logEntry);
        break;
        
      case 'report':
        await this.handleReport(chatId, logEntry);
        break;
        
      default:
        await this.handleNormalMessage(chatId, logEntry);
        break;
    }
  }

  async handleAlert(chatId, logEntry) {
    const alertMsg = `🚨 ALERTE D'URGENCE RECUE\n\n` +
      `👤 Opérateur: ${logEntry.operator.userName} ${logEntry.operator.userLastName}\n` +
      `📝 Message: ${logEntry.message.text}\n` +
      `🕐 Horodatage: ${new Date(logEntry.timestamp).toLocaleString('fr-FR')}\n\n` +
      `⚠️ Alerte transmise aux administrateurs`;

    // Envoyer aux administrateurs
    await this.bot.sendMessage(this.config.telegram.adminChatId, alertMsg, {
      parse_mode: 'Markdown'
    });

    // Confirmation à l'utilisateur
    await this.bot.sendMessage(chatId, "🚨 Alerte d'urgence reçue et transmise aux administrateurs.\n\nRestez en sécurité et suivez les procédures.", {
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

  async handleCommand(chatId, logEntry) {
    const command = logEntry.message.text.split(' ')[0];
    
    switch (command) {
      case '/start':
        await this.sendWelcomeMessage(chatId);
        break;
      case '/help':
        await this.sendHelp(chatId);
        break;
      case '/status':
        await this.sendStatus(chatId);
        break;
      default:
        await this.bot.sendMessage(chatId, `Commande non reconnue: ${command}\n\nUtilisez /help pour voir les commandes disponibles.`);
        break;
    }
  }

  async handleQuestion(chatId, logEntry) {
    await this.bot.sendMessage(chatId, `❓ Question reçue: ${logEntry.message.text}\n\nUn opérateur vous répondra dans les plus brefs délais.`, {
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

  async handleReport(chatId, logEntry) {
    await this.bot.sendMessage(chatId, `📋 Rapport reçu et enregistré.\n\nMerci pour votre signalement.`, {
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

  async handleNormalMessage(chatId, logEntry) {
    await this.bot.sendMessage(chatId, "✅ Message reçu et enregistré.\n\nUtilisez le menu pour les actions spécifiques 👇", {
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

  async sendWelcomeMessage(chatId) {
    const welcome = `🚦 *Bienvenue sur LR ASSIST*\n\n` +
      `Je suis votre assistant ferroviaire intelligent.\n\n` +
      `📸 Envoyez des photos pour documentation\n` +
      `📍 Partagez votre position GPS\n` +
      `🚨 Signalez des urgences\n` +
      `📋 Suivez les checklists de sécurité\n\n` +
      `Utilisez le menu ci-dessous 👇`;

    await this.bot.sendMessage(chatId, welcome, {
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

  async sendStatus(chatId) {
    const statusMsg = `📊 *Statut du système*\n\n` +
      `✅ Bot opérationnel\n` +
      `📸 Handler photo actif\n` +
      `💬 Handler message actif\n` +
      `🕐 Dernière mise à jour: ${new Date().toLocaleString('fr-FR')}`;

    await this.bot.sendMessage(chatId, statusMsg, {
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

  async emitToDashboard(logEntry) {
    try {
      const { ioClient } = require('socket.io-client');
      const dashboardSocket = ioClient(process.env.DASHBOARD_URL || 'http://localhost:3000', { 
        transports: ['websocket'], 
        reconnection: true 
      });
      
      dashboardSocket.emit('message', {
        userId: logEntry.operator.userId,
        userName: logEntry.operator.userName,
        message: logEntry.message.text,
        type: logEntry.message.type,
        priority: logEntry.message.priority,
        timestamp: Date.now(),
        chatId: logEntry.operator.chatId
      });
      
    } catch (error) {
      console.error('❌ Erreur émission dashboard:', error);
    }
  }

  loadData() {
    try {
      if (fs.existsSync('data.json')) {
        return JSON.parse(fs.readFileSync('data.json', 'utf8'));
      }
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
    }
    
    return {
      photos: [],
      messages: [],
      locations: [],
      alerts: []
    };
  }

  saveData(data) {
    try {
      fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ Erreur sauvegarde données:', error);
    }
  }

  // Méthode pour récupérer les logs d'une date donnée
  getLogsByDate(date) {
    try {
      const logFile = path.join(this.logsDir, `message_actions_${date}.json`);
      if (fs.existsSync(logFile)) {
        return JSON.parse(fs.readFileSync(logFile, 'utf8'));
      }
      return [];
    } catch (error) {
      console.error('❌ Erreur récupération logs:', error);
      return [];
    }
  }

  // Méthode pour récupérer les erreurs d'une date donnée
  getErrorsByDate(date) {
    try {
      const logFile = path.join(this.logsDir, `message_errors_${date}.json`);
      if (fs.existsSync(logFile)) {
        return JSON.parse(fs.readFileSync(logFile, 'utf8'));
      }
      return [];
    } catch (error) {
      console.error('❌ Erreur récupération erreurs:', error);
      return [];
    }
  }
}

module.exports = MessageHandler; 