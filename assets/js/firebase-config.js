import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getDatabase, ref, set, get, child, update, remove, onValue } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyANw780jiLzW9I5CR1tN8yFq8nuQs-m--o",
    authDomain: "intelligo-6c28f.firebaseapp.com",
    projectId: "intelligo-6c28f",
    storageBucket: "intelligo-6c28f.firebasestorage.app",
    messagingSenderId: "1016636503406",
    appId: "1:1016636503406:web:360bbe54e771794c3afd7f",
    databaseURL: "https://intelligo-6c28f-default-rtdb.firebaseio.com"
};

import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export { app, database, ref, set, get, child, update, remove, onValue, auth, signInWithEmailAndPassword, onAuthStateChanged, signOut };
