import fetch from 'node-fetch';

async function testPositions() {
  const res = await fetch('http://localhost:3000/api/positions');
  const positions = await res.json();
  if (!Array.isArray(positions)) {
    console.error('❌ /api/positions ne retourne pas un tableau');
    return false;
  }
  let ok = true;
  positions.forEach((p, i) => {
    if (!('pkEstime' in p)) {
      console.error(`❌ Position ${i} ne contient pas le champ pkEstime`);
      ok = false;
    }
  });
  if (ok) console.log('✅ /api/positions : champ pkEstime OK sur toutes les positions');
  return ok;
}

async function testNearestPortalFar() {
  // Coordonnées loin de tout portail connu (ex: 0,0)
  const res = await fetch('http://localhost:3000/api/access-portals/nearest?lat=0&lon=0');
  const portal = await res.json();
  if (portal && portal.name === 'Aucun portail SNCF proche') {
    console.log('✅ /api/access-portals/nearest : gestion du cas Aucun portail SNCF proche OK');
    return true;
  } else {
    console.error('❌ /api/access-portals/nearest ne gère pas correctement le cas Aucun portail SNCF proche');
    return false;
  }
}

(async () => {
  console.log('--- Test API LR ASSIST ---');
  await testPositions();
  await testNearestPortalFar();
})(); 