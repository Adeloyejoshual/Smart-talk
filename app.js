import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBe2QkeEr9sfh0TUtj8Np-mU5WtYYOorYY",
  authDomain: "smarttalk-9fe4a.firebaseapp.com",
  projectId: "smarttalk-9fe4a",
  storageBucket: "smarttalk-9fe4a.firebasestorage.app",
  messagingSenderId: "103759612273",
  appId: "1:103759612273:web:311d39bf7af9d51fe30ed0",
  measurementId: "G-XD4MY1XF7E"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, db, provider };