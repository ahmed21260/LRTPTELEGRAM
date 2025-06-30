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
  const positions = (data.locations || []).map(p => ({
    ...p,
    pkEstime: p.pkEstime || false
  }));
  res.json(positions);
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