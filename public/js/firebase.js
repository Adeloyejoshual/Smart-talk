<!-- Load Firebase SDKs in each page -->
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
  import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "{{FIREBASE_API_KEY}}",
    authDomain: "{{FIREBASE_AUTH_DOMAIN}}",
    projectId: "{{FIREBASE_PROJECT_ID}}",
    storageBucket: "{{FIREBASE_STORAGE_BUCKET}}",
    messagingSenderId: "{{FIREBASE_MESSAGING_SENDER_ID}}",
    appId: "{{FIREBASE_APP_ID}}"
  };

  window.firebaseApp = initializeApp(firebaseConfig);
  window.firebaseAuth = getAuth(firebaseApp);
</script>