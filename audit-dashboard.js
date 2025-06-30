import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api'; // adapte si besoin

async function fetchAPI(endpoint) {
  try {
    const res = await fetch(`${BASE_URL}/${endpoint}`);
    if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`❌ Erreur sur /api/${endpoint} :`, e.message);
    return null;
  }
}

(async () => {
  console.log('=== AUDIT AUTOMATIQUE DASHBOARD LR RAIL ASSIST ===');

  const [positions, photos, messages, alerts, emergencies, portals] = await Promise.all([
    fetchAPI('positions'),
    fetchAPI('photos'),
    fetchAPI('messages'),
    fetchAPI('alerts'),
    fetchAPI('emergencies'),
    fetchAPI('access-portals'),
  ]);

  // Vérification des données
  if (!positions || !photos || !messages) {
    console.error('❌ Impossible de récupérer toutes les données. Vérifie que le serveur tourne et que les API sont accessibles.');
    process.exit(1);
  }

  // Résumé utilisateurs
  const userIds = Array.from(new Set([
    ...positions.map(p => p.userId),
    ...photos.map(p => p.userId),
    ...messages.map(m => m.userId)
  ].filter(Boolean)));
  console.log(`Utilisateurs détectés : ${userIds.length} →`, userIds.join(', '));

  // Résumé positions
  console.log(`Positions reçues : ${positions.length}`);
  if (positions.length === 0) console.warn('⚠️ Aucune position reçue !');

  // Résumé photos
  console.log(`Photos reçues : ${photos.length}`);
  if (photos.length === 0) console.warn('⚠️ Aucune photo reçue !');

  // Résumé messages
  console.log(`Messages reçus : ${messages.length}`);
  if (messages.length === 0) console.warn('⚠️ Aucun message reçu !');

  // Résumé alertes/urgences
  console.log(`Alertes : ${alerts ? alerts.length : 0}`);
  console.log(`Urgences : ${emergencies ? emergencies.length : 0}`);

  // Résumé portails
  console.log(`Portails d'accès : ${portals ? portals.length : 0}`);

  // Vérification cohérence : chaque utilisateur a-t-il au moins un message ou une position ?
  userIds.forEach(uid => {
    const hasMsg = messages.some(m => m.userId === uid);
    const hasPos = positions.some(p => p.userId === uid);
    if (!hasMsg && !hasPos) {
      console.warn(`⚠️ Utilisateur ${uid} n'a ni message ni position !`);
    }
  });

  // Vérification temps réel (optionnel)
  // Tu peux ajouter ici un test d'envoi via Telegram puis relancer ce script pour voir l'apparition immédiate.

  console.log('=== FIN AUDIT ===');
})(); 