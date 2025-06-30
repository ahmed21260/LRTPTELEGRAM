// dashboard.js - LR RAIL ASSIST

// --- Initialisation ---
let map, positionMarkers = {}, userList = [], selectedOperatorId = null;
const socket = io();

// --- Utilitaires ---
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('fr-FR');
}
function escapeHTML(str) {
  return (str || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c]));
}

// --- Lightbox ---
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
lightboxClose.onclick = () => lightbox.classList.add('hidden');
lightbox.onclick = e => { if (e.target === lightbox) lightbox.classList.add('hidden'); };

function showLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.remove('hidden');
}
window.showLightbox = showLightbox;

// --- Chargement initial ---
async function fetchAll() {
  const [positions, alerts, photos, portals, emergencies, messages] = await Promise.all([
    fetch('/api/positions').then(r => r.json()),
    fetch('/api/alerts').then(r => r.json()),
    fetch('/api/photos').then(r => r.json()),
    fetch('/api/access-portals').then(r => r.json()),
    fetch('/api/emergencies').then(r => r.json()).catch(()=>[]),
    fetch('/api/messages').then(r => r.json()).catch(()=>[])
  ]);
  return { positions, alerts, photos, portals, emergencies, messages };
}

// --- Grouper les positions par userId (plus récente) ---
function getLatestPositionsByUser(positions) {
  const latest = {};
  positions.forEach(p => {
    if (!latest[p.userId] || p.timestamp > latest[p.userId].timestamp) {
      latest[p.userId] = p;
    }
  });
  return Object.values(latest);
}

// Génère une couleur unique à partir d'un userId
function userColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}
// Génère une icône SVG personnalisée pour le marqueur utilisateur
function userMarkerIcon(userId, userName) {
  const color = userColor(userId);
  const initial = (userName || userId)[0]?.toUpperCase() || '?';
  const svg = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="16" fill="${color}" stroke="#222" stroke-width="2"/>
    <text x="20" y="25" text-anchor="middle" font-size="18" font-family="Arial" fill="#fff" font-weight="bold">${initial}</text>
    <circle cx="20" cy="36" r="4" fill="${color}" stroke="#222" stroke-width="2"/>
  </svg>`;
  return L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
    iconSize: [40, 40],
    iconAnchor: [20, 36],
    popupAnchor: [0, -36]
  });
}
// Animation bounce CSS
function bounceMarker(marker) {
  const icon = marker._icon;
  if (!icon) return;
  icon.style.transition = 'transform 0.3s';
  icon.style.transform = 'scale(1.3)';
  setTimeout(() => { icon.style.transform = 'scale(1)'; }, 300);
}

// --- Afficher les marqueurs utilisateurs sur la carte ---
function updateUserMarkers(positions, photos, messages) {
  // Nettoyer anciens marqueurs
  Object.values(positionMarkers).forEach(m => map.removeLayer(m));
  positionMarkers = {};

  const latestPositions = getLatestPositionsByUser(positions);
  userList = latestPositions.map(p => ({ userId: p.userId, userName: p.userName, latitude: p.latitude, longitude: p.longitude }));

  const now = Date.now();
  // Pour la section opérateurs actifs
  let activeHtml = '';

  latestPositions.forEach(p => {
    // Chercher la dernière photo de l'utilisateur
    const userPhotos = (photos || []).filter(ph => ph.userId === p.userId);
    const lastPhotoObj = userPhotos.length > 0 ? userPhotos[userPhotos.length - 1] : null;
    const lastPhoto = lastPhotoObj ? lastPhotoObj.filename : null;
    const lastPhotoTime = lastPhotoObj ? lastPhotoObj.timestamp || lastPhotoObj.date || null : null;
    // Chercher le dernier message
    const userMessages = (messages || []).filter(m => m.userId === p.userId);
    const lastMsgObj = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
    const lastMsg = lastMsgObj ? lastMsgObj.message : null;
    // Déterminer si la position est "nouvelle"
    const isNew = (now - p.timestamp) < 2 * 60 * 1000;
    // Timer d'intervention si photo récente (< 1h)
    let timerHtml = '';
    let timerText = '';
    if (lastPhotoTime && now - lastPhotoTime < 60 * 60 * 1000) {
      const minutes = Math.floor((now - lastPhotoTime) / 60000);
      const seconds = Math.floor(((now - lastPhotoTime) % 60000) / 1000);
      timerText = `Intervention en cours : ${minutes}min ${seconds < 10 ? '0' : ''}${seconds}s`;
      timerHtml = `<span class='ml-2 px-2 py-0.5 rounded bg-blue-600 text-white text-xs'>${timerText}</span>`;
    }
    // Marqueur personnalisé SVG
    let marker;
    try {
      marker = L.marker([p.latitude, p.longitude], {
        icon: userMarkerIcon(p.userId, p.userName)
      }).addTo(map);
    } catch {
      marker = L.marker([p.latitude, p.longitude]).addTo(map);
    }
    let popupContent = `<b>${escapeHTML(p.userName || p.userId)}</b>`;
    if (isNew) popupContent += ' <span class="bg-green-500 text-white text-xs px-2 py-0.5 rounded align-middle">Nouveau</span>';
    popupContent += `<br>PK: ${escapeHTML(p.pkSNCF || '')}${p.pkEstime ? ' (estimé)' : ''}<br>
      Heure: ${formatDate(p.timestamp)}<br>`;
    if (lastMsg) popupContent += `<i>${escapeHTML(lastMsg)}</i><br>`;
    if (lastPhoto && !(lastMsg && lastMsg.toLowerCase().includes('ping'))) {
      popupContent += `<img src="/data/photos/${escapeHTML(lastPhoto)}" alt="photo" class="max-w-[100px] rounded cursor-pointer" onclick="showLightbox('/data/photos/${escapeHTML(lastPhoto)}')"><br>`;
    }
    if (timerText) popupContent += `<div class='mt-1 text-xs text-blue-700 font-bold'>${timerText}</div>`;
    marker.bindPopup(popupContent);
    positionMarkers[p.userId] = marker;
    // Animation si nouvelle position
    if (isNew) bounceMarker(marker);
    // Ajout à la section opérateurs actifs
    activeHtml += `<div class='flex items-center gap-2 bg-gray-100 rounded px-3 py-2 mb-2 shadow'>
      <span class='font-bold text-blue-700'>${escapeHTML(p.userName || p.userId)}</span>
      <span class='text-xs text-gray-500'>${formatDate(p.timestamp)}</span>
      ${timerHtml}
      <span class='text-xs text-gray-400'>${lastMsg ? 'Dernier msg' : lastPhoto ? 'Dernière photo' : ''}</span>
    </div>`;
  });

  // Centrer la carte sur le dernier utilisateur actif
  if (latestPositions.length > 0) {
    const last = latestPositions[latestPositions.length - 1];
    map.setView([last.latitude, last.longitude], 14);
  }
  renderUserList();
  // Affichage opérateurs actifs sous la carte
  const activeDiv = document.getElementById('active-operators');
  if (activeDiv) activeDiv.innerHTML = activeHtml;
}

// --- Liste d'utilisateurs cliquable ---
function renderUserList() {
  let html = '<div class="flex flex-wrap gap-2 mb-2">';
  userList.forEach(u => {
    html += `<button class="px-2 py-1 rounded bg-gray-200 hover:bg-blue-200 text-xs font-bold" onclick="centerOnUser('${u.userId}')">${escapeHTML(u.userName || u.userId)}</button>`;
  });
  html += '</div>';
  document.getElementById('positions-list').innerHTML = html + document.getElementById('positions-list').innerHTML;
}
window.centerOnUser = function(userId) {
  const u = userList.find(u => u.userId === userId);
  if (u) {
    map.setView([u.latitude, u.longitude], 16);
    if (positionMarkers[userId]) positionMarkers[userId].openPopup();
  }
};

// --- Affichage carte ---
function initMap() {
  map = L.map('map').setView([48.8566, 2.3522], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

// --- Affichage alertes ---
function renderAlerts(alerts) {
  const list = document.getElementById('alerts-list');
  list.innerHTML = alerts.map(a => `
    <div class="p-2 rounded ${a.status === 'critical' ? 'bg-red-100 border-l-4 border-red-600' : a.status === 'urgent' ? 'bg-yellow-100 border-l-4 border-yellow-600' : 'bg-gray-100'}">
      <span class="font-bold">${a.type === 'emergency' ? '⚠️' : '🚨'}</span>
      <span class="font-semibold">${escapeHTML(a.message || '')}</span>
      <span class="text-xs text-gray-500 ml-2">${escapeHTML(a.userName || '')} (${formatDate(a.timestamp)})</span>
    </div>`).join('');
  // Badge alerte
  const badge = document.getElementById('badge-alert');
  if (alerts.some(a => a.status === 'urgent' || a.status === 'critical')) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// --- Affichage logs de discussion ---
function renderLogs(messages) {
  const list = document.getElementById('logs-list');
  if (!list) return;
  const keywords = ['rlex', 'ping', 'max', 'jean', 'ars'];
  const logs = messages.slice(-10).reverse();
  list.innerHTML = logs.map(m => {
    const lowerMsg = (m.message || '').toLowerCase();
    const highlight = keywords.some(k => lowerMsg.includes(k));
    return `<div class="p-2 border-b flex items-center gap-2 rounded cursor-pointer ${highlight ? 'bg-yellow-200 font-bold ring-2 ring-yellow-400' : 'bg-white hover:bg-gray-100'}" title="Voir le détail" onclick="showLogDetail('${escapeHTML(m.userName || '')}', '${escapeHTML(m.message || '')}', '${formatDate(m.timestamp)}', '${escapeHTML(m.type || '')}', '${escapeHTML(m.status || '')}', '${escapeHTML(m.userId || '')}', '${escapeHTML(m.chatId || '')}')">
      <span class="font-bold">${escapeHTML(m.userName || '')}</span>
      <span class="ml-2">${escapeHTML(m.message || '')}</span>
      <span class="ml-2 text-xs text-gray-400">${formatDate(m.timestamp)}</span>
      ${highlight ? '<span class="ml-2 px-2 py-0.5 rounded bg-yellow-400 text-xs text-white">Mot-clé</span>' : ''}
    </div>`;
  }).join('');
}
window.showLogDetail = function(user, message, date, type, status, userId, chatId) {
  // Affichage détaillé dans une modal custom (pas d'image)
  const detail = `
    <div style='padding:20px;max-width:400px;'>
      <div class='font-bold text-lg mb-2'>Détail du message</div>
      <div><b>Utilisateur :</b> ${user}</div>
      <div><b>User ID :</b> ${userId || ''}</div>
      <div><b>Chat ID :</b> ${chatId || ''}</div>
      <div><b>Date :</b> ${date}</div>
      <div><b>Type :</b> ${type || ''}</div>
      <div><b>Statut :</b> ${status || ''}</div>
      <div class='mt-2'><b>Message :</b><br><span class='whitespace-pre-line'>${message}</span></div>
      <button onclick='document.getElementById("log-modal").remove()' class='mt-4 px-4 py-2 bg-blue-600 text-white rounded'>Fermer</button>
    </div>
  `;
  let modal = document.createElement('div');
  modal.id = 'log-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50';
  modal.innerHTML = `<div class='bg-white rounded shadow-lg'>${detail}</div>`;
  document.body.appendChild(modal);
};

// --- Affichage des utilisateurs connus sur la carte (même sans position) ---
function renderKnownUsers(messages, positions) {
  // Récupère tous les userId ayant contacté le bot
  const ids = new Set(messages.map(m => m.userId));
  // Ajoute ceux qui ont une position
  positions.forEach(p => ids.add(p.userId));
  // Liste sous la carte
  const list = Array.from(ids).map(id => {
    // Cherche le nom si dispo
    const msg = messages.find(m => m.userId === id);
    const name = msg ? msg.userName : id;
    return `<span class='inline-block px-2 py-1 m-1 rounded bg-gray-200 text-xs font-bold'>${escapeHTML(name)}</span>`;
  }).join('');
  let el = document.getElementById('known-users-list');
  if (!el) {
    el = document.createElement('div');
    el.id = 'known-users-list';
    el.className = 'my-2';
    document.getElementById('map').insertAdjacentElement('afterend', el);
  }
  el.innerHTML = `<div class='mb-1 text-xs text-gray-500'>Utilisateurs ayant contacté le bot :</div>${list}`;
}

// --- Amélioration affichage photos (cartes cliquables) ---
function renderPhotos(photos) {
  const list = document.getElementById('photos-list');
  list.innerHTML = photos.map(p => `
    <div class="relative group cursor-pointer bg-white rounded shadow hover:ring-2 hover:ring-blue-400 transition overflow-hidden">
      <img src="/data/photos/${escapeHTML(p.filename)}" alt="Photo chantier" class="rounded-t w-full object-cover h-40" onclick="showLightbox('/data/photos/${escapeHTML(p.filename)}')">
      <div class="p-2 text-xs text-gray-700">${escapeHTML(p.caption || '')}</div>
      <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition">Cliquez pour agrandir</div>
    </div>`).join('');
}

// --- Affichage portails ---
function renderPortals(portals) {
  const list = document.getElementById('portals-list');
  list.innerHTML = portals.map(p => `
    <div class="p-2 border-b flex flex-col md:flex-row md:items-center gap-2">
      <span class="font-bold">${escapeHTML(p.name || '')}</span>
      <span class="ml-2 text-xs text-gray-500">${escapeHTML(p.type || '')}</span>
      <span class="ml-2">Statut: <b>${escapeHTML(p.status || '')}</b></span>
      <span class="ml-2">Équipements: <span class="text-xs">${(p.equipment || []).slice(0,2).map(eq => escapeHTML(eq)).join(', ')}</span></span>
    </div>`).join('');
}

// --- Affichage urgences ---
function renderEmergencies(emergencies) {
  const list = document.getElementById('emergencies-list');
  list.innerHTML = emergencies.map(e => `
    <div class="p-2 border-b flex items-center gap-2 bg-red-50">
      <span class="font-bold text-red-700">${escapeHTML(e.message || '')}</span>
      <span class="ml-2 text-xs text-gray-400">${formatDate(e.timestamp)}</span>
    </div>`).join('');
}

// --- Affichage messages ---
function renderMessages(messages) {
  const list = document.getElementById('messages-list');
  list.innerHTML = messages.map(m => `
    <div class="p-2 border-b flex items-center gap-2">
      <span class="font-bold">${escapeHTML(m.userName || '')}</span>
      <span class="ml-2">${escapeHTML(m.message || '')}</span>
      <span class="ml-2 text-xs text-gray-400">${formatDate(m.timestamp)}</span>
    </div>`).join('');
}

// --- Export JSON/CSV ---
function exportData(data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lr-rail-assist-export.json';
  a.click();
  URL.revokeObjectURL(url);
}

// --- Initialisation globale ---
let globalData = {};
window.onload = async () => {
  initMap();
  const data = await fetchAll();
  globalData = data;
  // Affichage initial
  updateUserMarkers(data.positions, data.photos, data.messages);
  renderAlerts(data.alerts);
  renderPhotos(data.photos);
  renderPortals(data.portals);
  renderEmergencies(data.emergencies);
  renderMessages(data.messages);
  renderLogs(data.messages);
  renderKnownUsers(data.messages, data.positions);
  renderOperatorsList(data.positions);
  renderOperatorDetails(selectedOperatorId, data.positions, data.photos, data.messages);
  // Export
  if (document.getElementById('export-btn'))
    document.getElementById('export-btn').onclick = () => exportData(globalData);
};

// --- WebSocket temps réel ---
socket.on('alert', data => {
  globalData.alerts.push(data);
  renderAlerts(globalData.alerts);
  document.getElementById('badge-alert').classList.remove('hidden');
});
socket.on('photo', data => {
  globalData.photos.push(data);
  renderPhotos(globalData.photos);
});
socket.on('position', data => {
  globalData.positions.push(data);
  updateUserMarkers(globalData.positions, globalData.photos, globalData.messages);
});
// ... Ajoute d'autres événements si besoin 

// --- Les boutons de catégories (Alertes, Urgences, etc.) servent uniquement à masquer/afficher les sections, pas à filtrer ou rediriger. ---

function renderOperatorsList(positions) {
  const operatorsDiv = document.getElementById('operators-list');
  if (!operatorsDiv) return;
  // Récupère tous les opérateurs actifs (ayant une position)
  const latestPositions = getLatestPositionsByUser(positions);
  operatorsDiv.innerHTML = latestPositions.map(p => {
    const color = userColor(p.userId);
    const initial = (p.userName || p.userId)[0]?.toUpperCase() || '?';
    const isSelected = selectedOperatorId === p.userId;
    return `
      <span class="flex items-center gap-2 px-5 py-2 rounded-full font-bold shadow-lg ring-2 hover:scale-105 active:scale-95 focus:outline-none transition-all duration-150 select-none border-2 cursor-pointer ${isSelected ? 'bg-blue-600 text-white ring-blue-400 border-blue-700 scale-105' : ''}"
        style="background-color:${isSelected ? color : color + '22'}; color:${isSelected ? '#fff' : color}; border-color:${color};"
        onclick="selectOperator('${p.userId}')">
        <span class="inline-block w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg shadow" style="background-color:${color}; color:#fff;">${initial}</span>
        ${escapeHTML(p.userName || p.userId)}
        <span class="ml-2 px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-semibold shadow">Actif</span>
      </span>
    `;
  }).join('');
}

window.selectOperator = function(userId) {
  selectedOperatorId = userId;
  // Rafraîchir la liste pour mettre à jour le style sélectionné
  renderOperatorsList(globalData.positions);
  renderOperatorDetails(userId, globalData.positions, globalData.photos, globalData.messages);
};

function renderOperatorDetails(userId, positions, photos, messages) {
  const detailsDiv = document.getElementById('operator-details');
  if (!detailsDiv) return;
  // Trouver l'opérateur
  const pos = positions.filter(p => p.userId === userId).sort((a,b) => b.timestamp - a.timestamp)[0];
  const userPhotos = (photos || []).filter(ph => ph.userId === userId).sort((a,b) => b.timestamp - a.timestamp);
  const userMessages = (messages || []).filter(m => m.userId === userId).sort((a,b) => b.timestamp - a.timestamp);
  if (!pos) {
    detailsDiv.innerHTML = '<span class="text-gray-400 text-lg">Aucune donnée pour cet opérateur.</span>';
    return;
  }
  // Timer d'intervention si photo récente (< 1h)
  let timerHtml = '';
  const now = Date.now();
  const lastPhotoObj = userPhotos[0];
  if (lastPhotoObj && lastPhotoObj.timestamp && now - lastPhotoObj.timestamp < 60 * 60 * 1000) {
    const minutes = Math.floor((now - lastPhotoObj.timestamp) / 60000);
    const seconds = Math.floor(((now - lastPhotoObj.timestamp) % 60000) / 1000);
    timerHtml = `<div class='mt-2 text-blue-700 font-bold'>Intervention en cours : ${minutes}min ${seconds < 10 ? '0' : ''}${seconds}s</div>`;
  }
  detailsDiv.innerHTML = `
    <div class='mb-2 flex items-center gap-3'>
      <span class='inline-block w-12 h-12 rounded-full flex items-center justify-center font-bold text-2xl shadow' style='background-color:${userColor(userId)};color:#fff;'>${(pos.userName || userId)[0]?.toUpperCase() || '?'}</span>
      <div>
        <div class='font-bold text-lg'>${escapeHTML(pos.userName || userId)}</div>
        <div class='text-xs text-gray-500'>ID: ${escapeHTML(userId)}</div>
        <div class='text-xs text-gray-500'>Dernière position : ${formatDate(pos.timestamp)}</div>
      </div>
    </div>
    ${timerHtml}
    <div class='mt-2'>
      <div class='font-semibold mb-1'>Dernières photos :</div>
      <div class='flex flex-wrap gap-2'>
        ${userPhotos.slice(0,3).map(p => `<div class='flex flex-col items-center'><img src='/data/photos/${escapeHTML(p.filename)}' alt='Photo' class='w-20 h-20 object-cover rounded shadow cursor-pointer' onclick='showLightbox("/data/photos/${escapeHTML(p.filename)}")'><span class='text-xs text-gray-500 mt-1'>${formatDate(p.timestamp)}</span></div>`).join('') || '<span class="text-xs text-gray-400">Aucune photo</span>'}
      </div>
    </div>
    <div class='mt-2'>
      <div class='font-semibold mb-1'>Derniers messages :</div>
      <div class='flex flex-col gap-1'>
        ${userMessages.slice(0,3).map(m => `<div class='text-xs'><span class='font-bold text-blue-700'>${escapeHTML(m.userName || '')}</span> : ${escapeHTML(m.message || '')} <span class='text-gray-400'>${formatDate(m.timestamp)}</span></div>`).join('') || '<span class="text-xs text-gray-400">Aucun message</span>'}
      </div>
    </div>
  `;
} 