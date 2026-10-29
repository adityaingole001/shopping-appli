import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCYYc7OhRcPqbsjXifof7ym1l9_yJ-mtKg",
  authDomain: "shopping-app-d48c9.firebaseapp.com",
  projectId: "shopping-app-d48c9",
  storageBucket: "shopping-app-d48c9.firebasestorage.app",
  messagingSenderId: "545733736401",
  appId: "1:545733736401:web:a298bb236be342c393d2f0",
  measurementId: "G-6HPPCNJK1F"
};
export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = isFirebaseConfigured
  ? getApps()[0] || initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = app ? getAuth(app) : null;
export const firebaseApp = app;
