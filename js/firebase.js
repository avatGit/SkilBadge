// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB53i4X_XLrkPuT37OnGR5OBkkIcyhoh1c",
  authDomain: "skillbadge-25993.firebaseapp.com",
  databaseURL: "https://skillbadge-25993-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "skillbadge-25993",
  storageBucket: "skillbadge-25993.firebasestorage.app",
  messagingSenderId: "421829753154",
  appId: "1:421829753154:web:a3de783f3848af9d0c70db"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

export default app;