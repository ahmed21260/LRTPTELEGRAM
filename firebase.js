const admin = require('firebase-admin');
const config = require('./config');

// Initialize Firebase Admin
let firebaseApp;

function initializeFirebase() {
  if (firebaseApp) return firebaseApp;

  try {
    // Check if Firebase credentials are available
    if (config.firebase.privateKey && config.firebase.clientEmail) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebase.projectId,
          privateKeyId: config.firebase.privateKeyId,
          privateKey: config.firebase.privateKey,
          clientEmail: config.firebase.clientEmail,
          clientId: config.firebase.clientId,
          authUri: config.firebase.authUri,
          tokenUri: config.firebase.tokenUri,
          authProviderX509CertUrl: config.firebase.authProviderX509CertUrl,
          clientX509CertUrl: config.firebase.clientX509CertUrl
        }),
        storageBucket: `${config.firebase.projectId}.appspot.com`
      });
    } else {
      // Use default credentials (for local development)
      firebaseApp = admin.initializeApp({
        projectId: config.firebase.projectId,
        storageBucket: `${config.firebase.projectId}.appspot.com`
      });
    }

    console.log('✅ Firebase Admin initialisé avec succès');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error.message);
    return null;
  }
}

// Firestore operations
class FirestoreService {
  constructor() {
    this.db = admin.firestore();
  }

  // Save message to Firestore
  async saveMessage(messageData) {
    try {
      const docRef = await this.db.collection('messages').add({
        ...messageData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Message sauvegardé dans Firestore: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Erreur sauvegarde message:', error);
      throw error;
    }
  }

  // Save photo metadata
  async savePhoto(photoData) {
    try {
      const docRef = await this.db.collection('photos').add({
        ...photoData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Photo sauvegardée dans Firestore: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Erreur sauvegarde photo:', error);
      throw error;
    }
  }

  // Save location with PK calculation
  async saveLocation(locationData) {
    try {
      const docRef = await this.db.collection('locations').add({
        ...locationData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Localisation sauvegardée dans Firestore: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Erreur sauvegarde localisation:', error);
      throw error;
    }
  }

  // Get messages with filters
  async getMessages(filters = {}) {
    try {
      let query = this.db.collection('messages').orderBy('createdAt', 'desc');
      
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      if (filters.type) {
        query = query.where('type', '==', filters.type);
      }
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ Erreur récupération messages:', error);
      throw error;
    }
  }

  // Get photos with filters
  async getPhotos(filters = {}) {
    try {
      let query = this.db.collection('photos').orderBy('createdAt', 'desc');
      
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ Erreur récupération photos:', error);
      throw error;
    }
  }

  // Get locations with filters
  async getLocations(filters = {}) {
    try {
      let query = this.db.collection('locations').orderBy('createdAt', 'desc');
      
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ Erreur récupération localisations:', error);
      throw error;
    }
  }

  // Sauvegarde le ping d'un opérateur (avec position)
  async savePing({ userId, userName, timestamp, latitude, longitude }) {
    const ref = this.db.collection('operators').doc(userId);
    await ref.set({
      userId,
      userName,
      lastPing: timestamp,
      latitude,
      longitude
    }, { merge: true });
  }

  // Récupère tous les opérateurs avec leur statut en ligne
  async getOperatorsWithStatus() {
    const snapshot = await this.db.collection('operators').get();
    const now = Date.now();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        userId: data.userId,
        userName: data.userName,
        lastPing: data.lastPing,
        online: data.lastPing && (now - data.lastPing < 2 * 60 * 1000) // 2 min de tolérance
      };
    });
  }
}

// Firebase Storage operations
class StorageService {
  constructor() {
    this.bucket = admin.storage().bucket();
  }

  // Upload photo to Firebase Storage
  async uploadPhoto(filePath, destination, metadata = {}) {
    try {
      const [file] = await this.bucket.upload(filePath, {
        destination: `photos/${destination}`,
        metadata: {
          ...metadata,
          contentType: 'image/jpeg'
        }
      });

      // Make file publicly readable
      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${file.name}`;
      console.log(`✅ Photo uploadée vers Firebase Storage: ${publicUrl}`);
      
      return {
        url: publicUrl,
        path: file.name,
        size: file.metadata.size
      };
    } catch (error) {
      console.error('❌ Erreur upload photo:', error);
      throw error;
    }
  }

  // Delete photo from Firebase Storage
  async deletePhoto(filePath) {
    try {
      await this.bucket.file(filePath).delete();
      console.log(`✅ Photo supprimée de Firebase Storage: ${filePath}`);
    } catch (error) {
      console.error('❌ Erreur suppression photo:', error);
      throw error;
    }
  }
}

module.exports = {
  initializeFirebase,
  FirestoreService,
  StorageService
}; 