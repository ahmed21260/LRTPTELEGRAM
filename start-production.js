#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Démarrage LR ASSIST en mode production...');

// Vérifier si PM2 est installé
function checkPM2() {
  return new Promise((resolve) => {
    const pm2Check = spawn('pm2', ['--version'], { stdio: 'pipe' });
    pm2Check.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

// Installer PM2 si nécessaire
async function installPM2() {
  console.log('📦 Installation de PM2...');
  return new Promise((resolve, reject) => {
    const install = spawn('npm', ['install', '-g', 'pm2'], { stdio: 'inherit' });
    install.on('close', (code) => {
      if (code === 0) {
        console.log('✅ PM2 installé avec succès');
        resolve();
      } else {
        reject(new Error('Erreur installation PM2'));
      }
    });
  });
}

// Créer les dossiers nécessaires
function createDirectories() {
  const dirs = [
    './logs',
    './data',
    './data/photos',
    './data/fiches'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Dossier créé: ${dir}`);
    }
  });
}

// Démarrer le bot avec PM2
function startBot() {
  console.log('🚦 Démarrage du bot LR ASSIST...');
  
  return new Promise((resolve, reject) => {
    const start = spawn('pm2', ['start', 'ecosystem.config.js'], { stdio: 'inherit' });
    start.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Bot démarré avec succès');
        resolve();
      } else {
        reject(new Error('Erreur démarrage bot'));
      }
    });
  });
}

// Afficher le statut
function showStatus() {
  console.log('\n📊 Statut du bot:');
  const status = spawn('pm2', ['status'], { stdio: 'inherit' });
}

// Afficher les logs
function showLogs() {
  console.log('\n📋 Logs du bot:');
  const logs = spawn('pm2', ['logs', 'telegr-bot', '--lines', '10'], { stdio: 'inherit' });
}

// Fonction principale
async function main() {
  try {
    // Créer les dossiers
    createDirectories();
    
    // Vérifier PM2
    const pm2Installed = await checkPM2();
    if (!pm2Installed) {
      console.log('⚠️ PM2 non trouvé, installation...');
      await installPM2();
    }
    
    // Démarrer le bot
    await startBot();
    
    // Afficher le statut
    setTimeout(showStatus, 2000);
    
    console.log('\n🎉 LR ASSIST est maintenant opérationnel !');
    console.log('📱 Le bot Telegram est en écoute...');
    console.log('🚨 Fonctionnalités d\'urgence activées');
    console.log('🚪 Portails d\'accès SNCF disponibles');
    console.log('🔧 Compatible: CAT M323F, pelles rail-route');
    
    console.log('\n📋 Commandes utiles:');
    console.log('• npm run logs     - Voir les logs');
    console.log('• npm run status   - Voir le statut');
    console.log('• npm run restart  - Redémarrer le bot');
    console.log('• npm run stop     - Arrêter le bot');
    
    console.log('\n🚦 Le bot est prêt pour les opérateurs ferroviaires !');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Gestion des signaux
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt de LR ASSIST...');
  const stop = spawn('pm2', ['stop', 'telegr-bot'], { stdio: 'inherit' });
  stop.on('close', () => {
    console.log('✅ Arrêt terminé');
    process.exit(0);
  });
});

// Démarrer
main(); 