const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { FirestoreService } = require('./firebase');
const compression = require('compression');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// Servir le dashboard statique
app.use(express.static(path.join(__dirname, 'dashboard')));

// Servir les photos
app.use('/photos', express.static(path.join(__dirname, 'data', 'photos')));

// API REST
app.get('/api/alerts', async (req, res) => {
  try {
    const emergencies = await firestoreService.getEmergencies ? await firestoreService.getEmergencies() : [];
    res.json(emergencies);
  } catch (error) {
    res.status(500).json({ error: 'Erreur Firestore', details: error.message });
  }
});

app.get('/api/photos', async (req, res) => {
  try {
    const { userId } = req.query;
    const filters = {};
    if (userId) filters.userId = userId;
    const photos = await firestoreService.getPhotos(filters);
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: 'Erreur Firestore', details: error.message });
  }
});

app.get('/api/positions', async (req, res) => {
  try {
    const { userId } = req.query;
    const filters = {};
    if (userId) filters.userId = userId;
    const locations = await firestoreService.getLocations(filters);
    // Pour compatibilité, on ajoute pkEstime et les champs essentiels
    const allPositions = locations.map(p => ({
      ...p,
      pkEstime: p.pkEstime || false,
      userId: p.userId || 'unknown',
      userName: p.userName || 'Utilisateur',
      latitude: p.latitude || 0,
      longitude: p.longitude || 0,
      timestamp: p.timestamp || Date.now()
    }));
    res.json(allPositions);
  } catch (error) {
    res.status(500).json({ error: 'Erreur Firestore', details: error.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { userId } = req.query;
    const filters = {};
    if (userId) filters.userId = userId;
    const messages = await firestoreService.getMessages(filters);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Erreur Firestore', details: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    // On récupère toutes les positions et messages pour construire la liste des users
    const [locations, messages] = await Promise.all([
      firestoreService.getLocations(),
      firestoreService.getMessages()
    ]);
    const users = {};
    locations.forEach(loc => {
      if (loc.userId && loc.userName) {
        users[loc.userId] = {
          userId: loc.userId,
          userName: loc.userName,
          lastPosition: loc,
          lastSeen: loc.timestamp
        };
      }
    });
    messages.forEach(msg => {
      if (msg.userId && msg.userName) {
        if (!users[msg.userId]) {
          users[msg.userId] = {
            userId: msg.userId,
            userName: msg.userName,
            lastSeen: msg.timestamp
          };
        } else if (msg.timestamp > users[msg.userId].lastSeen) {
          users[msg.userId].lastSeen = msg.timestamp;
        }
      }
    });
    res.json(Object.values(users));
  } catch (error) {
    res.status(500).json({ error: 'Erreur Firestore', details: error.message });
  }
});

// Endpoint de debug pour voir les données brutes
app.get('/api/debug', async (req, res) => {
  try {
    const [locations, messages, photos] = await Promise.all([
      firestoreService.getLocations(),
      firestoreService.getMessages(),
      firestoreService.getPhotos()
    ]);
    res.json({
      locations,
      messages,
      photos,
      totalLocations: locations.length,
      totalMessages: messages.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur Firestore', details: error.message });
  }
});

// Instancier la classe RailwayAccessPortals une seule fois
const RailwayAccessPortals = require('./railway-access-portals');
const portalsInstance = new RailwayAccessPortals();

app.get('/api/access-portals', (req, res) => {
  try {
    res.json(portalsInstance.getAllPortals());
  } catch {
    res.json([]);
  }
});

// Endpoint pour accès le plus proche
app.get('/api/access-portals/nearest', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat/lon requis' });
  try {
    const portal = await portalsInstance.findNearestAccessPortal(parseFloat(lat), parseFloat(lon));
    res.json(portal);
  } catch {
    res.status(500).json({ error: 'Erreur accès portail' });
  }
});

// Alias /api/portail-proche pour compatibilité audit
app.get('/api/portail-proche', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat et lon requis' });
    const portail = await portalsInstance.findNearestAccessPortal(parseFloat(lat), parseFloat(lon));
    res.json(portail);
  } catch (error) {
    res.status(500).json({ error: 'Erreur API portail-proche', details: error.message });
  }
});

// WebSocket temps réel
io.on('connection', (socket) => {
  console.log('Client dashboard connecté');
  // Relais des notifications reçues du bot
  socket.on('alert', data => {
    // Relayer à tous les dashboards
    io.emit('alert', data);
    // Enregistrer dans data.json
    try {
      const fileData = loadData();
      if (!fileData.emergencies) fileData.emergencies = [];
      fileData.emergencies.push(data);
      fs.writeFileSync('./data.json', JSON.stringify(fileData, null, 2));
    } catch {
      console.error('Erreur écriture alerte dans data.json');
    }
  });
  socket.on('photo', data => {
    io.emit('photo', data);
  });
  socket.on('position', data => {
    io.emit('position', data);
  });
});

app.use(compression());
app.use(bodyParser.json());

// Middleware de sécurité simple par clé API
const API_KEY = process.env.API_KEY || 'votre_cle_api_secrete';
function checkApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (key !== API_KEY) return res.status(403).json({ error: 'Clé API invalide' });
  next();
}

/*
  Endpoint webhook Telegram :
  POST /api/receive
  Headers : x-api-key: <votre_cle_api_secrete>
  Body : JSON Telegram update
  Sécurité : clé API obligatoire (modifiable via process.env.API_KEY)
*/
// Endpoint webhook Telegram
app.post('/api/receive', checkApiKey, async (req, res) => {
  try {
    const update = req.body;
    // Ici, vous pouvez router l'update vers le bot Telegram (ex: bot.processUpdate(update))
    if (global.bot && typeof global.bot.processUpdate === 'function') {
      await global.bot.processUpdate(update);
      res.json({ status: 'ok' });
    } else {
      res.status(500).json({ error: 'Bot non initialisé' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erreur traitement webhook', details: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Serveur API/Socket.io/dashboard lancé sur le port ${PORT}`);
}); 