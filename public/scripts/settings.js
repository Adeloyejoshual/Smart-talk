/* =========================
   SmartTalk Settings JS
   ========================= */

/** ---------- CONFIG ---------- **/
const DEFAULTS = {
  darkMode: localStorage.getItem("darkMode") ?? "system", // "on" | "off" | "system"
  notificationSound: localStorage.getItem("notificationSound") || "sound01.mp3",
  notificationSoundKind: localStorage.getItem("notificationSoundKind") || "builtin", // "builtin" | "custom"
  notificationCustomUrl: localStorage.getItem("notificationCustomUrl") || "",
  username: localStorage.getItem("username") || "",
};

const BUILTIN_SOUNDS = [
  "sound01.mp3","sound02.mp3","sound03.mp3","sound04.mp3","sound05.mp3",
  "sound06.mp3","sound07.mp3","sound08.mp3","sound09.mp3","sound10.mp3",
  "sound11.mp3","sound12.mp3","sound13.mp3","sound14.mp3","sound15.mp3",
  "sound16.mp3","sound17.mp3","sound18.mp3","sound19.mp3","sound20.mp3",
];

// Path where your built-in MP3s live
const SOUND_BASE = "/sounds/";

// Utility: safely get element
const $ = (id) => document.getElementById(id);

/** ---------- DARK MODE ---------- **/
function applyDarkMode(mode) {
  // mode: "on" | "off" | "system"
  const root = document.documentElement;
  root.classList.remove("dark");
  if (mode === "on") root.classList.add("dark");
  if (mode === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) root.classList.add("dark");
  }
}

function initDarkMode() {
  const toggle = $("darkModeToggle");        // checkbox (on/off)
  const systemBtn = $("darkModeSystemBtn");  // optional "Use system" button

  // Set initial state
  applyDarkMode(DEFAULTS.darkMode);
  if (toggle) toggle.checked = DEFAULTS.darkMode === "on";

  // Handlers
  if (toggle) {
    toggle.addEventListener("change", () => {
      const mode = toggle.checked ? "on" : "off";
      localStorage.setItem("darkMode", mode);
      applyDarkMode(mode);
    });
  }
  if (systemBtn) {
    systemBtn.addEventListener("click", () => {
      localStorage.setItem("darkMode", "system");
      applyDarkMode("system");
      if (toggle) toggle.checked = false;
    });
  }

  // React to OS changes when in system mode
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (localStorage.getItem("darkMode") === "system") applyDarkMode("system");
  });
}

/** ---------- APP VERSION ---------- **/
async function loadAppVersion() {
  const el = $("appVersion");
  if (!el) return;
  try {
    const res = await fetch("/api/app/version");
    const data = await res.json();
    el.textContent = `${data.version || "v?"} (Built: ${data.buildDate || "—"})`;
  } catch {
    el.textContent = "Unknown";
  }
}

/** ---------- TERMS & PRIVACY ---------- **/
function initLegalLinks() {
  const termsLink = $("termsLink");
  const privacyLink = $("privacyLink");
  if (termsLink) termsLink.addEventListener("click", () => window.open("/terms.html", "_blank"));
  if (privacyLink) privacyLink.addEventListener("click", () => window.open("/privacy.html", "_blank"));
}

/** ---------- NOTIFICATION SOUNDS ---------- **/
let notificationAudio = null;

function getCurrentSoundSrc() {
  const kind = localStorage.getItem("notificationSoundKind") || DEFAULTS.notificationSoundKind;
  if (kind === "custom") {
    return localStorage.getItem("notificationCustomUrl") || DEFAULTS.notificationCustomUrl || "";
  }
  const file = localStorage.getItem("notificationSound") || DEFAULTS.notificationSound;
  return SOUND_BASE + file;
}

function buildSoundOptions() {
  const sel = $("notificationSound");
  if (!sel) return;

  // Clear existing
  sel.innerHTML = "";

  // Built-in group
  const groupBuiltin = document.createElement("optgroup");
  groupBuiltin.label = "Built-in";
  BUILTIN_SOUNDS.forEach((file, idx) => {
    const opt = document.createElement("option");
    opt.value = file;
    opt.textContent = `Sound ${String(idx + 1).padStart(2, "0")}`;
    groupBuiltin.appendChild(opt);
  });
  sel.appendChild(groupBuiltin);

  // Custom (placeholder shown when a custom is active)
  const customGroup = document.createElement("optgroup");
  customGroup.label = "Custom";
  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "Your uploaded sound";
  customGroup.appendChild(customOpt);
  sel.appendChild(customGroup);

  // Set selected
  const kind = localStorage.getItem("notificationSoundKind") || DEFAULTS.notificationSoundKind;
  if (kind === "custom") {
    sel.value = "__custom__";
  } else {
    sel.value = localStorage.getItem("notificationSound") || DEFAULTS.notificationSound;
  }
}

function initNotificationSounds() {
  buildSoundOptions();

  notificationAudio = new Audio(getCurrentSoundSrc());
  notificationAudio.preload = "auto";

  const select = $("notificationSound");
  const previewBtn = $("previewSound");
  const uploadInput = $("customSoundInput");
  const useCustomBtn = $("useCustomBtn");
  const clearCustomBtn = $("clearCustomBtn");

  if (select) {
    select.addEventListener("change", (e) => {
      const value = e.target.value;
      if (value === "__custom__") {
        // Switch to custom (if already uploaded)
        const url = localStorage.getItem("notificationCustomUrl");
        if (!url) {
          alert("Upload a custom sound first.");
          // revert to previously saved built-in
          buildSoundOptions();
          return;
        }
        localStorage.setItem("notificationSoundKind", "custom");
      } else {
        localStorage.setItem("notificationSoundKind", "builtin");
        localStorage.setItem("notificationSound", value);
      }
      notificationAudio.src = getCurrentSoundSrc();
    });
  }

  if (previewBtn) {
    previewBtn.addEventListener("click", async () => {
      try {
        notificationAudio.currentTime = 0;
        await notificationAudio.play();
      } catch (err) {
        console.log("Audio play blocked:", err);
      }
    });
  }

  if (uploadInput) {
    uploadInput.addEventListener("change", () => {
      const file = uploadInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      localStorage.setItem("notificationCustomUrl", url);
      // If user wants to immediately use it:
      if ($("useCustomOnUpload")?.checked) {
        localStorage.setItem("notificationSoundKind", "custom");
        if ($("notificationSound")) $("notificationSound").value = "__custom__";
        notificationAudio.src = url;
      }
    });
  }

  if (useCustomBtn) {
    useCustomBtn.addEventListener("click", () => {
      const url = localStorage.getItem("notificationCustomUrl");
      if (!url) return alert("Upload a custom MP3/WAV first.");
      localStorage.setItem("notificationSoundKind", "custom");
      if ($("notificationSound")) $("notificationSound").value = "__custom__";
      notificationAudio.src = url;
    });
  }

  if (clearCustomBtn) {
    clearCustomBtn.addEventListener("click", () => {
      const hadUrl = !!localStorage.getItem("notificationCustomUrl");
      localStorage.removeItem("notificationCustomUrl");
      if (hadUrl) URL.revokeObjectURL(notificationAudio?.src);
      // Fall back to built-in default
      localStorage.setItem("notificationSoundKind", "builtin");
      localStorage.setItem("notificationSound", DEFAULTS.notificationSound);
      buildSoundOptions();
      notificationAudio.src = getCurrentSoundSrc();
    });
  }
}

// Call this whenever you need to play the current notification sound (e.g., on new message)
export async function playNotificationSound() {
  try {
    if (!notificationAudio) {
      notificationAudio = new Audio(getCurrentSoundSrc());
      notificationAudio.preload = "auto";
    }
    notificationAudio.currentTime = 0;
    await notificationAudio.play();
  } catch (e) {
    console.log("Notification sound blocked until user interacts with the page.", e);
  }
}

/** ---------- USERNAME ---------- **/
function initUsername() {
  const input = $("usernameInput");
  const saveBtn = $("saveUsernameBtn");

  // Prefill
  if (input) input.value = DEFAULTS.username;

  // Save handler
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const newName = (input?.value || "").trim();
      if (!newName) return alert("Username cannot be empty.");
      // Save locally
      localStorage.setItem("username", newName);
      // Update everywhere (elements that have .username-display)
      document.querySelectorAll(".username-display").forEach((el) => (el.textContent = newName));
      // Optionally call backend
      try {
        await fetch("/api/users/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("token") || "") },
          body: JSON.stringify({ username: newName }),
        });
      } catch (e) {
        console.log("Backend username update failed (will keep local):", e);
      }
      alert("Username updated!");
    });
  }
}

/** ---------- INVITE / SHARE ---------- **/
function initInvite() {
  const btn = $("inviteBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const shareData = {
      title: "SmartTalk",
      text: "Join me on SmartTalk!",
      url: window.location.origin,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (e) {
        console.log("Share cancelled:", e);
      }
    } else {
      // Fallback
      const link = `${window.location.origin}`;
      try {
        await navigator.clipboard.writeText(link);
        alert("Invite link copied to clipboard!");
      } catch {
        alert("Copy this invite link: " + link);
      }
    }
  });
}

/** ---------- INIT ALL ---------- **/
function initSettings() {
  initDarkMode();
  loadAppVersion();
  initLegalLinks();
  initNotificationSounds();
  initUsername();
  initInvite();

  // If you have any toggles from Privacy (online status, typing, etc.) wire them here similarly:
  // $("onlineStatusToggle")?.addEventListener("change", (e) => { ... PUT /api/users/settings ... });
}

document.addEventListener("DOMContentLoaded", initSettings);