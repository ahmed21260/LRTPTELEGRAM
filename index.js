const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const https = require('https');
const moment = require('moment');

// Import modules
const config = require('./config');
const { initializeFirebase, FirestoreService, StorageService } = require('./firebase');
const GeoportailService = require('./geoportail');
const Utils = require('./utils');

// Initialize services
const bot = new TelegramBot(config.telegram.token, { polling: true });
const firestore = new FirestoreService();
const storage = new StorageService();
const geoportal = new GeoportailService();

// Initialize Firebase
initializeFirebase();

// Ensure directories exist
const PHOTO_DIR = path.join(__dirname, 'data', 'photos');
if (!fs.existsSync(PHOTO_DIR)) {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
}

// Menu principal
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📸 Envoyer une photo', '📍 Partager ma position'],
      ['✅ Checklist sécurité', '⚠️ Déclencher une urgence'],
      ['📘 Fiches techniques', 'ℹ️ Aide'],
      ['📊 Historique', '🔧 Paramètres']
    ],
    resize_keyboard: true
  }
};

// /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'utilisateur';
  const userId = msg.from.id.toString();
  
  const welcome = `👋 Bonjour *${userName}*, bienvenue sur *LR ASSIST* !\n\n` +
    `🚦 Application de terrain pour opérateurs ferroviaires\n` +
    `📱 Votre ID: \`${userId}\`\n\n` +
    `Utilise le menu ci-dessous pour accéder aux fonctions.`;

  try {
    // Save user info to Firestore
    await firestore.saveMessage({
      userId,
      userName,
      message: 'Utilisateur connecté',
      type: 'connection',
      status: 'normal',
      chatId
    });

    bot.sendMessage(chatId, welcome, { 
      parse_mode: 'Markdown', 
      ...mainMenu 
    });
  } catch (error) {
    console.error('❌ Erreur sauvegarde connexion:', error);
    bot.sendMessage(chatId, welcome, { 
      parse_mode: 'Markdown', 
      ...mainMenu 
    });
  }
});

// Debug logging
bot.on('message', (msg) => {
  const user = msg.from.username || msg.from.first_name || msg.from.id;
  const messageType = msg.photo ? 'PHOTO' : msg.location ? 'LOCATION' : 'TEXT';
  console.log(`📩 ${user} (${msg.chat.id}) => ${messageType}: ${msg.text || '[non-text message]'}`);
});

// Handle text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Utilisateur';
  
  if (!text || text.startsWith('/')) return;

  try {
    switch (text) {
      case '📸 Envoyer une photo':
        bot.sendMessage(chatId, '📸 Envoie ta photo directement ici. Elle sera sauvegardée avec métadonnées et uploadée dans le cloud.');
        break;

      case '📍 Partager ma position':
        bot.sendMessage(chatId, '📍 Clique pour envoyer ta position GPS. Le PK SNCF sera calculé automatiquement 👇', {
          reply_markup: {
            keyboard: [[{ text: "📡 Envoyer ma position", request_location: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
        break;

      case '✅ Checklist sécurité':
        await sendChecklist(chatId);
        break;

      case '⚠️ Déclencher une urgence':
        await handleEmergency(chatId, userName, userId);
        break;

      case '📘 Fiches techniques':
        await sendTechnicalSheets(chatId);
        break;

      case '📊 Historique':
        await sendHistory(chatId, userId);
        break;

      case '🔧 Paramètres':
        await sendSettings(chatId);
        break;

      case 'ℹ️ Aide':
        await sendHelp(chatId);
        break;

      default:
        // Save regular message to Firestore
        await firestore.saveMessage({
          userId,
          userName,
          message: text,
          type: 'message',
          status: 'normal',
          chatId
        });

        bot.sendMessage(chatId, "✅ Message enregistré. Utilise le menu pour les actions spécifiques 👇", mainMenu);
    }
  } catch (error) {
    console.error('❌ Erreur traitement message:', error);
    bot.sendMessage(chatId, "❌ Erreur lors du traitement. Réessayez.", mainMenu);
  }
});

// Handle photos
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Utilisateur';
  const caption = msg.caption || 'Photo sans description';
  
  try {
    console.log('📸 Traitement photo reçue...');
    
    // Get the highest quality photo
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const filePath = file.file_path;
    
    // Download photo
    const url = `https://api.telegram.org/file/bot${config.telegram.token}/${filePath}`;
    const timestamp = Date.now();
    const originalFilename = `photo_${timestamp}.jpg`;
    const originalPath = path.join(PHOTO_DIR, originalFilename);
    
    // Download file
    await downloadFile(url, originalPath);
    
    // Extract EXIF data
    const exifData = await Utils.extractExifData(originalPath);
    
    // Compress image
    const compressedFilename = `compressed_${originalFilename}`;
    const compressedPath = path.join(PHOTO_DIR, compressedFilename);
    const compressionResult = await Utils.compressImage(originalPath, compressedPath, {
      width: 1920,
      height: 1080,
      quality: 80
    });
    
    // Generate thumbnail
    const thumbnailFilename = `thumb_${originalFilename}`;
    const thumbnailPath = path.join(PHOTO_DIR, thumbnailFilename);
    await Utils.generateThumbnail(originalPath, thumbnailPath, 300);
    
    // Upload to Firebase Storage
    const storagePath = `${moment().format('YYYY/MM/DD')}/${userId}_${timestamp}.jpg`;
    const uploadResult = await storage.uploadPhoto(compressedPath, storagePath, {
      userId,
      userName,
      timestamp: timestamp.toString(),
      originalSize: fs.statSync(originalPath).size,
      compressedSize: compressionResult.size,
      exifData: exifData ? JSON.stringify(exifData) : null
    });
    
    // Save to Firestore
    const photoData = {
      userId,
      userName,
      filename: originalFilename,
      url: uploadResult.url,
      storagePath: uploadResult.path,
      caption,
      timestamp,
      exifData,
      originalSize: fs.statSync(originalPath).size,
      compressedSize: compressionResult.size,
      chatId
    };
    
    await firestore.savePhoto(photoData);
    
    // Save message with photo reference
    await firestore.saveMessage({
      userId,
      userName,
      message: `📸 ${caption}`,
      type: 'photo',
      status: 'normal',
      photoUrl: uploadResult.url,
      chatId
    });
    
    // Send confirmation
    const confirmationMsg = `📸 *Photo traitée avec succès*\n\n` +
      `📝 Description: ${caption}\n` +
      `📏 Taille originale: ${Utils.formatFileSize(fs.statSync(originalPath).size)}\n` +
      `📏 Taille compressée: ${Utils.formatFileSize(compressionResult.size)}\n` +
      `🔗 [Voir photo](${uploadResult.url})\n\n` +
      (exifData && exifData.gpsLatitude ? 
        `📍 GPS: ${exifData.gpsLatitude.toFixed(6)}, ${exifData.gpsLongitude.toFixed(6)}` : 
        `⚠️ Pas de données GPS dans la photo`);
    
    bot.sendMessage(chatId, confirmationMsg, { 
      parse_mode: 'Markdown',
      ...mainMenu 
    });
    
    // Clean up local files
    fs.unlinkSync(originalPath);
    fs.unlinkSync(compressedPath);
    fs.unlinkSync(thumbnailPath);
    
  } catch (error) {
    console.error('❌ Erreur traitement photo:', error);
    bot.sendMessage(chatId, "❌ Erreur lors du traitement de la photo. Réessayez.", mainMenu);
  }
});

// Handle location with precise railway geometry
bot.on('location', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Utilisateur';
  const { latitude, longitude } = msg.location;
  
  try {
    console.log('📍 Traitement localisation reçue avec géométrie précise...');
    
    // Validate GPS coordinates
    if (!Utils.validateGPS(latitude, longitude)) {
      bot.sendMessage(chatId, "❌ Coordonnées GPS invalides.", mainMenu);
      return;
    }
    
    // Calculate PK SNCF with precise geometry
    const pkResult = await geoportal.calculatePKSNCF(latitude, longitude);
    
    // Get detailed railway line info
    const railwayInfo = await geoportal.getRailwayLineInfo(latitude, longitude);
    
    // Get nearby infrastructure
    const infrastructure = await geoportal.getNearbyInfrastructure(latitude, longitude, 2000);
    
    // Save to Firestore
    const locationData = {
      userId,
      userName,
      latitude,
      longitude,
      pkSNCF: pkResult.pk,
      lineId: pkResult.lineId,
      lineName: pkResult.lineName,
      confidence: pkResult.confidence,
      distance: pkResult.distance,
      method: pkResult.method,
      railwayInfo,
      infrastructure,
      timestamp: Date.now(),
      chatId
    };
    
    await firestore.saveLocation(locationData);
    
    // Save message with location
    await firestore.saveMessage({
      userId,
      userName,
      message: `📍 Position partagée - ${pkResult.pk} (${pkResult.lineName})`,
      type: 'location',
      status: 'normal',
      location: { 
        latitude, 
        longitude, 
        pkSNCF: pkResult.pk,
        lineName: pkResult.lineName,
        confidence: pkResult.confidence
      },
      chatId
    });
    
    // Send confirmation with detailed information
    const geoUrl = `https://www.geoportail.gouv.fr/carte?c=${longitude},${latitude}&z=19&l=TRANSPORTNETWORKS.RAILWAYS`;
    
    let confirmationMsg = `📍 *Position reçue et traitée*\n\n` +
      `📊 Coordonnées:\n` +
      `• Latitude: ${latitude.toFixed(6)}\n` +
      `• Longitude: ${longitude.toFixed(6)}\n\n` +
      `🚦 Point Kilométrique SNCF:\n` +
      `• PK: *${pkResult.pk}*\n` +
      `• Ligne: ${pkResult.lineName}\n` +
      `• Direction: ${railwayInfo.direction}\n` +
      `• Confiance: ${pkResult.confidence}\n` +
      `• Distance: ${pkResult.distance ? `${Math.round(pkResult.distance)}m` : 'N/A'}\n` +
      `• Méthode: ${pkResult.method}\n\n`;
    
    // Add infrastructure information if available
    if (infrastructure.stations.length > 0 || infrastructure.signals.length > 0) {
      confirmationMsg += `🏗️ Infrastructure proche:\n`;
      if (infrastructure.stations.length > 0) {
        confirmationMsg += `• Gares: ${infrastructure.stations.length}\n`;
      }
      if (infrastructure.signals.length > 0) {
        confirmationMsg += `• Signaux: ${infrastructure.signals.length}\n`;
      }
      confirmationMsg += `\n`;
    }
    
    confirmationMsg += `🔗 [Voir sur Geoportail (Voies SNCF)](${geoUrl})`;
    
    bot.sendMessage(chatId, confirmationMsg, { 
      parse_mode: 'Markdown',
      ...mainMenu 
    });
    
  } catch (error) {
    console.error('❌ Erreur traitement localisation:', error);
    bot.sendMessage(chatId, "❌ Erreur lors du traitement de la position. Réessayez.", mainMenu);
  }
});

// Send checklist
async function sendChecklist(chatId) {
  const keyboard = [
    [{ text: "❌ Vérifier position train", callback_data: 'check1' }],
    [{ text: "❌ Contacter chef chantier", callback_data: 'check2' }],
    [{ text: "❌ Activer signalisations", callback_data: 'check3' }],
    [{ text: "❌ Bloquer circulation voie", callback_data: 'check4' }],
    [{ text: "❌ Confirmer mise hors voie", callback_data: 'check5' }]
  ];
  
  bot.sendMessage(chatId, "✅ *Checklist de sécurité ferroviaire* :", {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

// Handle callback queries (checklist)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();
  const userName = query.from.first_name || 'Utilisateur';
  const data = query.data;
  
  try {
    if (data.startsWith('check')) {
      // Handle checklist items
      const steps = [
        { code: 'check1', label: "Vérifier position train" },
        { code: 'check2', label: "Contacter chef chantier" },
        { code: 'check3', label: "Activer signalisations" },
        { code: 'check4', label: "Bloquer circulation voie" },
        { code: 'check5', label: "Confirmer mise hors voie" }
      ];
      
      const step = steps.find(s => s.code === data);
      if (step) {
        // Save checklist action to Firestore
        await firestore.saveMessage({
          userId,
          userName,
          message: `✅ Checklist: ${step.label}`,
          type: 'checklist',
          status: 'normal',
          chatId
        });
        
        bot.answerCallbackQuery(query.id, { text: `✅ ${step.label} validé` });
      }
    }
  } catch (error) {
    console.error('❌ Erreur callback query:', error);
    bot.answerCallbackQuery(query.id, { text: "❌ Erreur" });
  }
});

// Handle emergency
async function handleEmergency(chatId, userName, userId) {
  try {
    // Get last known location
    const locations = await firestore.getLocations({ userId, limit: 1 });
    const lastLocation = locations[0];
    
    const alertMsg = `🚨 *ALERTE D'URGENCE FERROVIAIRE*\n\n` +
      `👤 Opérateur: ${userName}\n` +
      `🆔 ID: ${userId}\n` +
      `⏰ Heure: ${moment().format('DD/MM/YYYY HH:mm:ss')}\n\n` +
      (lastLocation ? 
        `📍 Dernière position connue:\n` +
        `• PK: ${lastLocation.pkSNCF}\n` +
        `• Coordonnées: ${lastLocation.latitude}, ${lastLocation.longitude}\n` +
        `• [Voir sur carte](https://www.geoportail.gouv.fr/carte?c=${lastLocation.longitude},${lastLocation.latitude}&z=19&l=TRANSPORTNETWORKS.RAILWAYS)` :
        `❌ Position non disponible. Demander position immédiatement.`);
    
    // Save emergency message
    await firestore.saveMessage({
      userId,
      userName,
      message: '🚨 ALERTE D\'URGENCE DÉCLENCHÉE',
      type: 'emergency',
      status: 'urgent',
      location: lastLocation ? { 
        latitude: lastLocation.latitude, 
        longitude: lastLocation.longitude, 
        pkSNCF: lastLocation.pkSNCF 
      } : null,
      chatId
    });
    
    // Send to admin
    bot.sendMessage(config.telegram.adminChatId, alertMsg, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: "📞 Contacter opérateur", callback_data: `contact_${userId}` }
        ]]
      }
    });
    
    // Confirm to user
    bot.sendMessage(chatId, "🚨 *Alerte d'urgence envoyée aux administrateurs*\n\nVotre position a été transmise. Restez en sécurité.", {
      parse_mode: 'Markdown',
      ...mainMenu
    });
    
  } catch (error) {
    console.error('❌ Erreur alerte urgence:', error);
    bot.sendMessage(chatId, "❌ Erreur lors de l'envoi de l'alerte. Contactez directement les secours.", mainMenu);
  }
}

// Send technical sheets
async function sendTechnicalSheets(chatId) {
  const sheets = [
    {
      title: "📘 Fiche Machine CAT M323F",
      content: "Engin : CAT M323F Rail-Route\n✅ Emprise ferroviaire validée\n🔧 Équipements : rototilt, benne preneuse, remorque\n🔒 Sécurisation : signalisation, vérif OCP\n📍 Position à envoyer avant intervention."
    },
    {
      title: "🚦 Procédures de sécurité",
      content: "1. Vérifier position train\n2. Contacter chef chantier\n3. Activer signalisations\n4. Bloquer circulation voie\n5. Confirmer mise hors voie"
    },
    {
      title: "📞 Contacts d'urgence",
      content: "🚨 Urgence : 112\n🚦 SNCF : 3635\n👷 Chef chantier : [Numéro local]\n🔧 Maintenance : [Numéro local]"
    }
  ];
  
  for (const sheet of sheets) {
    bot.sendMessage(chatId, `*${sheet.title}*\n\n${sheet.content}`, {
      parse_mode: 'Markdown'
    });
  }
  
  bot.sendMessage(chatId, "📘 Utilisez le menu pour d'autres actions 👇", mainMenu);
}

// Send history
async function sendHistory(chatId, userId) {
  try {
    const messages = await firestore.getMessages({ userId, limit: 10 });
    
    if (messages.length === 0) {
      bot.sendMessage(chatId, "📊 Aucun historique disponible.", mainMenu);
      return;
    }
    
    let historyMsg = "📊 *Votre historique récent:*\n\n";
    
    messages.forEach((msg, index) => {
      const timestamp = Utils.formatTimestamp(msg.createdAt, 'DD/MM HH:mm');
      const typeIcon = msg.type === 'photo' ? '📸' : msg.type === 'location' ? '📍' : '💬';
      historyMsg += `${index + 1}. ${typeIcon} ${msg.message || 'Sans message'} (${timestamp})\n`;
    });
    
    bot.sendMessage(chatId, historyMsg, { 
      parse_mode: 'Markdown',
      ...mainMenu 
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération historique:', error);
    bot.sendMessage(chatId, "❌ Erreur lors de la récupération de l'historique.", mainMenu);
  }
}

// Send settings
async function sendSettings(chatId) {
  const settingsMsg = "🔧 *Paramètres LR ASSIST*\n\n" +
    "📱 Notifications : Activées\n" +
    "📍 GPS : Activé\n" +
    "📸 Upload photos : Activé\n" +
    "🚦 PK SNCF : Calcul automatique\n\n" +
    "Pour modifier les paramètres, contactez l'administrateur.";
  
  bot.sendMessage(chatId, settingsMsg, { 
    parse_mode: 'Markdown',
    ...mainMenu 
  });
}

// Send help
async function sendHelp(chatId) {
  const helpMsg = `ℹ️ *Aide LR ASSIST*\n\n` +
    `🚦 Application de terrain pour opérateurs ferroviaires\n\n` +
    `📸 *Photo* : Signalement problème avec métadonnées\n` +
    `📍 *Position* : Envoi GPS avec calcul PK SNCF automatique\n` +
    `✅ *Checklist* : Étapes sécurité avant intervention\n` +
    `⚠️ *Urgence* : Déclenche alerte immédiate\n` +
    `📘 *Fiches techniques* : Documents machines ferroviaires\n` +
    `📊 *Historique* : Consultation actions récentes\n\n` +
    `👨‍🔧 Compatible : CAT M323F, OCP, signalisation, zone d'emprise ferroviaire\n\n` +
    `🔗 Support : Contactez l'administrateur`;
  
  bot.sendMessage(chatId, helpMsg, { 
    parse_mode: 'Markdown',
    ...mainMenu 
  });
}

// Download file utility
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete the file async
      reject(err);
    });
  });
}

// Error handling
bot.on('error', (error) => {
  console.error('❌ Erreur bot Telegram:', error);
});

bot.on('polling_error', (error) => {
  console.error('❌ Erreur polling Telegram:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du bot LR ASSIST...');
  bot.stopPolling();
  process.exit(0);
});

console.log("🚦 BOT LR ASSIST démarré avec Firebase et Geoportail");
console.log("📱 En écoute des messages...");
console.log("🔧 Console CLI disponible avec: npm run console");
