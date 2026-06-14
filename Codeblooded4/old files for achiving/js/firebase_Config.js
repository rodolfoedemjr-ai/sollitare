// 🛸 FIXED MODULE SPECIFIERS FOR RAW BROWSERS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your verified web app's Firebase configuration keys
const firebaseConfig = {
  apiKey: "AIzaSyBkmUL_E9cjFDxZ01u5b0MDz5CoiqulpGQ",
  authDomain: "codequest-150bb.firebaseapp.com",
  projectId: "codequest-150bb",
  storageBucket: "codequest-150bb.firebasestorage.app", // Verified CDN bucket pointer
  messagingSenderId: "724177495370",
  appId: "1:724177495370:web:80f41b1a4fcf82304d0db3",
  measurementId: "G-LJ51BY3DK0"
};

// Initialize Firebase Core System
const app = initializeApp(firebaseConfig);

// 🚀 CRITICAL MODULE INTERFACE EXPORTS FOR MAIN.JS
export const db = getFirestore(app);
export const storage = getStorage(app);
