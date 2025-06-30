const fs = require('fs');
const path = require('path');
const axios = require('axios');

class PhotoHandler {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.photosDir = path.join(__dirname, '..', 'photos');
    this.logsDir = path.join(__dirname, '..', 'logs');
    
    // Créer les dossiers s'ils n'existent pas
    this.ensureDirectories();
    
    // Initialiser le handler
    this.init();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.photosDir)) {
      fs.mkdirSync(this.photosDir, { recursive: true });
    }
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  init() {
    // Handler pour les photos
    this.bot.on('photo', async (msg) => {
      await this.handlePhoto(msg);
    });

    console.log('📸 Handler photo initialisé');
  }

  async handlePhoto(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userName = msg.from.first_name || 'Utilisateur';
    const userLastName = msg.from.last_name || '';
    const username = msg.from.username || 'sans_username';
    const caption = msg.caption || 'Photo sans description';
    const timestamp = Date.now();
    const date = new Date().toISOString();

    try {
      console.log('📸 Traitement photo reçue...');
      
      // Récupérer la photo de meilleure qualité
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const file = await this.bot.getFile(fileId);
      const filePath = file.file_path;
      
      // Télécharger la photo
      const url = `https://api.telegram.org/file/bot${this.config.telegram.token}/${filePath}`;
      const filename = `photo_${timestamp}_${userId}.jpg`;
      const dest = path.join(this.photosDir, filename);
      
      // Télécharger le fichier
      await this.downloadFile(url, dest);
      
      // Informations sur le fichier
      const fileStats = fs.statSync(dest);
      const fileSizeKB = (fileStats.size / 1024).toFixed(2);
      
      // Créer l'entrée de log
      const logEntry = {
        action: 'PHOTO_RECEIVED',
        timestamp: date,
        operator: {
          userId: userId,
          userName: userName,
          userLastName: userLastName,
          username: username,
          chatId: chatId
        },
        photo: {
          filename: filename,
          originalPath: filePath,
          localPath: dest,
          fileSize: fileStats.size,
          fileSizeKB: fileSizeKB,
          caption: caption,
          dimensions: {
            width: msg.photo[msg.photo.length - 1].width,
            height: msg.photo[msg.photo.length - 1].height
          }
        },
        metadata: {
          messageId: msg.message_id,
          date: msg.date,
          telegramFileId: fileId
        }
      };

      // Sauvegarder dans les données locales
      await this.saveToLocalData(logEntry);
      
      // Logger l'action
      await this.logAction(logEntry);
      
      // Envoyer confirmation
      await this.sendConfirmation(chatId, logEntry);
      
      // Émettre vers le dashboard
      await this.emitToDashboard(logEntry);
      
      console.log(`✅ Photo traitée: ${filename} (${fileSizeKB} KB)`);

    } catch (error) {
      console.error('❌ Erreur traitement photo:', error);
      
      // Logger l'erreur
      await this.logError({
        action: 'PHOTO_ERROR',
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
        photo: {
          caption: caption,
          messageId: msg.message_id
        }
      });
      
      await this.bot.sendMessage(chatId, "❌ Erreur lors du traitement de la photo. Réessayez.", {
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

  async downloadFile(url, dest) {
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(dest);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Erreur téléchargement: ${error.message}`);
    }
  }

  async saveToLocalData(logEntry) {
    try {
      // Charger les données existantes
      let data = this.loadData();
      
      // Ajouter la photo
      data.photos.push({
        userId: logEntry.operator.userId,
        userName: logEntry.operator.userName,
        filename: logEntry.photo.filename,
        caption: logEntry.photo.caption,
        timestamp: Date.now(),
        chatId: logEntry.operator.chatId,
        fileSize: logEntry.photo.fileSize,
        fileSizeKB: logEntry.photo.fileSizeKB,
        dimensions: logEntry.photo.dimensions,
        localPath: logEntry.photo.localPath
      });
      
      // Ajouter le message
      data.messages.push({
        userId: logEntry.operator.userId,
        userName: logEntry.operator.userName,
        message: `📸 ${logEntry.photo.caption}`,
        type: 'photo',
        status: 'normal',
        photoUrl: `local://${logEntry.photo.filename}`,
        chatId: logEntry.operator.chatId,
        timestamp: Date.now(),
        fileSize: logEntry.photo.fileSize,
        dimensions: logEntry.photo.dimensions
      });
      
      // Sauvegarder
      this.saveData(data);
      
    } catch (error) {
      console.error('❌ Erreur sauvegarde données locales:', error);
      throw error;
    }
  }

  async logAction(logEntry) {
    try {
      const logFile = path.join(this.logsDir, `photo_actions_${new Date().toISOString().split('T')[0]}.json`);
      
      let logs = [];
      if (fs.existsSync(logFile)) {
        logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      }
      
      logs.push(logEntry);
      
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
      
      // Log console pour debug
      console.log(`📝 Action loggée: ${logEntry.action} - ${logEntry.operator.userName} (${logEntry.operator.userId})`);
      
    } catch (error) {
      console.error('❌ Erreur logging action:', error);
    }
  }

  async logError(errorEntry) {
    try {
      const logFile = path.join(this.logsDir, `photo_errors_${new Date().toISOString().split('T')[0]}.json`);
      
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

  async sendConfirmation(chatId, logEntry) {
    const confirmationMsg = `📸 Photo traitée avec succès\n\n` +
      `👤 Opérateur: ${logEntry.operator.userName} ${logEntry.operator.userLastName}\n` +
      `📝 Description: ${logEntry.photo.caption}\n` +
      `📏 Taille: ${logEntry.photo.fileSizeKB} KB\n` +
      `📐 Dimensions: ${logEntry.photo.dimensions.width}x${logEntry.photo.dimensions.height}\n` +
      `💾 Fichier: ${logEntry.photo.filename}\n` +
      `🕐 Horodatage: ${new Date(logEntry.timestamp).toLocaleString('fr-FR')}\n\n` +
      `✅ Photo sauvegardée et loggée`;

    await this.bot.sendMessage(chatId, confirmationMsg, {
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
      
      dashboardSocket.emit('photo', {
        userId: logEntry.operator.userId,
        userName: logEntry.operator.userName,
        filename: logEntry.photo.filename,
        caption: logEntry.photo.caption,
        timestamp: Date.now(),
        chatId: logEntry.operator.chatId,
        fileSize: logEntry.photo.fileSize,
        dimensions: logEntry.photo.dimensions
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
      const logFile = path.join(this.logsDir, `photo_actions_${date}.json`);
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
      const logFile = path.join(this.logsDir, `photo_errors_${date}.json`);
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

module.exports = PhotoHandler; 