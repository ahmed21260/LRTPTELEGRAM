# Guide d'Utilisation - Handlers Photo et Message

## 🚀 Démarrage Rapide

### 1. Installation
```bash
cd bot
npm install
```

### 2. Configuration
Créez un fichier `.env` dans le dossier `bot/` :
```bash
TELEGRAM_TOKEN=your_bot_token
ADMIN_CHAT_ID=your_admin_chat_id
DASHBOARD_URL=http://localhost:3000
```

### 3. Démarrage
```bash
npm start
```

## 📸 Handler Photo - Utilisation

### Fonctionnalités Principales

#### Téléchargement Automatique
- **Envoi de photo** : Envoyez une photo au bot
- **Sauvegarde automatique** : La photo est téléchargée dans `bot/photos/`
- **Nommage unique** : Format `photo_TIMESTAMP_USERID.jpg`

#### Métadonnées Capturées
```json
{
  "operator": {
    "userId": "123456789",
    "userName": "John",
    "userLastName": "Doe",
    "username": "johndoe"
  },
  "photo": {
    "filename": "photo_1704110400000_123456789.jpg",
    "fileSize": 1024000,
    "dimensions": {
      "width": 1920,
      "height": 1080
    },
    "caption": "Description de la photo"
  }
}
```

#### Logs Détaillés
- **Fichier** : `bot/logs/photo_actions_YYYY-MM-DD.json`
- **Contenu** : Toutes les actions sur les photos
- **Format** : JSON structuré avec métadonnées complètes

### Exemple d'Utilisation

1. **Envoyer une photo** au bot via Telegram
2. **Ajouter une description** (optionnel)
3. **Confirmation automatique** avec détails
4. **Photo sauvegardée** dans `bot/photos/`
5. **Log créé** dans `bot/logs/`

### Messages de Confirmation
```
📸 Photo traitée avec succès

👤 Opérateur: John Doe
📝 Description: Signal défaillant
📏 Taille: 1.25 MB
📐 Dimensions: 1920x1080
💾 Fichier: photo_1704110400000_123456789.jpg
🕐 Horodatage: 01/01/2024 12:00:00

✅ Photo sauvegardée et loggée
```

## 💬 Handler Message - Utilisation

### Types de Messages Détectés

#### 1. Alertes (Priorité: Haute)
**Mots-clés** : `urgence`, `danger`, `accident`
```bash
# Exemples
"Urgence sur la voie 2"
"Danger signal défaillant"
"Accident matériel roulant"
```

**Actions automatiques** :
- Transmission aux administrateurs
- Logging prioritaire
- Confirmation à l'utilisateur

#### 2. Commandes (Priorité: Moyenne)
**Format** : Messages commençant par `/`
```bash
/start    # Menu principal
/help     # Aide
/status   # Statut du système
```

#### 3. Questions (Priorité: Moyenne)
**Mots-clés** : `?`, `comment`, `quoi`, `où`
```bash
# Exemples
"Comment procéder ?"
"Où est le portail d'accès ?"
"Quoi faire en cas d'urgence ?"
```

#### 4. Rapports (Priorité: Moyenne)
**Mots-clés** : `rapport`, `signalement`, `problème`
```bash
# Exemples
"Rapport maintenance voie"
"Signalement anomalie"
"Problème signalisation"
```

#### 5. Messages Normaux (Priorité: Basse)
Tous les autres messages

### Gestion des Alertes

#### Transmission Automatique
```json
{
  "action": "ALERT_TRANSMITTED",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "operator": {
    "userId": "123456789",
    "userName": "John Doe"
  },
  "alert": {
    "message": "Urgence sur la voie 2",
    "priority": "high",
    "location": {
      "latitude": 48.8566,
      "longitude": 2.3522,
      "pkSNCF": "PK 12+500"
    }
  }
}
```

#### Message aux Administrateurs
```
🚨 ALERTE D'URGENCE RECUE

👤 Opérateur: John Doe
🆔 ID: 123456789
📍 Position: 48.8566, 2.3522
🚦 PK SNCF: PK 12+500
🛤️ Ligne: Paris-Lyon
🕐 Horodatage: 01/01/2024 12:00:00

⚠️ Intervention requise immédiatement
```

## 📊 Monitoring et Logs

### Fichiers de Logs

#### Actions Photos
- **Fichier** : `bot/logs/photo_actions_YYYY-MM-DD.json`
- **Contenu** : Toutes les actions sur les photos
- **Rotation** : Un fichier par jour

#### Erreurs Photos
- **Fichier** : `bot/logs/photo_errors_YYYY-MM-DD.json`
- **Contenu** : Toutes les erreurs de traitement photos
- **Détails** : Stack trace, contexte utilisateur

#### Actions Messages
- **Fichier** : `bot/logs/message_actions_YYYY-MM-DD.json`
- **Contenu** : Toutes les actions sur les messages
- **Types** : Alerte, commande, question, rapport, normal

#### Erreurs Messages
- **Fichier** : `bot/logs/message_errors_YYYY-MM-DD.json`
- **Contenu** : Toutes les erreurs de traitement messages

### Commandes de Monitoring

```bash
# Voir les logs en temps réel
npm run logs

# Tester le bot
npm test

# Mode développement
npm run dev
```

## 🔧 Configuration Avancée

### Variables d'Environnement

```bash
# Telegram
TELEGRAM_TOKEN=your_bot_token
ADMIN_CHAT_ID=your_admin_chat_id

# Dashboard
DASHBOARD_URL=http://localhost:3000
DASHBOARD_ENABLED=true

# Photos
PHOTO_MAX_SIZE=10485760  # 10MB
PHOTO_QUALITY=high

# Logging
LOG_LEVEL=info
LOG_FILE=bot/logs/bot.log

# Sécurité
ALLOWED_USERS=user1,user2,user3
REQUIRE_AUTH=false
EMERGENCY_NUMBERS=112,18
```

### Personnalisation des Handlers

#### PhotoHandler
```javascript
// Dans photoHandler.js
class PhotoHandler {
  constructor(bot, config) {
    // Personnaliser les dossiers
    this.photosDir = path.join(__dirname, '..', 'photos');
    this.logsDir = path.join(__dirname, '..', 'logs');
    
    // Personnaliser la qualité
    this.quality = config.photos.quality;
    this.maxSize = config.photos.maxSize;
  }
}
```

#### MessageHandler
```javascript
// Dans messageHandler.js
class MessageHandler {
  detectMessageType(text) {
    // Personnaliser la détection
    const lowerText = text.toLowerCase();
    
    // Ajouter vos mots-clés
    if (lowerText.includes('votre_mot_cle')) {
      return { type: 'custom', priority: 'medium' };
    }
  }
}
```

## 🚨 Gestion des Erreurs

### Types d'Erreurs Courantes

#### 1. Erreurs de Téléchargement
```
❌ Erreur téléchargement: ECONNREFUSED
```
**Solution** : Vérifier la connexion internet et l'API Telegram

#### 2. Erreurs de Sauvegarde
```
❌ Erreur sauvegarde données: EACCES
```
**Solution** : Vérifier les permissions du dossier `bot/photos/`

#### 3. Erreurs de Dashboard
```
❌ Erreur émission dashboard: ECONNREFUSED
```
**Solution** : Vérifier que le dashboard est démarré sur `http://localhost:3000`

### Logs d'Erreurs
Chaque erreur est loggée avec :
- **Contexte utilisateur** : ID, nom, chat
- **Action en cours** : Type d'opération
- **Détails techniques** : Message d'erreur, stack trace
- **Timestamp** : Horodatage précis

## 🔄 Intégration Dashboard

### Événements Émis

#### Photo
```javascript
socket.emit('photo', {
  userId: "123456789",
  userName: "John Doe",
  filename: "photo_1704110400000_123456789.jpg",
  caption: "Description",
  timestamp: 1704110400000,
  fileSize: 1024000,
  dimensions: { width: 1920, height: 1080 }
});
```

#### Message
```javascript
socket.emit('message', {
  userId: "123456789",
  userName: "John Doe",
  message: "Urgence sur la voie 2",
  type: "alert",
  priority: "high",
  timestamp: 1704110400000
});
```

### Configuration Dashboard
```javascript
// Dans votre dashboard
const socket = io('http://localhost:3000');

socket.on('photo', (data) => {
  // Traiter nouvelle photo
  console.log('Nouvelle photo:', data);
});

socket.on('message', (data) => {
  // Traiter nouveau message
  console.log('Nouveau message:', data);
});
```

## 📈 Performance

### Optimisations Actives
- **Téléchargement asynchrone** : Non-bloquant
- **Streams** : Gestion mémoire optimisée
- **Logs rotatifs** : Évite saturation disque
- **Cache intelligent** : Réutilisation données

### Métriques
- **Temps de traitement photo** : < 2 secondes
- **Temps de traitement message** : < 500ms
- **Taille maximale photo** : 10MB
- **Formats supportés** : JPEG, PNG, JPG

## 🛡️ Sécurité

### Fonctionnalités
- **Validation utilisateurs** : Liste d'utilisateurs autorisés
- **Limitation taille** : Taille maximale des photos
- **Types fichiers** : Formats autorisés uniquement
- **Logs sécurité** : Traçabilité complète

### Bonnes Pratiques
1. **Configurer ADMIN_CHAT_ID** pour les alertes
2. **Limiter ALLOWED_USERS** si nécessaire
3. **Surveiller les logs** régulièrement
4. **Backup des photos** importantes
5. **Mise à jour dépendances** régulière

---

**LR ASSIST Bot** - Sécurité ferroviaire intelligente 🚦 