const RailwayGeometry = require('./railway-geometry');
const GeoportailService = require('./geoportail');

async function testRailwayGeometry() {
  console.log('🚦 Test de la géométrie ferroviaire LR ASSIST\n');

  // Initialize services
  const railwayGeometry = new RailwayGeometry();
  const geoportal = new GeoportailService();

  // Test 1: Lister les lignes disponibles
  console.log('📋 Lignes ferroviaires disponibles:');
  const lines = railwayGeometry.listLines();
  lines.forEach(line => {
    console.log(`  • ${line.name} (${line.id})`);
    console.log(`    PK: ${line.pkStart} → ${line.pkEnd} km`);
    console.log(`    Segments: ${line.segments}`);
    console.log(`    Direction: ${line.direction}\n`);
  });

  // Test 2: Points de test (coordonnées réelles)
  const testPoints = [
    {
      name: 'Paris Gare de Lyon',
      lat: 48.8447,
      lon: 2.3186,
      expectedLine: 'LIGNE_PARIS_LYON'
    },
    {
      name: 'Lyon Part-Dieu',
      lat: 45.7640,
      lon: 4.8234,
      expectedLine: 'LIGNE_LYON_MARSEILLE'
    },
    {
      name: 'Marseille Saint-Charles',
      lat: 43.2965,
      lon: 5.4567,
      expectedLine: 'LIGNE_LYON_MARSEILLE'
    },
    {
      name: 'Point éloigné (test)',
      lat: 46.0,
      lon: 3.0,
      expectedLine: 'none'
    }
  ];

  console.log('📍 Test des calculs PK:');
  for (const point of testPoints) {
    console.log(`\n🔍 Test: ${point.name}`);
    console.log(`  Coordonnées: ${point.lat}, ${point.lon}`);
    
    try {
      // Test avec géométrie précise
      const nearestPK = railwayGeometry.findNearestPK(point.lat, point.lon, 5000);
      
      if (nearestPK) {
        const formattedPK = railwayGeometry.formatPK(nearestPK.pk);
        console.log(`  ✅ PK trouvé: ${formattedPK}`);
        console.log(`  Ligne: ${nearestPK.lineName}`);
        console.log(`  Distance: ${Math.round(nearestPK.distance)}m`);
        console.log(`  Confiance: ${nearestPK.confidence}`);
        console.log(`  Segment: ${nearestPK.segment}`);
        
        // Vérifier si c'est la ligne attendue
        if (nearestPK.lineId === point.expectedLine) {
          console.log(`  ✅ Ligne correcte`);
        } else {
          console.log(`  ⚠️ Ligne différente (attendu: ${point.expectedLine})`);
        }
      } else {
        console.log(`  ❌ Aucun PK trouvé dans un rayon de 5km`);
      }

      // Test avec le service Geoportail
      const pkResult = await geoportal.calculatePKSNCF(point.lat, point.lon);
      console.log(`  Service Geoportail: ${pkResult.pk} (${pkResult.method})`);

    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
    }
  }

  // Test 3: Calcul de coordonnées à partir d'un PK
  console.log('\n🎯 Test calcul coordonnées depuis PK:');
  const testPKs = [
    { lineId: 'LIGNE_PARIS_LYON', pk: 50, description: 'PK50 Paris-Lyon' },
    { lineId: 'LIGNE_PARIS_LYON', pk: 200, description: 'PK200 Paris-Lyon' },
    { lineId: 'LIGNE_LYON_MARSEILLE', pk: 100, description: 'PK100 Lyon-Marseille' }
  ];

  for (const testPK of testPKs) {
    console.log(`\n🔍 Test: ${testPK.description}`);
    
    try {
      const result = railwayGeometry.getCoordAtPK(testPK.lineId, testPK.pk);
      
      if (result) {
        console.log(`  ✅ Coordonnées: ${result.coordinates[1].toFixed(6)}, ${result.coordinates[0].toFixed(6)}`);
        console.log(`  Ligne: ${result.lineName}`);
        console.log(`  PK: ${railwayGeometry.formatPK(result.pk)}`);
        console.log(`  Segment: ${result.segment}`);
      } else {
        console.log(`  ❌ PK hors limites de la ligne`);
      }
    } catch (error) {
      console.log(`  ❌ Erreur: ${error.message}`);
    }
  }

  // Test 4: Validation de proximité voie
  console.log('\n🚦 Test validation proximité voie:');
  const proximityTests = [
    { lat: 48.8447, lon: 2.3186, name: 'Paris Gare de Lyon (proche)' },
    { lat: 46.0, lon: 3.0, name: 'Point éloigné (loin)' }
  ];

  for (const test of proximityTests) {
    const isNear = await geoportal.isNearRailway(test.lat, test.lon, 1000);
    console.log(`  ${test.name}: ${isNear ? '✅ Proche' : '❌ Loin'}`);
  }

  // Test 5: Infrastructure proche
  console.log('\n🏗️ Test infrastructure proche:');
  const infrastructureTest = await geoportal.getNearbyInfrastructure(48.8447, 2.3186, 2000);
  console.log(`  Ligne proche: ${infrastructureTest.nearestLine}`);
  console.log(`  PK proche: ${infrastructureTest.nearestPK}`);
  console.log(`  Gares: ${infrastructureTest.stations.length}`);
  console.log(`  Signaux: ${infrastructureTest.signals.length}`);

  // Test 6: Informations détaillées PK
  console.log('\n📊 Test informations détaillées PK:');
  const detailedInfo = await geoportal.getDetailedPKInfo(48.8447, 2.3186);
  console.log(`  PK: ${detailedInfo.pk}`);
  console.log(`  Ligne: ${detailedInfo.lineName}`);
  console.log(`  Confiance: ${detailedInfo.confidence}`);
  console.log(`  Distance: ${detailedInfo.distance ? `${Math.round(detailedInfo.distance)}m` : 'N/A'}`);
  console.log(`  Méthode: ${detailedInfo.method}`);
  console.log(`  Segment: ${detailedInfo.segment}/${detailedInfo.totalSegments}`);

  console.log('\n✅ Tests terminés !');
}

// Run tests if called directly
if (require.main === module) {
  testRailwayGeometry().catch(error => {
    console.error('❌ Erreur lors des tests:', error);
    process.exit(1);
  });
}

module.exports = { testRailwayGeometry }; 