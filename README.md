# 🚦 LR ASSIST - Bot Telegram Ferroviaire Avancé

## 📋 Description

**LR ASSIST** est un bot Telegram innovant conçu spécifiquement pour les **opérateurs ferroviaires**, **conducteurs de pelles rail-route** et **entreprises de travaux ferroviaires**. 

### 🎯 Fonctionnalités Principales

- 📍 **Géolocalisation précise** avec calcul automatique du Point Kilométrique (PK) SNCF
- 🚪 **Portails d'accès SNCF intelligents** avec détection automatique
- 🚨 **Système d'urgence avancé** pour situations critiques
- 📸 **Gestion photos chantier** avec métadonnées géolocalisées
- ✅ **Checklists de sécurité** adaptées aux chantiers ferroviaires
- 📊 **Rapports chantier** automatiques
- 🔧 **Compatibilité équipements** : CAT M323F, pelles rail-route, OCP

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 16+ 
- npm ou yarn
- Compte Telegram avec bot token

### Installation

```bash
# Cloner le projet
git clone [url-du-projet]
cd TELEGR

# Installer les dépendances
npm install

# Installer PM2 (gestionnaire de processus)
npm run install-pm2
```

### Configuration

1. **Configurer le token Telegram** dans `start.js` :
```javascript
const config = {
  telegram: {
    token: 'VOTRE_TOKEN_BOT',
    adminChatId: VOTRE_ID_ADMIN
  }
};
```

2. **Créer les dossiers nécessaires** :
```bash
mkdir -p data/photos logs
```

### Démarrage

#### Mode Développement
```bash
npm run start-simple
```

#### Mode Production (Recommandé)
```bash
# Démarrer avec PM2
npm run prod

# Voir les logs
npm run logs

# Voir le statut
npm run status

# Redémarrer
npm run restart

# Arrêter
npm run stop
```

## 📱 Utilisation

### Menu Principal
Le bot propose un menu intuitif avec les options suivantes :

- **📸 Photo chantier** : Envoyer des photos géolocalisées
- **📍 Position GPS** : Partager sa position avec calcul PK SNCF
- **🚨 Urgence chantier** : Déclencher une alerte d'urgence
- **🚪 Portail accès** : Trouver le portail d'accès SNCF le plus proche
- **✅ Checklist sécurité** : Procédures de sécurité ferroviaire
- **🔧 Équipement** : Gestion des équipements (CAT M323F, etc.)
- **📊 Rapport chantier** : Générer des rapports d'activité
- **📘 Fiches techniques** : Documentation technique
- **🗺️ Carte chantier** : Visualiser la position sur Geoportail
- **⚙️ Paramètres** : Configuration du bot

### Fonctionnalités Avancées

#### 🚪 Portails d'Accès SNCF
Le système détecte automatiquement les portails d'accès SNCF les plus proches avec :
- **Types de portails** : Passage piéton, portail technique, accès chantier, passage d'inspection
- **Informations détaillées** : Équipements, restrictions, contacts d'urgence
- **Géolocalisation précise** : Distance, direction, statut
- **Intégration Geoportail** : Liens directs vers les cartes

#### 🚨 Système d'Urgence
- **Alerte immédiate** aux administrateurs
- **Procédures d'urgence** automatiques
- **Localisation précise** avec PK SNCF
- **Contacts d'urgence** intégrés
- **Évacuation guidée** vers portails d'accès

#### 📸 Gestion Photos Chantier
- **Géolocalisation automatique** avec PK SNCF
- **Métadonnées enrichies** (heure, position, ligne)
- **Stockage local sécurisé**
- **Analyse automatique** des photos
- **Intégration rapports**

## 🔧 Compatibilité Équipements

### CAT M323F Rail-Route
- ✅ **Emprise ferroviaire validée**
- 🔧 **Équipements** : rototilt, benne preneuse, remorque
- 🔒 **Sécurisation** : signalisation, vérification OCP
- 📍 **Géolocalisation** : Position avant intervention

### Autres Équipements
- 🚧 **Pelles rail-route** diverses
- 🚦 **Équipements de signalisation**
- 🛡️ **Équipements de sécurité**
- 📋 **Outils de contrôle**

## 📊 Rapports et Données

### Données Collectées
- 📍 **Positions GPS** avec PK SNCF
- 📸 **Photos chantier** géolocalisées
- 🚨 **Alertes d'urgence** et incidents
- ✅ **Checklists sécurité** complétées
- 📊 **Activités chantier** détaillées

### Stockage
- 💾 **Stockage local** sécurisé
- 📁 **Organisation** par utilisateur et date
- 🔒 **Sauvegarde** automatique
- 📋 **Export** possible des données

## 🚨 Sécurité et Conformité

### Procédures de Sécurité
1. **Vérifier position train** avant intervention
2. **Contacter chef chantier** pour autorisation
3. **Activer signalisations** appropriées
4. **Bloquer circulation voie** si nécessaire
5. **Vérifier équipement** avant utilisation
6. **Confirmer mise hors voie** en fin d'intervention

### Contacts d'Urgence
- 🚨 **Urgence générale** : 112
- 🚦 **SNCF** : 3635
- 👷 **Chef chantier** : [Numéro local]
- 🔧 **Maintenance** : [Numéro local]

## 📋 Commandes Utiles

```bash
# Démarrer en production
npm run prod

# Voir les logs
npm run logs

# Voir le statut
npm run status

# Redémarrer le bot
npm run restart

# Arrêter le bot
npm run stop

# Tester les portails d'accès
npm run test-portals

# Tester toutes les fonctionnalités
npm run test-all
```

## 🛠️ Maintenance

### Logs
Les logs sont disponibles dans le dossier `./logs/` :
- `err.log` : Erreurs
- `out.log` : Sortie standard
- `combined.log` : Logs combinés

### Surveillance
PM2 surveille automatiquement le bot :
- **Redémarrage automatique** en cas de crash
- **Surveillance mémoire** (limite 1GB)
- **Logs horodatés** détaillés
- **Statut en temps réel**

## 🚀 Déploiement

### Serveur Local
```bash
npm run prod
```

### Serveur Distant
1. **Transférer les fichiers** sur le serveur
2. **Installer Node.js** et PM2
3. **Configurer le token** Telegram
4. **Démarrer avec PM2** : `npm run prod`

## 📞 Support

Pour toute question ou problème :
- 📧 **Email** : [support@lr-assist.com]
- 📱 **Telegram** : [@lr_assist_support]
- 📋 **Documentation** : [lien-documentation]

## 🔄 Mises à Jour

Le bot est conçu pour être facilement mis à jour :
- **Sauvegarde automatique** des données
- **Migration transparente** des configurations
- **Compatibilité ascendante** maintenue

---

**🚦 LR ASSIST - L'innovation au service de la sécurité ferroviaire** 