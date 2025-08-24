// settings.js

const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

// ✅ Elements
const settingsContainer = document.getElementById("settings-container");

// ----------------- USER DATA -----------------
async function fetchUserProfile() {
  try {
    const res = await fetch("/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    document.getElementById("profile-name").innerText = data.name;
    document.getElementById("profile-phone").innerText = data.phone;
    document.getElementById("profile-about").innerText = data.about || "Hey there! I am using SmartTalk.";
    document.getElementById("wallet-balance").innerText = `$${data.walletBalance || 0}`;
  } catch (err) {
    console.error("Profile fetch error:", err);
  }
}
fetchUserProfile();

// ----------------- WALLET -----------------
async function fetchWallet() {
  try {
    const res = await fetch("/api/wallet", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    document.getElementById("wallet-balance").innerText = `$${data.balance}`;
    const txList = document.getElementById("wallet-transactions");
    txList.innerHTML = "";
    data.transactions.forEach(tx => {
      const li = document.createElement("li");
      li.innerText = `${tx.type}: $${tx.amount} (${new Date(tx.date).toLocaleString()})`;
      txList.appendChild(li);
    });
  } catch (err) {
    console.error("Wallet fetch error:", err);
  }
}
fetchWallet();

// ----------------- CHAT -----------------
function clearAllChats() {
  if (confirm("Are you sure you want to clear all chats?")) {
    localStorage.removeItem("chats"); 
    alert("All chats cleared!");
  }
}

// ----------------- NOTIFICATIONS -----------------
const builtInSounds = [
  "sound1.mp3","sound2.mp3","sound3.mp3","sound4.mp3","sound5.mp3",
  "sound6.mp3","sound7.mp3","sound8.mp3","sound9.mp3","sound10.mp3",
  "sound11.mp3","sound12.mp3","sound13.mp3","sound14.mp3","sound15.mp3",
  "sound16.mp3","sound17.mp3","sound18.mp3","sound19.mp3","sound20.mp3"
];

const soundSelect = document.getElementById("notification-sounds");
builtInSounds.forEach((s, i) => {
  let option = document.createElement("option");
  option.value = s;
  option.innerText = `Sound ${i+1}`;
  soundSelect.appendChild(option);
});

// Preview sound
function playSound(soundFile) {
  let audio = new Audio(`/sounds/${soundFile}`);
  audio.play();
}
soundSelect.addEventListener("change", e => {
  playSound(e.target.value);
  localStorage.setItem("notificationSound", e.target.value);
});

// Custom user music
const customSoundInput = document.getElementById("custom-sound");
customSoundInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    localStorage.setItem("customNotificationSound", url);
    let audio = new Audio(url);
    audio.play();
  }
});

// Vibration toggle
document.getElementById("vibration-toggle").addEventListener("change", e => {
  localStorage.setItem("vibrationEnabled", e.target.checked);
});

// ----------------- STORAGE & DATA -----------------
function calculateStorageUsage() {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += ((localStorage[key].length * 2) / 1024 / 1024); // MB
    }
  }
  document.getElementById("storage-usage").innerText = total.toFixed(2) + " MB";
}
calculateStorageUsage();

// ----------------- PRIVACY -----------------
document.getElementById("last-seen-toggle").addEventListener("change", e => {
  localStorage.setItem("lastSeenVisible", e.target.checked);
});
document.getElementById("two-step-toggle").addEventListener("change", e => {
  localStorage.setItem("twoStepEnabled", e.target.checked);
});

// ----------------- LANGUAGE -----------------
const languageSelect = document.getElementById("language-select");
languageSelect.addEventListener("change", e => {
  localStorage.setItem("preferredLanguage", e.target.value);
});

// ----------------- HELP -----------------
document.getElementById("contact-support").addEventListener("click", () => {
  window.location.href = "mailto:support@smarttalk.com";
});

// ----------------- LOGOUT -----------------
document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "/login.html";
});