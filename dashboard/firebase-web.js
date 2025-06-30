// Import des fonctions Firebase Web SDK (modules ES6 depuis CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-analytics.js";

// Configuration Firebase Web
const firebaseConfig = {
  apiKey: "AIzaSyBaLqDMtsMftn9TNqvvkVzMq2SQOKWk91w",
  authDomain: "telegramlr.firebaseapp.com",
  projectId: "telegramlr",
  storageBucket: "telegramlr.appspot.com", // Correction du domaine
  messagingSenderId: "837576034513",
  appId: "1:837576034513:web:a247408ca10ce3a1e49df0",
  measurementId: "G-6DW7KPLJBR"
};

// Initialisation Firebase Web
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); 