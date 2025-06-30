const fs = require('fs');
const ioClient = require('socket.io-client');

// Charger les données
function loadData() {
  try {
    return JSON.parse(fs.readFileSync('./data.json', 'utf8'));
  } catch (error) {
    console.error('❌ Erreur chargement data.json:', error);
    return { locations: [], positions: [] };
  }
}

// Forcer la mise à jour du dashboard
async function forceDashboardUpdate() {
  try {
    console.log('🔄 FORÇAGE MISE À JOUR DASHBOARD');
    console.log('================================\n');
    
    const data = loadData();
    const allPositions = [...(data.locations || []), ...(data.positions || [])];
    
    if (allPositions.length === 0) {
      console.log('❌ Aucune position trouvée');
      return;
    }
    
    console.log(`📊 ${allPositions.length} positions trouvées`);
    
    // Se connecter au dashboard
    const socket = ioClient('http://localhost:3000');
    
    // Émettre chaque position pour forcer la mise à jour
    allPositions.forEach((pos, index) => {
      setTimeout(() => {
        socket.emit('position', {
          userId: pos.userId || 'unknown',
          userName: pos.userName || 'Utilisateur',
          latitude: pos.latitude,
          longitude: pos.longitude,
          pkSNCF: pos.pkSNCF || pos.pk,
          lineName: pos.lineName || pos.railwayInfo?.line || 'Ligne non identifiée',
          timestamp: pos.timestamp || Date.now()
        });
        
        console.log(`📍 Position ${index + 1}/${allPositions.length} émise: ${pos.userName || 'Utilisateur'}`);
      }, index * 100); // Délai de 100ms entre chaque émission
    });
    
    // Fermer la connexion après 5 secondes
    setTimeout(() => {
      socket.disconnect();
      console.log('\n✅ Mise à jour terminée');
      console.log('💡 Rafraîchissez votre dashboard pour voir les positions');
    }, 5000);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Lancer la mise à jour
forceDashboardUpdate(); 