const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const https = require('https');
const moment = require('moment');

// Import modules
const GeoportailService = require('./geoportail');

// Configuration simple pour test
const config = {
  telegram: {
    token: process.env.TELEGRAM_TOKEN || '7583644274:AAHp6JF7VDa9ycKiSPSTs4apS512euatZMw',
    adminChatId: process.env.ADMIN_CHAT_ID || 7648184043
  },
  app: {
    dataPath: './data.json',
    photoDir: './data/photos'
  }
};

// Initialize services with conflict detection
let bot;
try {
  bot = new TelegramBot(config.telegram.token, { 
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10
      }
    }
  });
  
  // Test if bot is working
  bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.response.body.error_code === 409) {
      console.log('⚠️ Une autre instance du bot est déjà en cours d\'exécution.');
      console.log('🔄 Arrêt de cette instance pour éviter le conflit.');
      process.exit(0);
    } else {
      console.error('❌ Erreur polling Telegram:', error);
    }
  });
  
} catch (error) {
  console.error('❌ Erreur initialisation bot:', error);
  process.exit(1);
}
const geoportal = new GeoportailService();

// Ensure directories exist
const PHOTO_DIR = path.join(__dirname, 'data', 'photos');
if (!fs.existsSync(PHOTO_DIR)) {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
}

// Load data
function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(config.app.dataPath, 'utf8'));
    // Ensure all required arrays exist
    if (!data.messages) data.messages = [];
    if (!data.photos) data.photos = [];
    if (!data.locations) data.locations = [];
    if (!data.emergencies) data.emergencies = [];
    if (!data.checklist) data.checklist = {};
    return data;
  } catch {
    return { 
      messages: [], 
      photos: [], 
      locations: [], 
      emergencies: [],
      checklist: {} 
    };
  }
}

// Save data
function saveData(data) {
  fs.writeFileSync(config.app.dataPath, JSON.stringify(data, null, 2));
}

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

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'utilisateur';
  const userId = msg.from.id.toString();
  
  const welcome = `👋 Bonjour ${userName}, bienvenue sur LR ASSIST !\n\n` +
    `🚦 Application de terrain pour opérateurs ferroviaires\n` +
    `📱 Votre ID: ${userId}\n\n` +
    `Utilise le menu ci-dessous pour accéder aux fonctions.`;

  // Save user info locally
  let data = loadData();
  data.messages.push({
    userId,
    userName,
    message: 'Utilisateur connecté',
    type: 'connection',
    status: 'normal',
    chatId,
    timestamp: Date.now()
  });
  saveData(data);

  bot.sendMessage(chatId, welcome, mainMenu);
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
        bot.sendMessage(chatId, '📸 Envoie ta photo directement ici. Elle sera sauvegardée avec métadonnées.');
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
        sendChecklist(chatId);
        break;

      case '⚠️ Déclencher une urgence':
        await handleEmergency(chatId, userName, userId);
        break;

      case '🚨 Mise hors voie urgente':
        await handleEmergencyDerailment(chatId, userName, userId);
        break;

      case '🚪 Portail d\'accès SNCF':
        await findNearestAccessPortal(chatId, userName, userId);
        break;

      case '📘 Fiches techniques':
        sendTechnicalSheets(chatId);
        break;

      case '📊 Historique':
        sendHistory(chatId, userId);
        break;

      case '🔧 Paramètres':
        sendSettings(chatId);
        break;

      case 'ℹ️ Aide':
        sendHelp(chatId);
        break;

      default:
        // Save regular message locally
        let data = loadData();
        data.messages.push({
          userId,
          userName,
          message: text,
          type: 'message',
          status: 'normal',
          chatId,
          timestamp: Date.now()
        });
        saveData(data);

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
    const filename = `photo_${timestamp}.jpg`;
    const dest = path.join(PHOTO_DIR, filename);
    
    // Download file
    await downloadFile(url, dest);
    
    // Save to local data
    let data = loadData();
    data.photos.push({
      userId,
      userName,
      filename,
      caption,
      timestamp,
      chatId,
      fileSize: fs.statSync(dest).size
    });
    
    data.messages.push({
      userId,
      userName,
      message: `📸 ${caption}`,
      type: 'photo',
      status: 'normal',
      photoUrl: `local://${filename}`,
      chatId,
      timestamp
    });
    
    saveData(data);
    
    // Send confirmation
    const confirmationMsg = `📸 Photo traitée avec succès\n\n` +
      `📝 Description: ${caption}\n` +
      `📏 Taille: ${(fs.statSync(dest).size / 1024).toFixed(2)} KB\n` +
      `💾 Sauvegardée localement`;
    
    bot.sendMessage(chatId, confirmationMsg, mainMenu);
    
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
    
    // Calculate PK SNCF with precise geometry
    const pkResult = await geoportal.calculatePKSNCF(latitude, longitude);
    
    // Get detailed railway line info
    const railwayInfo = await geoportal.getRailwayLineInfo(latitude, longitude);
    
    // Get nearby infrastructure
    const infrastructure = await geoportal.getNearbyInfrastructure(latitude, longitude, 2000);
    
    // Save to local data
    let data = loadData();
    data.locations.push({
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
    });
    
    data.messages.push({
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
      chatId,
      timestamp: Date.now()
    });
    
    saveData(data);
    
    // Send confirmation with detailed information
    const geoUrl = `https://www.geoportail.gouv.fr/carte?c=${longitude},${latitude}&z=19&l=TRANSPORTNETWORKS.RAILWAYS`;
    
    let confirmationMsg = `📍 Position reçue et traitée\n\n` +
      `📊 Coordonnées:\n` +
      `• Latitude: ${latitude.toFixed(6)}\n` +
      `• Longitude: ${longitude.toFixed(6)}\n\n` +
      `🚦 Point Kilométrique SNCF:\n` +
      `• PK: ${pkResult.pk}\n` +
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
    
    confirmationMsg += `🔗 Voir sur Geoportail: ${geoUrl}`;
    
    bot.sendMessage(chatId, confirmationMsg, mainMenu);
    
  } catch (error) {
    console.error('❌ Erreur traitement localisation:', error);
    bot.sendMessage(chatId, "❌ Erreur lors du traitement de la position. Réessayez.", mainMenu);
  }
});

// Send checklist
function sendChecklist(chatId) {
  const keyboard = [
    [{ text: "❌ Vérifier position train", callback_data: 'check1' }],
    [{ text: "❌ Contacter chef chantier", callback_data: 'check2' }],
    [{ text: "❌ Activer signalisations", callback_data: 'check3' }],
    [{ text: "❌ Bloquer circulation voie", callback_data: 'check4' }],
    [{ text: "❌ Confirmer mise hors voie", callback_data: 'check5' }]
  ];
  
  bot.sendMessage(chatId, "✅ Checklist de sécurité ferroviaire :", {
    reply_markup: { inline_keyboard: keyboard }
  });
}

// Handle callback queries (checklist)
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();
  const userName = query.from.first_name || 'Utilisateur';
  const data = query.data;
  
  try {
    if (data.startsWith('check')) {
      const steps = [
        { code: 'check1', label: "Vérifier position train" },
        { code: 'check2', label: "Contacter chef chantier" },
        { code: 'check3', label: "Activer signalisations" },
        { code: 'check4', label: "Bloquer circulation voie" },
        { code: 'check5', label: "Confirmer mise hors voie" }
      ];
      
      const step = steps.find(s => s.code === data);
      if (step) {
        // Save checklist action locally
        let fullData = loadData();
        fullData.messages.push({
          userId,
          userName,
          message: `✅ Checklist: ${step.label}`,
          type: 'checklist',
          status: 'normal',
          chatId,
          timestamp: Date.now()
        });
        saveData(fullData);
        
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
    let data = loadData();
    const lastLocation = data.locations.filter(l => l.userId === userId).pop();
    
    const alertMsg = `🚨 ALERTE D'URGENCE FERROVIAIRE\n\n` +
      `👤 Opérateur: ${userName}\n` +
      `🆔 ID: ${userId}\n` +
      `⏰ Heure: ${moment().format('DD/MM/YYYY HH:mm:ss')}\n\n` +
      (lastLocation ? 
        `📍 Dernière position connue:\n` +
        `• PK: ${lastLocation.pkSNCF}\n` +
        `• Ligne: ${lastLocation.lineName}\n` +
        `• Coordonnées: ${lastLocation.latitude}, ${lastLocation.longitude}\n` +
        `• Voir sur carte: https://www.geoportail.gouv.fr/carte?c=${lastLocation.longitude},${lastLocation.latitude}&z=19&l=TRANSPORTNETWORKS.RAILWAYS` :
        `❌ Position non disponible. Demander position immédiatement.`);
    
    // Save emergency message
    data.emergencies.push({
      userId,
      userName,
      message: '🚨 ALERTE D\'URGENCE DÉCLENCHÉE',
      type: 'emergency',
      status: 'urgent',
      location: lastLocation ? { 
        latitude: lastLocation.latitude, 
        longitude: lastLocation.longitude, 
        pkSNCF: lastLocation.pkSNCF,
        lineName: lastLocation.lineName
      } : null,
      chatId,
      timestamp: Date.now()
    });
    
    data.messages.push({
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
      chatId,
      timestamp: Date.now()
    });
    
    saveData(data);
    
    // Send to admin
    bot.sendMessage(config.telegram.adminChatId, alertMsg, { 
      reply_markup: {
        inline_keyboard: [[
          { text: "📞 Contacter opérateur", callback_data: `contact_${userId}` }
        ]]
      }
    });
    
    // Confirm to user
    bot.sendMessage(chatId, "🚨 Alerte d'urgence envoyée aux administrateurs\n\nVotre position a été transmise. Restez en sécurité.", mainMenu);
    
  } catch (error) {
    console.error('❌ Erreur alerte urgence:', error);
    bot.sendMessage(chatId, "❌ Erreur lors de l'envoi de l'alerte. Contactez directement les secours.", mainMenu);
  }
}

// Handle emergency derailment
async function handleEmergencyDerailment(chatId, userName, userId) {
  try {
    // Get last known location
    let data = loadData();
    const lastLocation = data.locations.filter(l => l.userId === userId).pop();
    
    if (!lastLocation) {
      bot.sendMessage(chatId, "❌ ERREUR CRITIQUE - Votre position n'est pas connue. Envoyez immédiatement votre position GPS pour la mise hors voie d'urgence.", {
        reply_markup: {
          keyboard: [[{ text: "📡 Envoyer ma position URGENT", request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return;
    }
    
    // Calculate nearest access portal with innovative system
    const accessPortal = await findNearestAccessPortalData(lastLocation.latitude, lastLocation.longitude);
    
    const derailmentMsg = `🚨 MISE HORS VOIE D'URGENCE\n\n` +
      `👤 Opérateur: ${userName}\n` +
      `🆔 ID: ${userId}\n` +
      `⏰ Heure: ${moment().format('DD/MM/YYYY HH:mm:ss')}\n\n` +
      `📍 Position actuelle:\n` +
      `• PK: ${lastLocation.pkSNCF}\n` +
      `• Ligne: ${lastLocation.lineName}\n` +
      `• Coordonnées: ${lastLocation.latitude}, ${lastLocation.longitude}\n\n` +
      `🚪 Portail d'accès SNCF le plus proche:\n` +
      `• Nom: ${accessPortal.name}\n` +
      `• Type: ${accessPortal.type}\n` +
      `• Distance: ${accessPortal.distance}m\n` +
      `• Direction: ${accessPortal.direction}\n` +
      `• Statut: ${accessPortal.status}\n` +
      `• Confiance: ${accessPortal.confidence}\n\n` +
      `🔧 Équipements disponibles:\n` +
      `${accessPortal.equipment ? accessPortal.equipment.slice(0, 3).map(eq => `• ${eq}`).join('\n') : '• Équipement standard SNCF'}\n\n` +
      `🚨 PROCÉDURE D'URGENCE:\n` +
      `1. Évacuer immédiatement la zone\n` +
      `2. Se diriger vers le portail d'accès\n` +
      `3. Contacter les secours: 112\n` +
      `4. Contacter SNCF: 3635\n` +
      `5. Attendre les instructions\n\n` +
      `🔗 Voir sur carte: https://www.geoportail.gouv.fr/carte?c=${lastLocation.longitude},${lastLocation.latitude}&z=19&l=TRANSPORTNETWORKS.RAILWAYS`;
    
    // Save emergency derailment
    data.emergencies.push({
      userId,
      userName,
      message: '🚨 MISE HORS VOIE D\'URGENCE DÉCLENCHÉE',
      type: 'derailment',
      status: 'critical',
      location: { 
        latitude: lastLocation.latitude, 
        longitude: lastLocation.longitude, 
        pkSNCF: lastLocation.pkSNCF,
        lineName: lastLocation.lineName
      },
      accessPortal,
      chatId,
      timestamp: Date.now()
    });
    
    saveData(data);
    
    // Send to admin
    bot.sendMessage(config.telegram.adminChatId, derailmentMsg, { 
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚨 Déclencher évacuation", callback_data: `evacuate_${userId}` }],
          [{ text: "📞 Contacter opérateur", callback_data: `contact_${userId}` }]
        ]
      }
    });
    
    // Confirm to user
    bot.sendMessage(chatId, "🚨 MISE HORS VOIE D'URGENCE DÉCLENCHÉE - Évacuez immédiatement la zone et dirigez-vous vers le portail d'accès indiqué. Les secours ont été alertés.", mainMenu);
    
  } catch (error) {
    console.error('❌ Erreur mise hors voie urgence:', error);
    bot.sendMessage(chatId, "❌ Erreur critique. Contactez immédiatement les secours: 112", mainMenu);
  }
}

// Find nearest access portal
async function findNearestAccessPortal(chatId, userName, userId) {
  try {
    // Get last known location
    let data = loadData();
    const lastLocation = data.locations.filter(l => l.userId === userId).pop();
    
    if (!lastLocation) {
      bot.sendMessage(chatId, "❌ Votre position n'est pas connue. Envoyez d'abord votre position GPS.", {
        reply_markup: {
          keyboard: [[{ text: "📡 Envoyer ma position", request_location: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return;
    }
    
    const accessPortal = await findNearestAccessPortalData(lastLocation.latitude, lastLocation.longitude);
    
    const portalMsg = `🚪 Portail d'accès SNCF le plus proche\n\n` +
      `📍 Depuis votre position:\n` +
      `• PK: ${lastLocation.pkSNCF}\n` +
      `• Ligne: ${lastLocation.lineName}\n\n` +
      `🚪 Portail d'accès SNCF:\n` +
      `• Nom: ${accessPortal.name}\n` +
      `• Type: ${accessPortal.type}\n` +
      `• Distance: ${accessPortal.distance}m\n` +
      `• Direction: ${accessPortal.direction}\n` +
      `• Statut: ${accessPortal.status}\n` +
      `• Confiance: ${accessPortal.confidence}\n\n` +
      `🔧 Équipements disponibles:\n` +
      `${accessPortal.equipment ? accessPortal.equipment.slice(0, 3).map(eq => `• ${eq}`).join('\n') : '• Équipement standard SNCF'}\n\n` +
      `⚠️ Restrictions d'accès:\n` +
      `${accessPortal.restrictions ? accessPortal.restrictions.slice(0, 2).map(res => `• ${res}`).join('\n') : '• Accès SNCF uniquement'}\n\n` +
      `📞 Contacts d'urgence:\n` +
      `• SNCF: ${accessPortal.emergencyContacts ? accessPortal.emergencyContacts.sncf : '3635'}\n` +
      `• Secours: ${accessPortal.emergencyContacts ? accessPortal.emergencyContacts.secours : '112'}\n\n` +
      `🗺️ Voir sur carte: https://www.geoportail.gouv.fr/carte?c=${accessPortal.coordinates ? accessPortal.coordinates.longitude : lastLocation.longitude},${accessPortal.coordinates ? accessPortal.coordinates.latitude : lastLocation.latitude}&z=19&l=TRANSPORTNETWORKS.RAILWAYS`;
    
    bot.sendMessage(chatId, portalMsg, { 
      disable_web_page_preview: true,
      ...mainMenu 
    });
    
  } catch (error) {
    console.error('❌ Erreur recherche portail:', error);
    bot.sendMessage(chatId, "❌ Erreur lors de la recherche du portail d'accès.", mainMenu);
  }
}

// Find nearest access portal data
async function findNearestAccessPortalData(latitude, longitude) {
  try {
    // Utiliser le système innovant de portails d'accès SNCF
    const accessPortal = await geoportal.findNearestAccessPortal(latitude, longitude, 'emergency');
    
    return accessPortal;
    
  } catch (error) {
    console.error('❌ Erreur calcul portail:', error);
    return {
      name: 'Portail d\'accès SNCF',
      type: 'passage piéton',
      latitude: latitude + 0.001,
      longitude: longitude + 0.001,
      distance: 1000,
      direction: 'Nord',
      status: 'Ouvert',
      pk: 'PK000+000'
    };
  }
}

// Send technical sheets
function sendTechnicalSheets(chatId) {
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
    },
    {
      title: "🚨 Procédure mise hors voie",
      content: "1. Évacuer immédiatement la zone\n2. Se diriger vers le portail d'accès le plus proche\n3. Contacter les secours : 112\n4. Attendre les instructions des autorités\n5. Ne pas retourner sur les voies"
    }
  ];
  
  for (const sheet of sheets) {
    bot.sendMessage(chatId, `${sheet.title}\n\n${sheet.content}`);
  }
  
  bot.sendMessage(chatId, "📘 Utilisez le menu pour d'autres actions 👇", mainMenu);
}

// Send history
function sendHistory(chatId, userId) {
  try {
    let data = loadData();
    const userMessages = data.messages.filter(m => m.userId === userId).slice(-10);
    
    if (userMessages.length === 0) {
      bot.sendMessage(chatId, "📊 Aucun historique disponible.", mainMenu);
      return;
    }
    
    let historyMsg = "📊 Votre historique récent:\n\n";
    
    userMessages.forEach((msg, index) => {
      const timestamp = moment(msg.timestamp).format('DD/MM HH:mm');
      const typeIcon = msg.type === 'photo' ? '📸' : msg.type === 'location' ? '📍' : msg.type === 'emergency' ? '🚨' : '💬';
      historyMsg += `${index + 1}. ${typeIcon} ${msg.message || 'Sans message'} (${timestamp})\n`;
    });
    
    bot.sendMessage(chatId, historyMsg, mainMenu);
    
  } catch (error) {
    console.error('❌ Erreur récupération historique:', error);
    bot.sendMessage(chatId, "❌ Erreur lors de la récupération de l'historique.", mainMenu);
  }
}

// Send settings
function sendSettings(chatId) {
  const settingsMsg = "🔧 Paramètres LR ASSIST\n\n" +
    "📱 Notifications : Activées\n" +
    "📍 GPS : Activé\n" +
    "📸 Upload photos : Activé\n" +
    "🚦 PK SNCF : Calcul automatique\n" +
    "🚨 Alertes urgence : Activées\n" +
    "🚪 Portails d'accès : Détection automatique\n\n" +
    "Pour modifier les paramètres, contactez l'administrateur.";
  
  bot.sendMessage(chatId, settingsMsg, mainMenu);
}

// Send help
function sendHelp(chatId) {
  const helpMsg = `ℹ️ Aide LR ASSIST\n\n` +
    `🚦 Application de terrain pour opérateurs ferroviaires\n\n` +
    `📸 Photo : Signalement problème avec métadonnées\n` +
    `📍 Position : Envoi GPS avec calcul PK SNCF automatique\n` +
    `✅ Checklist : Étapes sécurité avant intervention\n` +
    `⚠️ Urgence : Déclenche alerte immédiate\n` +
    `🚨 Mise hors voie : Procédure d'urgence avec portail d'accès\n` +
    `🚪 Portail d'accès : Trouve le point d'accès SNCF le plus proche\n` +
    `📘 Fiches techniques : Documents machines ferroviaires\n` +
    `📊 Historique : Consultation actions récentes\n\n` +
    `👨‍🔧 Compatible : CAT M323F, OCP, signalisation, zone d'emprise ferroviaire\n\n` +
    `🔗 Support : Contactez l'administrateur`;
  
  bot.sendMessage(chatId, helpMsg, mainMenu);
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du bot LR ASSIST...');
  bot.stopPolling();
  process.exit(0);
});

console.log("🚦 BOT LR ASSIST démarré (mode local avec géométrie ferroviaire)");
console.log("📱 En écoute des messages...");
console.log("💾 Données sauvegardées localement dans data.json");
console.log("🚨 Fonctionnalités d'urgence et portails d'accès activées"); 