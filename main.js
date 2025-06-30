const { fork } = require('child_process');
const path = require('path');

// Lancer le serveur web (dashboard)
const server = fork(path.join(__dirname, 'server.js'));

// Lancer le bot Telegram
const bot = fork(path.join(__dirname, 'start.js'));

// Gestion des sorties pour debug
server.on('message', msg => console.log('[SERVER]', msg));
bot.on('message', msg => console.log('[BOT]', msg));

server.on('exit', code => console.log(`[SERVER] exited with code ${code}`));
bot.on('exit', code => console.log(`[BOT] exited with code ${code}`)); 