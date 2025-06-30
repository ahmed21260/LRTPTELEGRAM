const chalk = require('chalk');
const inquirer = require('inquirer');
const moment = require('moment');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { FirestoreService } = require('./firebase');
const config = require('./config');

class RailwayConsole {
  constructor() {
    this.firestore = new FirestoreService();
    this.isRunning = false;
    this.filters = {
      userId: null,
      type: null,
      status: null,
      limit: 50
    };
  }

  // Start console
  async start() {
    console.clear();
    console.log(chalk.blue.bold('🚦 CONSOLE LR ASSIST - Opérateurs Ferroviaires'));
    console.log(chalk.gray('Interface de supervision en temps réel\n'));

    this.isRunning = true;
    await this.showMainMenu();
  }

  // Main menu
  async showMainMenu() {
    while (this.isRunning) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Que souhaitez-vous faire ?',
          choices: [
            { name: '📊 Afficher messages en temps réel', value: 'realtime' },
            { name: '📸 Gérer photos', value: 'photos' },
            { name: '📍 Gérer localisations', value: 'locations' },
            { name: '🔍 Rechercher messages', value: 'search' },
            { name: '📋 Exporter données', value: 'export' },
            { name: '⚙️ Configuration filtres', value: 'filters' },
            { name: '❌ Quitter', value: 'quit' }
          ]
        }
      ]);

      switch (action) {
        case 'realtime':
          await this.showRealTimeMessages();
          break;
        case 'photos':
          await this.managePhotos();
          break;
        case 'locations':
          await this.manageLocations();
          break;
        case 'search':
          await this.searchMessages();
          break;
        case 'export':
          await this.exportData();
          break;
        case 'filters':
          await this.configureFilters();
          break;
        case 'quit':
          this.isRunning = false;
          console.log(chalk.green('👋 Au revoir !'));
          process.exit(0);
      }
    }
  }

  // Real-time messages display
  async showRealTimeMessages() {
    console.log(chalk.yellow('\n📊 Affichage messages en temps réel...'));
    console.log(chalk.gray('Appuyez sur Ctrl+C pour revenir au menu\n'));

    let lastMessageId = null;

    const displayMessages = async () => {
      try {
        const messages = await this.firestore.getMessages(this.filters);
        
        if (messages.length > 0 && messages[0].id !== lastMessageId) {
          console.clear();
          console.log(chalk.blue.bold('🚦 MESSAGES EN TEMPS RÉEL'));
          console.log(chalk.gray(`Dernière mise à jour: ${moment().format('HH:mm:ss')}\n`));

          messages.forEach((message, index) => {
            this.displayMessage(message, index + 1);
          });

          lastMessageId = messages[0].id;
        }
      } catch (error) {
        console.error(chalk.red('❌ Erreur récupération messages:', error.message));
      }
    };

    // Initial display
    await displayMessages();

    // Update every 5 seconds
    const interval = setInterval(displayMessages, 5000);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(chalk.yellow('\n⏹️ Retour au menu principal...'));
      setTimeout(() => {}, 1000);
    });
  }

  // Display single message
  displayMessage(message, index) {
    const timestamp = message.createdAt ? moment(message.createdAt.toDate()).format('DD/MM HH:mm:ss') : 'N/A';
    const status = message.status || 'normal';
    const type = message.type || 'message';

    // Status color
    let statusColor = chalk.green;
    if (status === 'urgent') statusColor = chalk.red;
    else if (status === 'warning') statusColor = chalk.yellow;

    // Type icon
    let typeIcon = '💬';
    if (type === 'photo') typeIcon = '📸';
    else if (type === 'location') typeIcon = '📍';
    else if (type === 'emergency') typeIcon = '🚨';

    console.log(`${chalk.cyan(`${index}.`)} ${typeIcon} ${chalk.white(message.message || 'Sans message')}`);
    console.log(`   ${chalk.gray(`👤 ${message.userId || 'Anonyme'} | ⏰ ${timestamp} | ${statusColor(status.toUpperCase())}`)}`);
    
    if (message.location) {
      console.log(`   ${chalk.blue(`📍 ${message.location.latitude}, ${message.location.longitude} | PK: ${message.location.pkSNCF || 'N/A'}`)}`);
    }
    
    if (message.photoUrl) {
      console.log(`   ${chalk.magenta(`📸 Photo: ${message.photoUrl}`)}`);
    }
    
    console.log('');
  }

  // Manage photos
  async managePhotos() {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Gestion des photos',
        choices: [
          { name: '📸 Afficher toutes les photos', value: 'list' },
          { name: '🔍 Rechercher par utilisateur', value: 'search' },
          { name: '📅 Filtrer par date', value: 'date' },
          { name: '⬅️ Retour', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'list':
        await this.listPhotos();
        break;
      case 'search':
        await this.searchPhotosByUser();
        break;
      case 'date':
        await this.filterPhotosByDate();
        break;
      case 'back':
        return;
    }
  }

  // List photos
  async listPhotos() {
    try {
      const photos = await this.firestore.getPhotos({ limit: 20 });
      
      console.log(chalk.blue.bold('\n📸 PHOTOS RÉCENTES'));
      console.log(chalk.gray(`Total: ${photos.length} photos\n`));

      photos.forEach((photo, index) => {
        const timestamp = photo.createdAt ? moment(photo.createdAt.toDate()).format('DD/MM HH:mm:ss') : 'N/A';
        console.log(`${chalk.cyan(`${index + 1}.`)} ${chalk.white(photo.filename || 'Photo sans nom')}`);
        console.log(`   ${chalk.gray(`👤 ${photo.userId || 'Anonyme'} | ⏰ ${timestamp}`)}`);
        console.log(`   ${chalk.magenta(`🔗 ${photo.url || 'URL non disponible'}`)}`);
        console.log('');
      });

      await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Appuyez sur Entrée pour continuer...' }]);
    } catch (error) {
      console.error(chalk.red('❌ Erreur récupération photos:', error.message));
    }
  }

  // Search photos by user
  async searchPhotosByUser() {
    const { userId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'userId',
        message: 'Entrez l\'ID utilisateur:'
      }
    ]);

    try {
      const photos = await this.firestore.getPhotos({ userId, limit: 50 });
      
      console.log(chalk.blue.bold(`\n📸 PHOTOS DE L'UTILISATEUR ${userId}`));
      console.log(chalk.gray(`Total: ${photos.length} photos\n`));

      photos.forEach((photo, index) => {
        const timestamp = photo.createdAt ? moment(photo.createdAt.toDate()).format('DD/MM HH:mm:ss') : 'N/A';
        console.log(`${chalk.cyan(`${index + 1}.`)} ${chalk.white(photo.filename || 'Photo sans nom')}`);
        console.log(`   ${chalk.gray(`⏰ ${timestamp}`)}`);
        console.log(`   ${chalk.magenta(`🔗 ${photo.url || 'URL non disponible'}`)}`);
        console.log('');
      });

      await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Appuyez sur Entrée pour continuer...' }]);
    } catch (error) {
      console.error(chalk.red('❌ Erreur récupération photos:', error.message));
    }
  }

  // Filter photos by date
  async filterPhotosByDate() {
    const { date } = await inquirer.prompt([
      {
        type: 'input',
        name: 'date',
        message: 'Entrez la date (format: YYYY-MM-DD):',
        default: moment().format('YYYY-MM-DD')
      }
    ]);

    try {
      const photos = await this.firestore.getPhotos({ limit: 100 });
      const filteredPhotos = photos.filter(photo => {
        if (!photo.createdAt) return false;
        const photoDate = moment(photo.createdAt.toDate()).format('YYYY-MM-DD');
        return photoDate === date;
      });

      console.log(chalk.blue.bold(`\n📸 PHOTOS DU ${date}`));
      console.log(chalk.gray(`Total: ${filteredPhotos.length} photos\n`));

      filteredPhotos.forEach((photo, index) => {
        const timestamp = photo.createdAt ? moment(photo.createdAt.toDate()).format('HH:mm:ss') : 'N/A';
        console.log(`${chalk.cyan(`${index + 1}.`)} ${chalk.white(photo.filename || 'Photo sans nom')}`);
        console.log(`   ${chalk.gray(`👤 ${photo.userId || 'Anonyme'} | ⏰ ${timestamp}`)}`);
        console.log(`   ${chalk.magenta(`🔗 ${photo.url || 'URL non disponible'}`)}`);
        console.log('');
      });

      await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Appuyez sur Entrée pour continuer...' }]);
    } catch (error) {
      console.error(chalk.red('❌ Erreur récupération photos:', error.message));
    }
  }

  // Manage locations
  async manageLocations() {
    try {
      const locations = await this.firestore.getLocations({ limit: 20 });
      
      console.log(chalk.blue.bold('\n📍 LOCALISATIONS RÉCENTES'));
      console.log(chalk.gray(`Total: ${locations.length} localisations\n`));

      locations.forEach((location, index) => {
        const timestamp = location.createdAt ? moment(location.createdAt.toDate()).format('DD/MM HH:mm:ss') : 'N/A';
        console.log(`${chalk.cyan(`${index + 1}.`)} ${chalk.white(`PK: ${location.pkSNCF || 'N/A'}`)}`);
        console.log(`   ${chalk.gray(`👤 ${location.userId || 'Anonyme'} | ⏰ ${timestamp}`)}`);
        console.log(`   ${chalk.blue(`📍 ${location.latitude}, ${location.longitude}`)}`);
        console.log('');
      });

      await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Appuyez sur Entrée pour continuer...' }]);
    } catch (error) {
      console.error(chalk.red('❌ Erreur récupération localisations:', error.message));
    }
  }

  // Search messages
  async searchMessages() {
    const { searchType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'searchType',
        message: 'Type de recherche',
        choices: [
          { name: '🔍 Par texte', value: 'text' },
          { name: '👤 Par utilisateur', value: 'user' },
          { name: '📅 Par date', value: 'date' },
          { name: '📍 Par PK', value: 'pk' },
          { name: '⬅️ Retour', value: 'back' }
        ]
      }
    ]);

    if (searchType === 'back') return;

    // For now, show basic search functionality
    console.log(chalk.yellow('🔍 Fonctionnalité de recherche en cours de développement...'));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Appuyez sur Entrée pour continuer...' }]);
  }

  // Export data
  async exportData() {
    const { exportType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'exportType',
        message: 'Type d\'export',
        choices: [
          { name: '📊 Messages (CSV)', value: 'messages' },
          { name: '📸 Photos (CSV)', value: 'photos' },
          { name: '📍 Localisations (CSV)', value: 'locations' },
          { name: '📋 Tout (CSV)', value: 'all' },
          { name: '⬅️ Retour', value: 'back' }
        ]
      }
    ]);

    if (exportType === 'back') return;

    try {
      await this.performExport(exportType);
    } catch (error) {
      console.error(chalk.red('❌ Erreur export:', error.message));
    }
  }

  // Perform export
  async performExport(exportType) {
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    
    if (exportType === 'messages' || exportType === 'all') {
      const messages = await this.firestore.getMessages({ limit: 1000 });
      const csvWriter = createCsvWriter({
        path: `export_messages_${timestamp}.csv`,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'userId', title: 'Utilisateur' },
          { id: 'message', title: 'Message' },
          { id: 'type', title: 'Type' },
          { id: 'status', title: 'Statut' },
          { id: 'createdAt', title: 'Date création' }
        ]
      });

      const records = messages.map(msg => ({
        id: msg.id,
        userId: msg.userId || 'Anonyme',
        message: msg.message || '',
        type: msg.type || 'message',
        status: msg.status || 'normal',
        createdAt: msg.createdAt ? moment(msg.createdAt.toDate()).format('DD/MM/YYYY HH:mm:ss') : 'N/A'
      }));

      await csvWriter.writeRecords(records);
      console.log(chalk.green(`✅ Messages exportés: export_messages_${timestamp}.csv`));
    }

    if (exportType === 'photos' || exportType === 'all') {
      const photos = await this.firestore.getPhotos({ limit: 1000 });
      const csvWriter = createCsvWriter({
        path: `export_photos_${timestamp}.csv`,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'userId', title: 'Utilisateur' },
          { id: 'filename', title: 'Nom fichier' },
          { id: 'url', title: 'URL' },
          { id: 'createdAt', title: 'Date création' }
        ]
      });

      const records = photos.map(photo => ({
        id: photo.id,
        userId: photo.userId || 'Anonyme',
        filename: photo.filename || '',
        url: photo.url || '',
        createdAt: photo.createdAt ? moment(photo.createdAt.toDate()).format('DD/MM/YYYY HH:mm:ss') : 'N/A'
      }));

      await csvWriter.writeRecords(records);
      console.log(chalk.green(`✅ Photos exportées: export_photos_${timestamp}.csv`));
    }

    if (exportType === 'locations' || exportType === 'all') {
      const locations = await this.firestore.getLocations({ limit: 1000 });
      const csvWriter = createCsvWriter({
        path: `export_locations_${timestamp}.csv`,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'userId', title: 'Utilisateur' },
          { id: 'latitude', title: 'Latitude' },
          { id: 'longitude', title: 'Longitude' },
          { id: 'pkSNCF', title: 'PK SNCF' },
          { id: 'createdAt', title: 'Date création' }
        ]
      });

      const records = locations.map(loc => ({
        id: loc.id,
        userId: loc.userId || 'Anonyme',
        latitude: loc.latitude || '',
        longitude: loc.longitude || '',
        pkSNCF: loc.pkSNCF || '',
        createdAt: loc.createdAt ? moment(loc.createdAt.toDate()).format('DD/MM/YYYY HH:mm:ss') : 'N/A'
      }));

      await csvWriter.writeRecords(records);
      console.log(chalk.green(`✅ Localisations exportées: export_locations_${timestamp}.csv`));
    }

    console.log(chalk.green('✅ Export terminé !'));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Appuyez sur Entrée pour continuer...' }]);
  }

  // Configure filters
  async configureFilters() {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Configuration des filtres',
        choices: [
          { name: '👤 Filtrer par utilisateur', value: 'user' },
          { name: '📝 Filtrer par type', value: 'type' },
          { name: '⚠️ Filtrer par statut', value: 'status' },
          { name: '📊 Limiter nombre résultats', value: 'limit' },
          { name: '🔄 Réinitialiser filtres', value: 'reset' },
          { name: '📋 Afficher filtres actuels', value: 'show' },
          { name: '⬅️ Retour', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'user':
        const { userId } = await inquirer.prompt([
          { type: 'input', name: 'userId', message: 'ID utilisateur (vide pour aucun filtre):' }
        ]);
        this.filters.userId = userId || null;
        break;
      case 'type':
        const { type } = await inquirer.prompt([
          {
            type: 'list',
            name: 'type',
            message: 'Type de message:',
            choices: [
              { name: 'Tous', value: null },
              { name: 'Message texte', value: 'message' },
              { name: 'Photo', value: 'photo' },
              { name: 'Localisation', value: 'location' },
              { name: 'Urgence', value: 'emergency' }
            ]
          }
        ]);
        this.filters.type = type;
        break;
      case 'status':
        const { status } = await inquirer.prompt([
          {
            type: 'list',
            name: 'status',
            message: 'Statut:',
            choices: [
              { name: 'Tous', value: null },
              { name: 'Normal', value: 'normal' },
              { name: 'Urgent', value: 'urgent' },
              { name: 'Avertissement', value: 'warning' }
            ]
          }
        ]);
        this.filters.status = status;
        break;
      case 'limit':
        const { limit } = await inquirer.prompt([
          { type: 'number', name: 'limit', message: 'Nombre maximum de résultats:', default: 50 }
        ]);
        this.filters.limit = limit;
        break;
      case 'reset':
        this.filters = { userId: null, type: null, status: null, limit: 50 };
        console.log(chalk.green('✅ Filtres réinitialisés'));
        break;
      case 'show':
        console.log(chalk.blue('\n📋 Filtres actuels:'));
        console.log(`👤 Utilisateur: ${this.filters.userId || 'Tous'}`);
        console.log(`📝 Type: ${this.filters.type || 'Tous'}`);
        console.log(`⚠️ Statut: ${this.filters.status || 'Tous'}`);
        console.log(`📊 Limite: ${this.filters.limit}`);
        console.log('');
        break;
      case 'back':
        return;
    }

    if (action !== 'show' && action !== 'back') {
      console.log(chalk.green('✅ Filtres mis à jour'));
    }

    await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Appuyez sur Entrée pour continuer...' }]);
  }
}

// Start console if run directly
if (require.main === module) {
  const console = new RailwayConsole();
  console.start().catch(error => {
    console.error(chalk.red('❌ Erreur console:', error.message));
    process.exit(1);
  });
}

module.exports = RailwayConsole; 