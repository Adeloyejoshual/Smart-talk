// settings.js

document.addEventListener("DOMContentLoaded", function () {
    // ======= ELEMENT REFERENCES =======
    const darkModeToggle = document.getElementById("darkModeToggle");
    const fontSizeSelect = document.getElementById("fontSizeSelect");
    const notificationToggle = document.getElementById("notificationToggle");
    const soundSelect = document.getElementById("soundSelect");
    const uploadRingtone = document.getElementById("uploadRingtone");
    const ringtonePlayer = document.getElementById("ringtonePlayer");
    const saveSettingsBtn = document.getElementById("saveSettingsBtn");
    const resetSettingsBtn = document.getElementById("resetSettingsBtn");
    const appVersionText = document.getElementById("appVersion");
    const termsBtn = document.getElementById("viewTerms");
    const privacyBtn = document.getElementById("viewPrivacy");

    // ======= VERSION INFO =======
    const APP_VERSION = "1.0.0";
    appVersionText.textContent = `Version: ${APP_VERSION}`;

    // ======= LOAD SAVED SETTINGS =======
    function loadSettings() {
        if (localStorage.getItem("darkMode") === "true") {
            document.documentElement.classList.add("dark");
            darkModeToggle.checked = true;
        }
        fontSizeSelect.value = localStorage.getItem("fontSize") || "medium";
        notificationToggle.checked = localStorage.getItem("notifications") === "true";
        soundSelect.value = localStorage.getItem("sound") || "default";
    }
    loadSettings();

    // ======= DARK MODE =======
    darkModeToggle.addEventListener("change", function () {
        if (this.checked) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    });

    // ======= FONT SIZE =======
    fontSizeSelect.addEventListener("change", function () {
        document.body.style.fontSize =
            this.value === "small" ? "14px" :
            this.value === "large" ? "18px" : "16px";
    });

    // ======= NOTIFICATION SOUND PREVIEW =======
    soundSelect.addEventListener("change", function () {
        if (this.value !== "custom") {
            ringtonePlayer.src = `sounds/${this.value}.mp3`;
            ringtonePlayer.play();
        }
    });

    // ======= CUSTOM RINGTONE UPLOAD =======
    uploadRingtone.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (file) {
            const fileURL = URL.createObjectURL(file);
            ringtonePlayer.src = fileURL;
            ringtonePlayer.play();
            localStorage.setItem("customRingtone", fileURL);
        }
    });

    // ======= SAVE SETTINGS =======
    saveSettingsBtn.addEventListener("click", function () {
        localStorage.setItem("darkMode", darkModeToggle.checked);
        localStorage.setItem("fontSize", fontSizeSelect.value);
        localStorage.setItem("notifications", notificationToggle.checked);
        localStorage.setItem("sound", soundSelect.value);
        alert("✅ Settings saved successfully!");
    });

    // ======= RESET SETTINGS =======
    resetSettingsBtn.addEventListener("click", function () {
        localStorage.clear();
        document.documentElement.classList.remove("dark");
        document.body.style.fontSize = "16px";
        darkModeToggle.checked = false;
        fontSizeSelect.value = "medium";
        notificationToggle.checked = false;
        soundSelect.value = "default";
        alert("🔄 Settings reset to default!");
    });

    // ======= TERMS & PRIVACY =======
    termsBtn.addEventListener("click", function () {
        window.location.href = "terms.html";
    });
    privacyBtn.addEventListener("click", function () {
        window.location.href = "privacy.html";
    });
});