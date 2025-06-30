const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const https = require('https');
const moment = require('moment');

// Import modules
const GeoportailService = require('./geoportail');
const RailwayAccessPortals = require('./railway-access-portals');

// Configuration avancée
const config = {
  telegram: {
    token: '7583644274:AAHp6JF7VDa9ycKiSPSTs4apS512euatZMw',
    adminChatId: 7648184043
  },
  app: {
    dataPath: './data.json',
    photoDir: './data/photos',
    logsDir: './logs'
  },
  railway: {
    maxDistance: 5000, // Distance max pour détection PK
    confidenceThreshold: 0.7
  }
};

// Initialize services
let bot;
try {
  bot = new TelegramBot(config.telegram.token, { 
    polling: {
      interval: 300,
      autoStart: true,
      params: { timeout: 10 }
    }
  });
  
  bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.response.body.error_code === 409) {
      console.log('⚠️ Instance déjà en cours. Arrêt...');
      process.exit(0);
    } else {
      console.error('❌ Erreur polling:', error);
    }
  });
  
} catch (error) {
  console.error('❌ Erreur bot:', error);
  process.exit(1);
}

const geoportal = new GeoportailService();
const accessPortals = new RailwayAccessPortals();

// Ensure directories
const dirs = [config.app.photoDir, config.app.logsDir];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Menu principal avancé
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📸 Photo chantier', '📍 Position GPS'],
      ['🚨 Urgence chantier', '🚪 Portail accès'],
      ['✅ Checklist sécurité', '🔧 Équipement'],
      ['📊 Rapport chantier', '📘 Fiches techniques'],
      ['🗺️ Carte chantier', '⚙️ Paramètres']
    ],
    resize_keyboard: true
  }
};

// Menu chantier
const chantierMenu = {
  reply_markup: {
    keyboard: [
      ['🏗️ Début chantier', '🏁 Fin chantier'],
      ['⚠️ Problème technique', '🚧 Signalisation'],
      ['📋 État équipement', '👥 Équipe chantier'],
      ['🔙 Menu principal']
    ],
    resize_keyboard: true
  }
};

// Load/Save data
function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(config.app.dataPath, 'utf8'));
    return {
      messages: data.messages || [],
      photos: data.photos || [],
      locations: data.locations || [],
      emergencies: data.emergencies || [],
      chantiers: data.chantiers || [],
      equipments: data.equipments || [],
      checklists: data.checklists || {},
      users: data.users || {}
    };
  } catch {
    return {
      messages: [], photos: [], locations: [], emergencies: [],
      chantiers: [], equipments: [], checklists: {}, users: {}
    };
  }
}

function saveData(data) {
  fs.writeFileSync(config.app.dataPath, JSON.stringify(data, null, 2));
}

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || 'Opérateur';
  const userId = msg.from.id.toString();
  
  const welcome = `🚦 *LR ASSIST - Bot Ferroviaire Avancé*\n\n` +
    `👋 Bonjour ${userName} !\n` +
    `🆔 ID: \`${userId}\`\n\n` +
    `🚧 *Fonctionnalités chantier:*\n` +
    `• 📸 Photos avec géolocalisation\n` +
    `• 📍 PK SNCF automatique\n` +
    `• 🚪 Portails d'accès intelligents\n` +
    `• 🚨 Alertes d'urgence\n` +
    `• ✅ Checklists sécurité\n` +
    `• 📊 Rapports chantier\n\n` +
    `🔧 Compatible: CAT M323F, pelles rail-route, OCP\n\n` +
    `Utilisez le menu pour commencer !`;

  // Save user
  let data = loadData();
  data.users[userId] = {
    name: userName,
    chatId,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    role: 'operateur',
    permissions: ['chantier', 'urgence', 'photo', 'localisation']
  };
  saveData(data);

  bot.sendMessage(chatId, welcome, { 
    parse_mode: 'Markdown',
    ...mainMenu 
  });
});

// Handle messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Opérateur';
  
  if (!text || text.startsWith('/')) return;

  console.log(`📩 ${userName} (${userId}) => ${text}`);

  try {
    switch (text) {
      case '📸 Photo chantier':
        bot.sendMessage(chatId, '📸 Envoyez une photo de votre chantier. Elle sera géolocalisée et analysée.');
        break;

      case '📍 Position GPS':
        bot.sendMessage(chatId, '📍 Envoyez votre position GPS pour calculer le PK SNCF et trouver le portail d\'accès le plus proche 👇', {
          reply_markup: {
            keyboard: [[{ text: "📡 Envoyer position", request_location: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
        break;

      case '🚨 Urgence chantier':
        await handleChantierEmergency(chatId, userName, userId);
        break;

      case '🚪 Portail accès':
        await findAccessPortal(chatId, userName, userId);
        break;

      case '✅ Checklist sécurité':
        sendSecurityChecklist(chatId);
        break;

      case '🔧 Équipement':
        sendEquipmentMenu(chatId);
        break;

      case '📊 Rapport chantier':
        await generateChantierReport(chatId, userId);
        break;

      case '📘 Fiches techniques':
        sendTechnicalDocs(chatId);
        break;

      case '🗺️ Carte chantier':
        await sendChantierMap(chatId, userId);
        break;

      case '⚙️ Paramètres':
        sendSettings(chatId);
        break;

      case '🏗️ Début chantier':
        await startChantier(chatId, userName, userId);
        break;

      case '🏁 Fin chantier':
        await endChantier(chatId, userName, userId);
        break;

      case '⚠️ Problème technique':
        await reportTechnicalIssue(chatId, userName, userId);
        break;

      case '🚧 Signalisation':
        await handleSignalisation(chatId, userName, userId);
        break;

      case '📋 État équipement':
        await checkEquipmentStatus(chatId, userId);
        break;

      case '👥 Équipe chantier':
        await manageChantierTeam(chatId, userName, userId);
        break;

      case '🔙 Menu principal':
        bot.sendMessage(chatId, '🔙 Retour au menu principal', mainMenu);
        break;

      default:
        // Save message
        let data = loadData();
        data.messages.push({
          userId, userName, message: text, type: 'message',
          status: 'normal', chatId, timestamp: Date.now()
        });
        saveData(data);

        bot.sendMessage(chatId, "✅ Message enregistré. Utilisez le menu pour les actions spécifiques 👇", mainMenu);
    }
  } catch (error) {
    console.error('❌ Erreur traitement:', error);
    bot.sendMessage(chatId, "❌ Erreur. Réessayez.", mainMenu);
  }
});

// Handle photos with advanced analysis
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Opérateur';
  const caption = msg.caption || 'Photo chantier';
  
  try {
    console.log('📸 Traitement photo chantier...');
    
    // Get photo
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
    
    // Download
    const timestamp = Date.now();
    const filename = `chantier_${timestamp}.jpg`;
    const dest = path.join(config.app.photoDir, filename);
    await downloadFile(url, dest);
    
    // Get last location for geolocation
    let data = loadData();
    const lastLocation = data.locations.filter(l => l.userId === userId).pop();
    
    // Save photo with metadata
    const photoData = {
      userId, userName, filename, caption, timestamp, chatId,
      fileSize: fs.statSync(dest).size,
      location: lastLocation ? {
        latitude: lastLocation.latitude,
        longitude: lastLocation.longitude,
        pkSNCF: lastLocation.pkSNCF,
        lineName: lastLocation.lineName
      } : null,
      type: 'chantier',
      analysis: {
        timestamp: Date.now(),
        status: 'pending'
      }
    };
    
    data.photos.push(photoData);
    data.messages.push({
      userId, userName, message: `📸 ${caption}`,
      type: 'photo', status: 'normal',
      photoUrl: `local://${filename}`, chatId, timestamp
    });
    saveData(data);
    
    // Send confirmation with analysis
    const analysisMsg = `📸 *Photo chantier traitée*\n\n` +
      `📝 Description: ${caption}\n` +
      `📏 Taille: ${(fs.statSync(dest).size / 1024).toFixed(2)} KB\n` +
      `💾 Sauvegardée localement\n` +
      (lastLocation ? 
        `📍 Géolocalisée: ${lastLocation.pkSNCF} (${lastLocation.lineName})\n` :
        `⚠️ Pas de géolocalisation disponible\n`);
    
    bot.sendMessage(chatId, analysisMsg, { 
      parse_mode: 'Markdown',
      ...mainMenu 
    });
    
  } catch (error) {
    console.error('❌ Erreur photo:', error);
    bot.sendMessage(chatId, "❌ Erreur traitement photo. Réessayez.", mainMenu);
  }
});

// Handle location with advanced PK calculation
bot.on('location', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userName = msg.from.first_name || 'Opérateur';
  const { latitude, longitude } = msg.location;
  
  try {
    // Calculate PK SNCF
    const pkResult = await geoportal.calculatePKSNCF(latitude, longitude);
    // Find nearest access portal
    const accessPortal = await accessPortals.findNearestAccessPortal(latitude, longitude, 'emergency');
    // Save location
    let data = loadData();
    data.locations.push({
      userId, userName, latitude, longitude,
      pkSNCF: pkResult.pk,
      pkEstime: pkResult.method && pkResult.method.toLowerCase().includes('estimation'),
      confidence: pkResult.confidence,
      distance: pkResult.distance,
      method: pkResult.method,
      accessPortal, timestamp: Date.now(), chatId
    });
    saveData(data);
    // Message PK
    let pkMsg = `• PK: ${pkResult.pk}`;
    if (pkResult.method && pkResult.method.toLowerCase().includes('estimation')) {
      pkMsg += " (estimé)";
    }
    // Message portail
    let portalMsg = '';
    if (accessPortal && accessPortal.name === 'Aucun portail SNCF proche') {
      portalMsg = `🚫 Aucun portail SNCF n'est disponible à proximité (moins de 5 km).`;
    } else {
      portalMsg = `🚪 Portail d'accès SNCF le plus proche :\n` +
        `• Nom: ${accessPortal.name}\n` +
        `• Type: ${accessPortal.type || 'N/A'}\n` +
        `• Distance: ${accessPortal.distance !== null ? accessPortal.distance + 'm' : 'N/A'}\n` +
        `• Statut: ${accessPortal.status || 'N/A'}\n` +
        `• Confiance: ${accessPortal.confidence || 'N/A'}\n` +
        `• Équipements: ${(accessPortal.equipment && accessPortal.equipment.length > 0) ? accessPortal.equipment.slice(0, 3).map(eq => `- ${eq}`).join(' ') : 'N/A'}\n` +
        `• Contacts d'urgence: SNCF ${accessPortal.emergencyContacts ? accessPortal.emergencyContacts.sncf : '3635'}, Secours ${accessPortal.emergencyContacts ? accessPortal.emergencyContacts.secours : '112'}`;
    }
    bot.sendMessage(chatId, `📍 Position enregistrée :\n${pkMsg}\n\n${portalMsg}`, { parse_mode: 'Markdown', ...mainMenu });
  } catch (error) {
    console.error('❌ Erreur localisation:', error);
    bot.sendMessage(chatId, "❌ Erreur traitement position. Réessayez.", mainMenu);
  }
});

// Advanced functions
async function handleChantierEmergency(chatId, userName, userId) {
  try {
    let data = loadData();
    const lastLocation = data.locations.filter(l => l.userId === userId).pop();
    
    if (!lastLocation) {
      bot.sendMessage(chatId, "❌ Position non disponible. Envoyez d'abord votre position GPS.", {
        reply_markup: {
          keyboard: [[{ text: "📡 Envoyer position URGENT", request_location: true }]],
          resize_keyboard: true, one_time_keyboard: true
        }
      });
      return;
    }
    
    const accessPortal = await accessPortals.findNearestAccessPortal(
      lastLocation.latitude, lastLocation.longitude, 'emergency'
    );
    
    const emergencyMsg = `🚨 *URGENCE CHANTIER FERROVIAIRE*\n\n` +
      `👤 Opérateur: ${userName}\n` +
      `🆔 ID: \`${userId}\`\n` +
      `⏰ Heure: ${moment().format('DD/MM/YYYY HH:mm:ss')}\n\n` +
      `📍 *Position chantier:*\n` +
      `• PK: \`${lastLocation.pkSNCF}\`\n` +
      `• Ligne: ${lastLocation.lineName}\n` +
      `• Coordonnées: ${lastLocation.latitude}, ${lastLocation.longitude}\n\n` +
      `🚪 *Portail d'accès d'urgence:*\n` +
      `• Nom: ${accessPortal.name}\n` +
      `• Distance: ${accessPortal.distance}m\n` +
      `• Direction: ${accessPortal.direction}\n` +
      `• Statut: ${accessPortal.status}\n\n` +
      `🚨 *PROCÉDURE D'URGENCE:*\n` +
      `1. Arrêter immédiatement les travaux\n` +
      `2. Sécuriser la zone\n` +
      `3. Évacuer vers le portail d'accès\n` +
      `4. Contacter les secours: 112\n` +
      `5. Contacter SNCF: 3635\n\n` +
      `🔗 [Voir sur carte](https://www.geoportail.gouv.fr/carte?c=${lastLocation.longitude},${lastLocation.latitude}&z=19&l=TRANSPORTNETWORKS.RAILWAYS)`;
    
    // Save emergency
    data.emergencies.push({
      userId, userName, message: '🚨 URGENCE CHANTIER DÉCLENCHÉE',
      type: 'chantier_emergency', status: 'critical',
      location: { latitude: lastLocation.latitude, longitude: lastLocation.longitude, pkSNCF: lastLocation.pkSNCF },
      accessPortal, chatId, timestamp: Date.now()
    });
    saveData(data);
    
    // Send to admin
    bot.sendMessage(config.telegram.adminChatId, emergencyMsg, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚨 Déclencher évacuation", callback_data: `evacuate_${userId}` }],
          [{ text: "📞 Contacter opérateur", callback_data: `contact_${userId}` }],
          [{ text: "🚧 Arrêter chantier", callback_data: `stop_chantier_${userId}` }]
        ]
      }
    });
    
    bot.sendMessage(chatId, "🚨 *URGENCE CHANTIER DÉCLENCHÉE* - Arrêtez immédiatement les travaux et évacuez la zone !", {
      parse_mode: 'Markdown',
      ...mainMenu 
    });
    
  } catch (error) {
    console.error('❌ Erreur urgence:', error);
    bot.sendMessage(chatId, "❌ Erreur. Contactez directement les secours: 112", mainMenu);
  }
}

async function findAccessPortal(chatId, userName, userId) {
  try {
    let data = loadData();
    const lastLocation = data.locations.filter(l => l.userId === userId).pop();
    
    if (!lastLocation) {
      bot.sendMessage(chatId, "❌ Position non disponible. Envoyez d'abord votre position GPS.", {
        reply_markup: {
          keyboard: [[{ text: "📡 Envoyer position", request_location: true }]],
          resize_keyboard: true, one_time_keyboard: true
        }
      });
      return;
    }
    
    const accessPortal = await accessPortals.findNearestAccessPortal(
      lastLocation.latitude, lastLocation.longitude, 'emergency'
    );
    
    const portalMsg = `🚪 *Portail d'accès SNCF le plus proche*\n\n` +
      `📍 *Depuis votre position:*\n` +
      `• PK: \`${lastLocation.pkSNCF}\`\n` +
      `• Ligne: ${lastLocation.lineName}\n\n` +
      `🚪 *Portail d'accès SNCF:*\n` +
      `• Nom: ${accessPortal.name}\n` +
      `• Type: ${accessPortal.type}\n` +
      `• Distance: ${accessPortal.distance}m\n` +
      `• Direction: ${accessPortal.direction}\n` +
      `• Statut: ${accessPortal.status}\n` +
      `• Confiance: ${accessPortal.confidence}\n\n` +
      `🔧 *Équipements disponibles:*\n` +
      `${accessPortal.equipment ? accessPortal.equipment.slice(0, 3).map(eq => `• ${eq}`).join('\n') : '• Équipement standard SNCF'}\n\n` +
      `⚠️ *Restrictions d'accès:*\n` +
      `${accessPortal.restrictions ? accessPortal.restrictions.slice(0, 2).map(res => `• ${res}`).join('\n') : '• Accès SNCF uniquement'}\n\n` +
      `📞 *Contacts d'urgence:*\n` +
      `• SNCF: ${accessPortal.emergencyContacts ? accessPortal.emergencyContacts.sncf : '3635'}\n` +
      `• Secours: ${accessPortal.emergencyContacts ? accessPortal.emergencyContacts.secours : '112'}\n\n` +
      `🗺️ [Voir sur carte](https://www.geoportail.gouv.fr/carte?c=${accessPortal.coordinates ? accessPortal.coordinates.longitude : lastLocation.longitude},${accessPortal.coordinates ? accessPortal.coordinates.latitude : lastLocation.latitude}&z=19&l=TRANSPORTNETWORKS.RAILWAYS)`;
    
    bot.sendMessage(chatId, portalMsg, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...mainMenu 
    });
    
  } catch (error) {
    console.error('❌ Erreur portail:', error);
    bot.sendMessage(chatId, "❌ Erreur recherche portail.", mainMenu);
  }
}

function sendSecurityChecklist(chatId) {
  const keyboard = [
    [{ text: "❌ Vérifier position train", callback_data: 'check1' }],
    [{ text: "❌ Contacter chef chantier", callback_data: 'check2' }],
    [{ text: "❌ Activer signalisations", callback_data: 'check3' }],
    [{ text: "❌ Bloquer circulation voie", callback_data: 'check4' }],
    [{ text: "❌ Vérifier équipement", callback_data: 'check5' }],
    [{ text: "❌ Confirmer mise hors voie", callback_data: 'check6' }]
  ];
  
  bot.sendMessage(chatId, "✅ *Checklist de sécurité chantier ferroviaire* :", {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

function sendEquipmentMenu(chatId) {
  const keyboard = [
    [{ text: "🔧 CAT M323F", callback_data: 'equip_cat' }],
    [{ text: "🚧 Signalisation", callback_data: 'equip_signal' }],
    [{ text: "🛡️ Équipement sécurité", callback_data: 'equip_securite' }],
    [{ text: "📋 État général", callback_data: 'equip_etat' }]
  ];
  
  bot.sendMessage(chatId, "🔧 *Gestion équipement chantier* :", {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function generateChantierReport(chatId, userId) {
  try {
    let data = loadData();
    const userMessages = data.messages.filter(m => m.userId === userId).slice(-20);
    const userPhotos = data.photos.filter(p => p.userId === userId).slice(-10);
    const userLocations = data.locations.filter(l => l.userId === userId).slice(-5);
    
    let report = `📊 *Rapport chantier - ${moment().format('DD/MM/YYYY')}*\n\n`;
    
    if (userLocations.length > 0) {
      const lastLocation = userLocations[userLocations.length - 1];
      report += `📍 *Dernière position:*\n` +
        `• PK: \`${lastLocation.pkSNCF}\`\n` +
        `• Ligne: ${lastLocation.lineName}\n` +
        `• Heure: ${moment(lastLocation.timestamp).format('HH:mm')}\n\n`;
    }
    
    report += `📸 Photos: ${userPhotos.length}\n` +
      `📍 Positions: ${userLocations.length}\n` +
      `💬 Messages: ${userMessages.length}\n\n` +
      `📈 *Activité récente:*\n`;
    
    userMessages.slice(-5).forEach((msg, index) => {
      const time = moment(msg.timestamp).format('HH:mm');
      const icon = msg.type === 'photo' ? '📸' : msg.type === 'location' ? '📍' : '💬';
      report += `${index + 1}. ${icon} ${msg.message || 'Action'} (${time})\n`;
    });
    
    bot.sendMessage(chatId, report, { 
      parse_mode: 'Markdown',
      ...mainMenu 
    });
    
  } catch (error) {
    console.error('❌ Erreur rapport:', error);
    bot.sendMessage(chatId, "❌ Erreur génération rapport.", mainMenu);
  }
}

function sendTechnicalDocs(chatId) {
  const docs = [
    {
      title: "📘 CAT M323F - Fiche technique",
      content: "🚧 *Engin rail-route CAT M323F*\n\n" +
        "✅ Emprise ferroviaire validée\n" +
        "🔧 Équipements: rototilt, benne preneuse\n" +
        "🔒 Sécurisation: signalisation, vérif OCP\n" +
        "📍 Position à envoyer avant intervention\n" +
        "⚠️ Respect procédures SNCF obligatoire"
    },
    {
      title: "🚦 Procédures de sécurité",
      content: "🚦 *Procédures chantier ferroviaire*\n\n" +
        "1. Vérifier position train\n" +
        "2. Contacter chef chantier\n" +
        "3. Activer signalisations\n" +
        "4. Bloquer circulation voie\n" +
        "5. Vérifier équipement\n" +
        "6. Confirmer mise hors voie"
    },
    {
      title: "📞 Contacts d'urgence",
      content: "📞 *Contacts chantier*\n\n" +
        "🚨 Urgence: 112\n" +
        "🚦 SNCF: 3635\n" +
        "👷 Chef chantier: [Local]\n" +
        "🔧 Maintenance: [Local]\n" +
        "🚧 Signalisation: [Local]"
    }
  ];
  
  docs.forEach(doc => {
    bot.sendMessage(chatId, doc.content, { parse_mode: 'Markdown' });
  });
  
  bot.sendMessage(chatId, "📘 Utilisez le menu pour d'autres actions 👇", mainMenu);
}

async function sendChantierMap(chatId, userId) {
  try {
    let data = loadData();
    const lastLocation = data.locations.filter(l => l.userId === userId).pop();
    
    if (!lastLocation) {
      bot.sendMessage(chatId, "❌ Aucune position disponible. Envoyez d'abord votre position GPS.");
      return;
    }
    
    const mapUrl = `https://www.geoportail.gouv.fr/carte?c=${lastLocation.longitude},${lastLocation.latitude}&z=19&l=TRANSPORTNETWORKS.RAILWAYS`;
    
    const mapMsg = `🗺️ *Carte chantier*\n\n` +
      `📍 Position: \`${lastLocation.pkSNCF}\`\n` +
      `🚦 Ligne: ${lastLocation.lineName}\n` +
      `🔗 [Ouvrir carte Geoportail](${mapUrl})\n\n` +
      `📱 Utilisez cette carte pour:\n` +
      `• Localiser votre chantier\n` +
      `• Identifier les voies\n` +
      `• Repérer les accès\n` +
      `• Planifier les interventions`;
    
    bot.sendMessage(chatId, mapMsg, { 
      parse_mode: 'Markdown',
      ...mainMenu 
    });
    
  } catch (error) {
    console.error('❌ Erreur carte:', error);
    bot.sendMessage(chatId, "❌ Erreur génération carte.", mainMenu);
  }
}

function sendSettings(chatId) {
  const settingsMsg = "⚙️ *Paramètres LR ASSIST*\n\n" +
    "📱 Notifications: Activées\n" +
    "📍 GPS: Activé\n" +
    "📸 Upload photos: Activé\n" +
    "🚦 PK SNCF: Calcul automatique\n" +
    "🚨 Alertes urgence: Activées\n" +
    "🚪 Portails d'accès: Détection automatique\n" +
    "📊 Rapports: Génération automatique\n\n" +
    "🔧 Compatible: CAT M323F, pelles rail-route\n" +
    "📞 Support: Contactez l'administrateur";
  
  bot.sendMessage(chatId, settingsMsg, { 
    parse_mode: 'Markdown',
    ...mainMenu 
  });
}

// Utility functions
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
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Handle callbacks
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id.toString();
  const userName = query.from.first_name || 'Opérateur';
  const data = query.data;
  
  try {
    if (data.startsWith('check')) {
      const steps = [
        { code: 'check1', label: "Vérifier position train" },
        { code: 'check2', label: "Contacter chef chantier" },
        { code: 'check3', label: "Activer signalisations" },
        { code: 'check4', label: "Bloquer circulation voie" },
        { code: 'check5', label: "Vérifier équipement" },
        { code: 'check6', label: "Confirmer mise hors voie" }
      ];
      
      const step = steps.find(s => s.code === data);
      if (step) {
        let fullData = loadData();
        fullData.messages.push({
          userId, userName, message: `✅ Checklist: ${step.label}`,
          type: 'checklist', status: 'normal', chatId, timestamp: Date.now()
        });
        saveData(fullData);
        
        bot.answerCallbackQuery(query.id, { text: `✅ ${step.label} validé` });
      }
    }
  } catch (error) {
    console.error('❌ Erreur callback:', error);
    bot.answerCallbackQuery(query.id, { text: "❌ Erreur" });
  }
});

// Error handling
bot.on('error', (error) => {
  console.error('❌ Erreur bot:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du bot LR ASSIST avancé...');
  bot.stopPolling();
  process.exit(0);
});

console.log("🚦 BOT LR ASSIST AVANCÉ démarré");
console.log("📱 En écoute des messages chantier...");
console.log("💾 Données sauvegardées localement");
console.log("🚨 Fonctionnalités d'urgence et portails d'accès activées");
console.log("🔧 Compatible: CAT M323F, pelles rail-route, OCP"); 