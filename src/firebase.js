// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDF5_xzcBRS0XdhJTXwMm3ASG1cuu9wkXI",
  authDomain: "kerala-set.firebaseapp.com",
  projectId: "kerala-set",
  storageBucket: "kerala-set.firebasestorage.app",
  messagingSenderId: "983491686758",
  appId: "1:983491686758:web:ecc54a9c8c16c30b2e18a7"
};

const app = initializeApp(firebaseConfig);

export const auth     = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db       = getFirestore(app);
export const storage  = getStorage(app);