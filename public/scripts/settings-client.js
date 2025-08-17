// public/scripts/settings-client.js
const token = localStorage.getItem("token");
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: "Bearer " + (token || ""),
});

const $ = id => document.getElementById(id);

// Load settings and wallet on page load
async function loadAll() {
  await loadSettings();
  await refreshWallet();
}

// Load settings from server
async function loadSettings() {
  try {
    const res = await fetch("/api/settings", { headers: headers() });
    if (!res.ok) {
      console.error("Failed to load settings", await res.text());
      return;
    }
    const s = await res.json();
    // Populate UI
    $("darkModeToggle") && ( $("darkModeToggle").checked = (s.darkMode === "on") );
    $("fontSizeSelect") && ( $("fontSizeSelect").value = s.fontSize || "medium" );
    $("notifMessages") && ( $("notifMessages").checked = !!s.notifMessages );
    $("notifCalls") && ( $("notifCalls").checked = !!s.notifCalls );
    $("dndToggle") && ( $("dndToggle").checked = !!s.dnd );
    $("lastSeen") && ( $("lastSeen").checked = !!s.showLastSeen );
    $("whoCanCall") && ( $("whoCanCall").checked = !!s.allowCallsFromEveryone );
    $("walletCurrency") && ( $("walletCurrency").value = s.walletCurrency || "USD" );
    // sound
    if (s.notificationSoundKind === "custom") {
      localStorage.setItem("notificationSoundKind", "custom");
      localStorage.setItem("notificationCustomUrl", s.notificationSound || "");
    } else {
      localStorage.setItem("notificationSoundKind", "builtin");
      localStorage.setItem("notificationSound", s.notificationSound || "plastic-bat-hit.mp3");
    }
  } catch (e) {
    console.error("Error loading settings", e);
  }
}

// Save a subset of settings without reload
async function saveSettings(patch) {
  try {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(patch)
    });
    if (!res.ok) {
      const txt = await res.text();
      alert("Failed to save settings: " + txt);
      return;
    }
    const updated = await res.json();
    // Optionally show a small toast
    console.log("Settings saved", updated);
  } catch (e) {
    console.error("Save settings error", e);
  }
}

// Refresh wallet summary
async function refreshWallet() {
  try {
    const currency = $("walletCurrency")?.value || "USD";
    const res = await fetch(`/api/wallet/summary?currency=${encodeURIComponent(currency)}`, { headers: headers() });
    if (!res.ok) return console.error("wallet summary failed");
    const data = await res.json();
    // Update UI elements (match ids in settings.html)
    if ($("walletFiat")) $("walletFiat").textContent = `${data.balance.toFixed(2)} ${data.currency}`;
    if ($("walletUsd")) $("walletUsd").textContent = data.usdApprox?.toFixed(2) ?? data.balance.toFixed(2);
    if ($("freeCallLeft")) $("freeCallLeft").textContent = data.freeSecondsLeft ?? 60;
    injectTxns(data.history || []);
  } catch (e) {
    console.error(e);
  }
}

function injectTxns(items) {
  const list = $("txnList");
  if (!list) return;
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<li class="text-sm opacity-70">No transactions yet</li>`;
    return;
  }
  items.forEach(t => {
    const li = document.createElement("li");
    li.className = "flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded";
    li.innerHTML = `
      <div>
        <div class="font-medium">${t.gateway || t.type}</div>
        <div class="text-xs opacity-70">${new Date(t.createdAt).toLocaleString()}</div>
      </div>
      <div class="text-right">
        <div class="${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}">${t.type === 'credit' ? '+' : '-'} ${t.amount.toFixed(2)} ${t.currency || 'USD'}</div>
        <div class="text-xs opacity-70">${t.status}</div>
      </div>
    `;
    list.appendChild(li);
  });
}

// UI wiring: call this once DOM ready
function wireUI() {
  // dark toggle
  $("darkModeToggle")?.addEventListener("change", (e) => saveSettings({ darkMode: e.target.checked ? "on" : "off" }));

  // font size
  $("fontSizeSelect")?.addEventListener("change", (e) => {
    saveSettings({ fontSize: e.target.value });
    document.body.style.fontSize = e.target.value === "small" ? "14px" : e.target.value === "large" ? "18px" : "16px";
  });

  // notifications
  $("notifMessages")?.addEventListener("change", (e) => saveSettings({ notifMessages: e.target.checked }));
  $("notifCalls")?.addEventListener("change", (e) => saveSettings({ notifCalls: e.target.checked }));
  $("dndToggle")?.addEventListener("change", (e) => saveSettings({ dnd: e.target.checked }));

  // privacy
  $("lastSeen")?.addEventListener("change", (e) => saveSettings({ showLastSeen: e.target.checked }));
  $("whoCanCall")?.addEventListener("change", (e) => saveSettings({ allowCallsFromEveryone: e.target.checked }));

  // wallet currency change -> refresh wallet and save user preference
  $("walletCurrency")?.addEventListener("change", (e) => {
    saveSettings({ walletCurrency: e.target.value });
    refreshWallet();
  });

  // topup flow
  $("topupPayBtn")?.addEventListener("click", async () => {
    const amount = parseFloat($("topupAmount").value || "0");
    const currency = $("topupCurrency").value;
    const gateway = $("topupGateway").value;
    if (!amount || amount <= 0) { alert("Enter amount"); return; }
    // call backend to create checkout
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ amount, currency, gateway })
      });
      const data = await res.json();
      if (!res.ok) { alert("Checkout failed: " + (data.error || "unknown")); return; }
      // show popup or redirect depending on returned payload
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank");
        // optional poll for completion
      } else {
        alert("Checkout started (stub). Integrate gateway server-side.");
      }
    } catch (err) {
      console.error(err); alert("Checkout error");
    }
  });
}

// Initialize client
document.addEventListener("DOMContentLoaded", async () => {
  wireUI();
  await loadAll();
});