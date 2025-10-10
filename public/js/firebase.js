<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
  import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } 
    from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
  import { getFirestore, collection, addDoc, onSnapshot, doc, setDoc } 
    from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
  import { getStorage } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";

  const firebaseConfig = {
    apiKey: "{{FIREBASE_API_KEY}}",
    authDomain: "{{FIREBASE_AUTH_DOMAIN}}",
    projectId: "{{FIREBASE_PROJECT_ID}}",
    storageBucket: "{{FIREBASE_STORAGE_BUCKET}}",
    messagingSenderId: "{{FIREBASE_MESSAGING_SENDER_ID}}",
    appId: "{{FIREBASE_APP_ID}}"
  };

  const app = initializeApp(firebaseConfig);
  export const auth = getAuth(app);
  export const db = getFirestore(app);
  export const storage = getStorage(app);
</script>