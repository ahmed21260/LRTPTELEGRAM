# LR ASSIST Bot - Handlers Photo et Message

## 📋 Description

Bot Telegram intelligent pour la gestion ferroviaire avec handlers spécialisés pour les photos et messages, incluant un système de logging complet et une gestion d'erreurs robuste.

## 🚀 Fonctionnalités

### 📸 Handler Photo
- **Téléchargement automatique** des photos envoyées
- **Sauvegarde organisée** dans `bot/photos/`
- **Logging détaillé** avec métadonnées complètes
- **Gestion d'erreurs** avec logs d'erreurs séparés
- **Émission temps réel** vers le dashboard
- **Informations détaillées** : taille, dimensions, opérateur

### 💬 Handler Message
- **Détection automatique** du type de message (alerte, commande, question, rapport)
- **Traitement intelligent** selon le type détecté
- **Logging complet** des actions et erreurs
- **Gestion des alertes** avec transmission aux administrateurs
- **Menu interactif** avec boutons et callbacks

### 📊 Logging Avancé
- **Logs par date** : `photo_actions_YYYY-MM-DD.json`
- **Logs d'erreurs** : `photo_errors_YYYY-MM-DD.json`
- **Métadonnées complètes** : opérateur, timestamp, contexte
- **Rotation automatique** des fichiers de log

## 📁 Structure des Fichiers

```
bot/
├── handlers/
│   ├── photoHandler.js      # Handler pour les photos
│   └── messageHandler.js    # Handler pour les messages
├── photos/                  # Photos téléchargées
├── logs/                    # Fichiers de logs
├── botManager.js           # Gestionnaire principal
├── config.js               # Configuration
├── start.js                # Point d'entrée
├── package.json            # Dépendances
└── README.md               # Documentation
```

## 🛠️ Installation

1. **Installer les dépendances** :
```bash
cd bot
npm install
```

2. **Configurer les variables d'environnement** :
```bash
# Créer un fichier .env
TELEGRAM_TOKEN=your_telegram_token
ADMIN_CHAT_ID=your_admin_chat_id
DASHBOARD_URL=http://localhost:3000
```

3. **Démarrer le bot** :
```bash
npm start
```

## 📸 Utilisation du Handler Photo

### Fonctionnalités
- **Téléchargement automatique** : Les photos sont sauvegardées avec un nom unique
- **Métadonnées complètes** : Opérateur, dimensions, taille, horodatage
- **Logging détaillé** : Chaque action est loggée avec contexte complet

### Format des Logs
```json
{
  "action": "PHOTO_RECEIVED",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "operator": {
    "userId": "123456789",
    "userName": "John",
    "userLastName": "Doe",
    "username": "johndoe",
    "chatId": "987654321"
  },
  "photo": {
    "filename": "photo_1704110400000_123456789.jpg",
    "fileSize": 1024000,
    "fileSizeKB": "1000.00",
    "dimensions": {
      "width": 1920,
      "height": 1080
    },
    "caption": "Description de la photo"
  }
}
```

## 💬 Utilisation du Handler Message

### Types de Messages Détectés
- **Alerte** : Messages contenant "urgence", "danger", "accident"
- **Commande** : Messages commençant par "/"
- **Question** : Messages contenant "?", "comment", "quoi", "où"
- **Rapport** : Messages contenant "rapport", "signalement", "problème"
- **Normal** : Autres messages

### Gestion des Alertes
- **Transmission automatique** aux administrateurs
- **Logging prioritaire** avec niveau "high"
- **Confirmation** à l'utilisateur

## 🔧 Configuration

### Variables d'Environnement
```bash
# Telegram
TELEGRAM_TOKEN=your_bot_token
ADMIN_CHAT_ID=your_admin_chat_id

# Dashboard
DASHBOARD_URL=http://localhost:3000
DASHBOARD_ENABLED=true

# Logging
LOG_LEVEL=info
LOG_FILE=bot/logs/bot.log

# Photos
PHOTO_MAX_SIZE=10485760  # 10MB
PHOTO_QUALITY=high

# Sécurité
ALLOWED_USERS=user1,user2,user3
REQUIRE_AUTH=false
EMERGENCY_NUMBERS=112,18
```

## 📊 Monitoring et Logs

### Fichiers de Logs
- `bot/logs/photo_actions_YYYY-MM-DD.json` : Actions sur les photos
- `bot/logs/photo_errors_YYYY-MM-DD.json` : Erreurs photos
- `bot/logs/message_actions_YYYY-MM-DD.json` : Actions sur les messages
- `bot/logs/message_errors_YYYY-MM-DD.json` : Erreurs messages

### Commandes Utiles
```bash
# Voir les logs en temps réel
npm run logs

# Tester le bot
npm test

# Mode développement
npm run dev
```

## 🚨 Gestion des Erreurs

### Types d'Erreurs Gérées
- **Erreurs de téléchargement** : Photos corrompues ou inaccessibles
- **Erreurs de sauvegarde** : Problèmes de permissions ou d'espace
- **Erreurs de réseau** : Problèmes de connexion Telegram
- **Erreurs de dashboard** : Problèmes de communication WebSocket

### Logs d'Erreurs
Chaque erreur est loggée avec :
- **Contexte complet** : Opérateur, action, timestamp
- **Détails techniques** : Message d'erreur, stack trace
- **Actions correctives** : Suggestions de résolution

## 🔄 Intégration Dashboard

### Événements Émis
- `photo` : Nouvelle photo reçue
- `message` : Nouveau message reçu
- `alert` : Nouvelle alerte déclenchée

### Format des Données
```javascript
// Événement photo
{
  userId: "123456789",
  userName: "John Doe",
  filename: "photo_1704110400000_123456789.jpg",
  caption: "Description",
  timestamp: 1704110400000,
  fileSize: 1024000,
  dimensions: { width: 1920, height: 1080 }
}
```

## 🛡️ Sécurité

### Fonctionnalités
- **Validation des utilisateurs** : Liste d'utilisateurs autorisés
- **Limitation de taille** : Taille maximale des photos
- **Types de fichiers** : Formats autorisés uniquement
- **Logs de sécurité** : Traçabilité complète des actions

## 📈 Performance

### Optimisations
- **Téléchargement asynchrone** : Non-bloquant
- **Gestion mémoire** : Streams pour les gros fichiers
- **Logs rotatifs** : Évite la saturation disque
- **Cache intelligent** : Réutilisation des données

## 🔧 Maintenance

### Tâches Régulières
- **Nettoyage des logs** : Suppression des anciens fichiers
- **Vérification espace** : Contrôle de l'espace disque
- **Backup des données** : Sauvegarde des photos importantes
- **Mise à jour dépendances** : Sécurité et performances

## 📞 Support

Pour toute question ou problème :
1. Vérifiez les logs dans `bot/logs/`
2. Consultez la documentation
3. Contactez l'équipe de développement

---

**LR ASSIST Bot** - Sécurité ferroviaire intelligente 🚦 