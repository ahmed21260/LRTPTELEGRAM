const fs = require('fs');

// Charger les données
function loadData() {
  try {
    return JSON.parse(fs.readFileSync('./data.json', 'utf8'));
  } catch (error) {
    console.error('❌ Erreur chargement data.json:', error);
    return { locations: [], positions: [], messages: [], photos: [] };
  }
}

// Afficher toutes les positions
function showAllPositions() {
  const data = loadData();
  
  console.log('\n🗺️ POSITIONS EXISTANTES DANS LE SYSTÈME');
  console.log('==========================================\n');
  
  // Combiner locations et positions
  const allPositions = [...(data.locations || []), ...(data.positions || [])];
  
  if (allPositions.length === 0) {
    console.log('❌ Aucune position trouvée dans le système');
    return;
  }
  
  console.log(`📊 Total des positions: ${allPositions.length}\n`);
  
  // Grouper par utilisateur
  const users = {};
  allPositions.forEach(pos => {
    const userId = pos.userId || 'unknown';
    if (!users[userId]) {
      users[userId] = {
        userName: pos.userName || 'Utilisateur inconnu',
        positions: []
      };
    }
    users[userId].positions.push(pos);
  });
  
  // Afficher par utilisateur
  Object.entries(users).forEach(([userId, userData]) => {
    console.log(`👤 ${userData.userName} (ID: ${userId})`);
    console.log(`   📍 ${userData.positions.length} position(s) partagée(s)`);
    
    // Trier par timestamp (plus récent en premier)
    const sortedPositions = userData.positions.sort((a, b) => b.timestamp - a.timestamp);
    
    sortedPositions.forEach((pos, index) => {
      const date = new Date(pos.timestamp).toLocaleString('fr-FR');
      const pk = pos.pkSNCF || pos.pk || 'Non calculé';
      const line = pos.lineName || pos.railwayInfo?.line || 'Ligne non identifiée';
      
      console.log(`   ${index + 1}. 📍 ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`);
      console.log(`      🚦 PK: ${pk} | Ligne: ${line}`);
      console.log(`      🕐 ${date}`);
      
      if (pos.confidence) {
        console.log(`      ⚠️ Confiance: ${pos.confidence}`);
      }
      console.log('');
    });
    
    console.log('   ──────────────────────────────────────\n');
  });
  
  // Statistiques
  console.log('📈 STATISTIQUES');
  console.log('===============');
  console.log(`👥 Utilisateurs uniques: ${Object.keys(users).length}`);
  console.log(`📍 Positions totales: ${allPositions.length}`);
  
  const recentPositions = allPositions.filter(pos => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return pos.timestamp > oneHourAgo;
  });
  console.log(`🕐 Positions dernière heure: ${recentPositions.length}`);
  
  const todayPositions = allPositions.filter(pos => {
    const today = new Date();
    const posDate = new Date(pos.timestamp);
    return posDate.toDateString() === today.toDateString();
  });
  console.log(`📅 Positions aujourd'hui: ${todayPositions.length}`);
}

// Fonction pour tester l'API
async function testAPI() {
  try {
    console.log('\n🔍 TEST DE L\'API POSITIONS');
    console.log('============================\n');
    
    const response = await fetch('http://localhost:3000/api/positions');
    const positions = await response.json();
    
    console.log(`✅ API accessible: ${positions.length} positions récupérées`);
    
    if (positions.length > 0) {
      console.log('\n📍 Première position récupérée:');
      console.log(JSON.stringify(positions[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erreur test API:', error.message);
    console.log('💡 Assurez-vous que le serveur tourne sur le port 3000');
  }
}

// Fonction pour forcer la mise à jour du dashboard
async function forceDashboardUpdate() {
  try {
    console.log('\n🔄 FORÇAGE MISE À JOUR DASHBOARD');
    console.log('================================\n');
    
    // Simuler une nouvelle position pour forcer la mise à jour
    const data = loadData();
    const allPositions = [...(data.locations || []), ...(data.positions || [])];
    
    if (allPositions.length > 0) {
      const lastPosition = allPositions.sort((a, b) => b.timestamp - a.timestamp)[0];
      
      // Émettre vers le dashboard via WebSocket
      const { ioClient } = require('socket.io-client');
      const socket = ioClient('http://localhost:3000');
      
      socket.emit('position', {
        userId: lastPosition.userId,
        userName: lastPosition.userName,
        latitude: lastPosition.latitude,
        longitude: lastPosition.longitude,
        pkSNCF: lastPosition.pkSNCF,
        lineName: lastPosition.lineName,
        timestamp: Date.now()
      });
      
      console.log('✅ Position émise vers le dashboard');
      console.log(`📍 ${lastPosition.userName}: ${lastPosition.latitude}, ${lastPosition.longitude}`);
      
      setTimeout(() => {
        socket.disconnect();
        console.log('🔌 Connexion WebSocket fermée');
      }, 1000);
    }
    
  } catch (error) {
    console.error('❌ Erreur mise à jour dashboard:', error.message);
  }
}

// Menu principal
function showMenu() {
  console.log('\n🎯 MENU POSITIONS LR RAIL ASSIST');
  console.log('==================================');
  console.log('1. 📊 Afficher toutes les positions');
  console.log('2. 🔍 Tester l\'API positions');
  console.log('3. 🔄 Forcer mise à jour dashboard');
  console.log('4. 🚪 Quitter');
  console.log('');
}

// Gestion des arguments en ligne de commande
const args = process.argv.slice(2);

if (args.length > 0) {
  switch (args[0]) {
    case 'show':
      showAllPositions();
      break;
    case 'test':
      testAPI();
      break;
    case 'update':
      forceDashboardUpdate();
      break;
    default:
      console.log('❌ Argument invalide. Utilisez: show, test, ou update');
  }
} else {
  // Mode interactif
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  function askQuestion() {
    showMenu();
    rl.question('Choisissez une option (1-4): ', (answer) => {
      switch (answer.trim()) {
        case '1':
          showAllPositions();
          askQuestion();
          break;
        case '2':
          testAPI();
          askQuestion();
          break;
        case '3':
          forceDashboardUpdate();
          askQuestion();
          break;
        case '4':
          console.log('👋 Au revoir !');
          rl.close();
          break;
        default:
          console.log('❌ Option invalide. Veuillez choisir 1-4.');
          askQuestion();
      }
    });
  }
  
  askQuestion();
} 