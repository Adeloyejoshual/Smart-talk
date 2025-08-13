/* =========================
   SmartTalk Settings JS (Live Sync)
   ========================= */

const DEFAULTS = {
  darkMode: localStorage.getItem("darkMode") ?? "system",
  notificationEnabled: localStorage.getItem("notificationEnabled") === "true", 
  notificationSound: localStorage.getItem("notificationSound") || "sound01.mp3",
  notificationSoundKind: localStorage.getItem("notificationSoundKind") || "builtin",
  notificationCustomUrl: localStorage.getItem("notificationCustomUrl") || "",
  username: localStorage.getItem("username") || "",
  fontSize: localStorage.getItem("fontSize") || "medium"
};

const BUILTIN_SOUNDS = [
  "sound01.mp3","sound02.mp3","sound03.mp3","sound04.mp3","sound05.mp3",
  "sound06.mp3","sound07.mp3","sound08.mp3","sound09.mp3","sound10.mp3",
  "sound11.mp3","sound12.mp3","sound13.mp3","sound14.mp3","sound15.mp3",
  "sound16.mp3","sound17.mp3","sound18.mp3","sound19.mp3","sound20.mp3",
];

const SOUND_BASE = "/sounds/";
const $ = (id) => document.getElementById(id);

/* ---------- Helpers ---------- */
function triggerSettingsUpdate() {
  // Tell other scripts in this page
  window.dispatchEvent(new Event("settingsUpdated"));
  // Sync with other tabs/windows
  localStorage.setItem("settingsUpdatedAt", Date.now().toString());
}

/* ---------- DARK MODE ---------- */
function applyDarkMode(mode) {
  const root = document.documentElement;
  root.classList.remove("dark");
  if (mode === "on") root.classList.add("dark");
  if (mode === "system") {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    }
  }
}

function initDarkMode() {
  const toggle = $("darkModeToggle");
  const systemBtn = $("darkModeSystemBtn");

  applyDarkMode(DEFAULTS.darkMode);
  if (toggle) toggle.checked = DEFAULTS.darkMode === "on";

  toggle?.addEventListener("change", () => {
    const mode = toggle.checked ? "on" : "off";
    localStorage.setItem("darkMode", mode);
    applyDarkMode(mode);
    triggerSettingsUpdate();
  });

  systemBtn?.addEventListener("click", () => {
    localStorage.setItem("darkMode", "system");
    applyDarkMode("system");
    if (toggle) toggle.checked = false;
    triggerSettingsUpdate();
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (localStorage.getItem("darkMode") === "system") {
      applyDarkMode("system");
      triggerSettingsUpdate();
    }
  });
}

/* ---------- FONT SIZE ---------- */
function applyFontSize(size) {
  document.body.style.fontSize = size === "small" ? "14px" :
                                 size === "large" ? "18px" : "16px";
}

function initFontSize() {
  const select = $("fontSizeSelect");
  if (select) {
    select.value = DEFAULTS.fontSize;
    applyFontSize(DEFAULTS.fontSize);
    select.addEventListener("change", () => {
      const value = select.value;
      localStorage.setItem("fontSize", value);
      applyFontSize(value);
      triggerSettingsUpdate();
    });
  }
}

/* ---------- NOTIFICATION ENABLE TOGGLE ---------- */
function initNotificationToggle() {
  const toggle = $("notificationToggle");
  if (toggle) {
    toggle.checked = DEFAULTS.notificationEnabled;
    toggle.addEventListener("change", () => {
      localStorage.setItem("notificationEnabled", toggle.checked);
      triggerSettingsUpdate();
    });
  }
}

/* ---------- SOUND OPTIONS ---------- */
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

  sel.innerHTML = "";

  const groupBuiltin = document.createElement("optgroup");
  groupBuiltin.label = "Built-in";
  BUILTIN_SOUNDS.forEach((file, idx) => {
    const opt = document.createElement("option");
    opt.value = file;
    opt.textContent = `Sound ${String(idx + 1).padStart(2, "0")}`;
    groupBuiltin.appendChild(opt);
  });
  sel.appendChild(groupBuiltin);

  const customGroup = document.createElement("optgroup");
  customGroup.label = "Custom";
  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "Your uploaded sound";
  customGroup.appendChild(customOpt);
  sel.appendChild(customGroup);

  const kind = localStorage.getItem("notificationSoundKind") || DEFAULTS.notificationSoundKind;
  sel.value = kind === "custom" ? "__custom__" :
              localStorage.getItem("notificationSound") || DEFAULTS.notificationSound;
}

function initNotificationSounds() {
  buildSoundOptions();

  notificationAudio = new Audio(getCurrentSoundSrc());
  notificationAudio.preload = "auto";

  const select = $("notificationSound");
  const previewBtn = $("previewSound");
  const uploadInput = $("customSoundInput");

  select?.addEventListener("change", (e) => {
    const value = e.target.value;
    if (value === "__custom__") {
      const url = localStorage.getItem("notificationCustomUrl");
      if (!url) {
        alert("Upload a custom sound first.");
        buildSoundOptions();
        return;
      }
      localStorage.setItem("notificationSoundKind", "custom");
    } else {
      localStorage.setItem("notificationSoundKind", "builtin");
      localStorage.setItem("notificationSound", value);
    }
    notificationAudio.src = getCurrentSoundSrc();
    triggerSettingsUpdate();
  });

  previewBtn?.addEventListener("click", async () => {
    try {
      notificationAudio.currentTime = 0;
      await notificationAudio.play();
    } catch (err) {
      console.log("Audio play blocked:", err);
    }
  });

  uploadInput?.addEventListener("change", () => {
    const file = uploadInput.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    localStorage.setItem("notificationCustomUrl", url);
    localStorage.setItem("notificationSoundKind", "custom");
    $("notificationSound").value = "__custom__";
    notificationAudio.src = url;
    triggerSettingsUpdate();
  });
}

/* ---------- RESET ALL SETTINGS (Live) ---------- */
function resetSettings() {
  localStorage.clear();
  triggerSettingsUpdate();
  initSettings(); // Re-init instead of reload
}

function initResetButton() {
  $("resetSettingsBtn")?.addEventListener("click", () => {
    if (confirm("Reset all settings to default?")) {
      resetSettings();
    }
  });
}

/* ---------- Listen for updates from other tabs/pages ---------- */
window.addEventListener("storage", (e) => {
  if (e.key === "settingsUpdatedAt") {
    initSettings();
  }
});

/* ---------- INIT ---------- */
function initSettings() {
  initDarkMode();
  initFontSize();
  initNotificationToggle();
  initNotificationSounds();
  initResetButton();
}

document.addEventListener("DOMContentLoaded", initSettings);