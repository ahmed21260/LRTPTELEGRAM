const RailwayAccessPortals = require('./railway-access-portals');
const GeoportailService = require('./geoportail');

async function testAccessPortals() {
  console.log('🚪 Test du système innovant de portails d\'accès SNCF\n');
  
  const accessPortals = new RailwayAccessPortals();
  const geoportal = new GeoportailService();
  
  // Coordonnées de test (Paris-Lyon)
  const testCoordinates = [
    { lat: 48.8566, lon: 2.3522, name: 'Paris' },
    { lat: 45.7578, lon: 4.8320, name: 'Lyon' },
    { lat: 43.2965, lon: 5.3698, name: 'Marseille' },
    { lat: 47.2184, lon: -1.5536, name: 'Nantes' },
    { lat: 43.6047, lon: 1.4442, name: 'Toulouse' }
  ];
  
  for (const coord of testCoordinates) {
    console.log(`📍 Test pour ${coord.name} (${coord.lat}, ${coord.lon}):`);
    
    try {
      // Test recherche portail d'accès
      const portal = await accessPortals.findNearestAccessPortal(coord.lat, coord.lon, 'emergency');
      
      console.log(`  ✅ Portail trouvé: ${portal.name}`);
      console.log(`  📊 Type: ${portal.type}`);
      console.log(`  📏 Distance: ${portal.distance}m`);
      console.log(`  🧭 Direction: ${portal.direction}`);
      console.log(`  🚦 Statut: ${portal.status}`);
      console.log(`  🎯 Confiance: ${portal.confidence}`);
      console.log(`  🚨 Urgence: ${portal.emergency ? 'Oui' : 'Non'}`);
      
      if (portal.equipment && portal.equipment.length > 0) {
        console.log(`  🔧 Équipements: ${portal.equipment.length} disponibles`);
      }
      
      if (portal.restrictions && portal.restrictions.length > 0) {
        console.log(`  ⚠️ Restrictions: ${portal.restrictions.length} appliquées`);
      }
      
      if (portal.safetyProcedures) {
        console.log(`  🛡️ Procédures de sécurité: ${Object.keys(portal.safetyProcedures).length} niveaux`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}\n`);
    }
  }
  
  // Test contextes différents
  console.log('🔄 Test des différents contextes:\n');
  
  const contexts = ['emergency', 'maintenance', 'inspection'];
  const testCoord = { lat: 48.8566, lon: 2.3522 };
  
  for (const context of contexts) {
    try {
      const portal = await accessPortals.findNearestAccessPortal(testCoord.lat, testCoord.lon, context);
      console.log(`  📋 Contexte "${context}": ${portal.name} (${portal.type})`);
    } catch (error) {
      console.log(`  ❌ Erreur contexte "${context}": ${error.message}`);
    }
  }
  
  console.log('\n🔍 Test analyse situation d\'urgence:\n');
  
  try {
    const situation = await geoportal.analyzeEmergencySituation(testCoord.lat, testCoord.lon);
    console.log(`  ⏰ Timestamp: ${situation.timestamp}`);
    console.log(`  📍 PK: ${situation.pk.pk}`);
    console.log(`  🚦 Ligne: ${situation.pk.lineName}`);
    console.log(`  🌤️ Météo: ${situation.weather}`);
    console.log(`  💡 Éclairage: ${situation.lighting}`);
    console.log(`  🚂 Trafic: ${situation.traffic.active ? 'Actif' : 'Inactif'}`);
    console.log(`  🏗️ Infrastructure: ${situation.infrastructure.total} éléments`);
    console.log(`  🚪 Portail d'accès: ${situation.accessPortal.name}`);
  } catch (error) {
    console.log(`  ❌ Erreur analyse situation: ${error.message}`);
  }
  
  console.log('\n📊 Test génération rapport d\'urgence:\n');
  
  try {
    const report = await geoportal.generateEmergencyReport(testCoord.lat, testCoord.lon, 'Test User', '12345');
    console.log(`  👤 Utilisateur: ${report.user.name}`);
    console.log(`  📍 Position: ${report.location.latitude}, ${report.location.longitude}`);
    console.log(`  🚪 Portail: ${report.accessPortal.name}`);
    console.log(`  📞 Contacts: ${Object.keys(report.contacts).length} disponibles`);
    console.log(`  🛡️ Procédures: ${Object.keys(report.emergencyProcedures).length} niveaux`);
  } catch (error) {
    console.log(`  ❌ Erreur rapport: ${error.message}`);
  }
  
  console.log('\n✅ Tests terminés !');
}

// Test des fonctionnalités spécifiques
async function testSpecificFeatures() {
  console.log('\n🔬 Test des fonctionnalités spécifiques:\n');
  
  const accessPortals = new RailwayAccessPortals();
  
  // Test calcul PK SNCF
  console.log('📍 Test calcul PK SNCF:');
  try {
    const pkResult = await accessPortals.calculatePKSNCF(48.8566, 2.3522);
    console.log(`  ✅ PK: ${pkResult.pk}`);
    console.log(`  🚦 Ligne: ${pkResult.lineName}`);
    console.log(`  🎯 Confiance: ${pkResult.confidence}`);
    console.log(`  📏 Distance: ${pkResult.distance}m`);
  } catch (error) {
    console.log(`  ❌ Erreur: ${error.message}`);
  }
  
  // Test analyse situation
  console.log('\n🌍 Test analyse situation:');
  try {
    const situation = await accessPortals.analyzeSituation(48.8566, 2.3522, 'emergency');
    console.log(`  ⏰ Heure: ${situation.time}`);
    console.log(`  🌤️ Météo: ${situation.weather}`);
    console.log(`  💡 Éclairage: ${situation.lighting}`);
    console.log(`  🚂 Trafic: ${situation.traffic.active ? 'Actif' : 'Inactif'}`);
    console.log(`  🚨 Urgence: ${situation.emergency ? 'Oui' : 'Non'}`);
  } catch (error) {
    console.log(`  ❌ Erreur: ${error.message}`);
  }
  
  // Test génération portails intelligents
  console.log('\n🧠 Test génération portails intelligents:');
  try {
    const pkResult = await accessPortals.calculatePKSNCF(48.8566, 2.3522);
    const situation = await accessPortals.analyzeSituation(48.8566, 2.3522, 'emergency');
    const portals = await accessPortals.generateIntelligentPortals(48.8566, 2.3522, pkResult, situation);
    
    console.log(`  🚪 Portails générés: ${portals.length}`);
    portals.forEach((portal, index) => {
      console.log(`    ${index + 1}. ${portal.name} (${portal.type}) - ${portal.distance}m`);
    });
  } catch (error) {
    console.log(`  ❌ Erreur: ${error.message}`);
  }
}

// Exécuter les tests
async function runAllTests() {
  console.log('🚀 Démarrage des tests du système de portails d\'accès SNCF\n');
  
  await testAccessPortals();
  await testSpecificFeatures();
  
  console.log('\n🎉 Tous les tests sont terminés !');
}

// Exécuter si appelé directement
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testAccessPortals, testSpecificFeatures, runAllTests }; 