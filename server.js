const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// Charger les données locales (à adapter si Firestore)
function loadData() {
  try {
    return JSON.parse(fs.readFileSync('./data.json', 'utf8'));
  } catch {
    return { alerts: [], photos: [], positions: [], accessPortals: [], messages: [], locations: [], emergencies: [] };
  }
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// Servir le dashboard statique
app.use(express.static(path.join(__dirname, 'dashboard')));

// Servir les photos
app.use('/photos', express.static(path.join(__dirname, 'data', 'photos')));

// API REST
app.get('/api/alerts', (req, res) => {
  const data = loadData();
  res.json(data.emergencies || []);
});

app.get('/api/photos', (req, res) => {
  const data = loadData();
  const { userId } = req.query;
  let photos = data.photos || [];
  if (userId) photos = photos.filter(p => p.userId === userId);
  res.json(photos);
});

app.get('/api/positions', (req, res) => {
  const data = loadData();
  // Utiliser à la fois locations et positions pour compatibilité
  const locations = data.locations || [];
  const positions = data.positions || [];
  const allPositions = [...locations, ...positions].map(p => ({
    ...p,
    pkEstime: p.pkEstime || false,
    // Assurer que les propriétés essentielles sont présentes
    userId: p.userId || 'unknown',
    userName: p.userName || 'Utilisateur',
    latitude: p.latitude || 0,
    longitude: p.longitude || 0,
    timestamp: p.timestamp || Date.now()
  }));
  res.json(allPositions);
});

app.get('/api/messages', (req, res) => {
  const data = loadData();
  const { userId } = req.query;
  let messages = data.messages || [];
  if (userId) messages = messages.filter(m => m.userId === userId);
  res.json(messages);
});

app.get('/api/users', (req, res) => {
  const data = loadData();
  const users = {};
  
  // Extraire les utilisateurs uniques des positions (locations + positions)
  const allPositions = [...(data.locations || []), ...(data.positions || [])];
  allPositions.forEach(loc => {
    if (loc.userId && loc.userName) {
      users[loc.userId] = {
        userId: loc.userId,
        userName: loc.userName,
        lastPosition: loc,
        lastSeen: loc.timestamp
      };
    }
  });
  
  // Mettre à jour avec les derniers messages
  (data.messages || []).forEach(msg => {
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
});

// Endpoint de debug pour voir les données brutes
app.get('/api/debug', (req, res) => {
  const data = loadData();
  res.json({
    locations: data.locations || [],
    positions: data.positions || [],
    messages: data.messages || [],
    photos: data.photos || [],
    alerts: data.alerts || [],
    emergencies: data.emergencies || [],
    totalLocations: (data.locations || []).length,
    totalPositions: (data.positions || []).length,
    totalMessages: (data.messages || []).length
  });
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

server.listen(PORT, () => {
  console.log(`Serveur API/Socket.io/dashboard lancé sur le port ${PORT}`);
}); 