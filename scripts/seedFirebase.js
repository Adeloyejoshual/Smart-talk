// /scripts/seedFirebase.js

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection } from "firebase/firestore";
import { getDatabase, ref, set } from "firebase/database";
import { serverTimestamp } from "firebase/firestore";

// ⚠️ Load environment variables (if using Node.js + dotenv)
import dotenv from "dotenv";
dotenv.config();

// ----------------------------------
// 🔥 Firebase Config
// ----------------------------------
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL, // Required for Realtime DB
};

// ----------------------------------
// 🔥 Initialize Firebase
// ----------------------------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// ----------------------------------
// 🧩 Sample Data
// ----------------------------------
const users = [
  {
    uid: "user_1",
    name: "Ayo Johnson",
    email: "ayo@test.com",
    photoURL: "https://i.pravatar.cc/150?img=11",
    lastSeen: serverTimestamp(),
    createdAt: serverTimestamp(),
    isOnline: true,
    walletBalance: 120.5,
    settings: {
      theme: "light",
      notifications: true,
      pinDuration: "30d",
    },
  },
  {
    uid: "user_2",
    name: "Zara Bello",
    email: "zara@test.com",
    photoURL: "https://i.pravatar.cc/150?img=12",
    lastSeen: serverTimestamp(),
    createdAt: serverTimestamp(),
    isOnline: false,
    walletBalance: 540.25,
    settings: {
      theme: "dark",
      notifications: true,
      pinDuration: "7d",
    },
  },
];

const chat = {
  id: "chat_1",
  isGroup: false,
  participants: ["user_1", "user_2"],
  lastMessage: {
    text: "Hey, how are you?",
    senderId: "user_1",
    timestamp: new Date().toISOString(),
    type: "text",
  },
  lastMessageTime: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const messages = [
  {
    id: "msg_1",
    senderId: "user_1",
    receiverId: "user_2",
    text: "Hey, how are you?",
    timestamp: new Date().toISOString(),
    type: "text",
    seenBy: [],
    deletedFor: [],
    pinned: { isPinned: false, expiresAt: null },
    media: null,
  },
  {
    id: "msg_2",
    senderId: "user_2",
    receiverId: "user_1",
    text: "I'm good! Working on the new project.",
    timestamp: new Date().toISOString(),
    type: "text",
    seenBy: [],
    deletedFor: [],
    pinned: { isPinned: false, expiresAt: null },
    media: null,
  },
];

// ----------------------------------
// 🚀 Seeding Function
// ----------------------------------
async function seedFirebase() {
  console.log("🌱 Starting Firestore seed...");

  // Create users
  for (const u of users) {
    await setDoc(doc(db, "users", u.uid), u);
    console.log(`✅ User created: ${u.name}`);
  }

  // Create chat
  await setDoc(doc(db, "chats", chat.id), chat);
  console.log(`✅ Chat created: ${chat.id}`);

  // Add messages
  for (const m of messages) {
    await setDoc(doc(collection(db, "chats", chat.id, "messages"), m.id), m);
    console.log(`💬 Message added: ${m.text}`);
  }

  // Realtime presence simulation
  await set(ref(rtdb, `status/user_1`), {
    state: "online",
    lastChanged: Date.now(),
  });
  await set(ref(rtdb, `status/user_2`), {
    state: "offline",
    lastChanged: Date.now(),
  });

  console.log("✅ Realtime DB presence added");
  console.log("🎉 Firebase seed complete!");
  process.exit(0);
}

seedFirebase().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});