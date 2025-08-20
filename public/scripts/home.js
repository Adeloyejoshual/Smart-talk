// ==============================
// Auth Check
// ==============================
const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

// ==============================
// State
// ==============================
let allChats = [];   // friends DM threads
let allGroups = [];  // group threads
let selectedChats = new Set();
let activeTab = "chats"; // "chats" | "groups"

let socket = null;
let joinedThreadIds = { chats: new Set(), groups: new Set() }; // server rooms we joined

// Quick lookup maps for faster realtime updates
const chatIndexById = new Map();   // friendId -> index in allChats
const groupIndexById = new Map();  // groupId  -> index in allGroups

// ==============================
// DOM Elements
// ==============================
const chatListEl = document.getElementById("chatList");
const tabChats = document.getElementById("tabChats");
const tabGroups = document.getElementById("tabGroups");
const actionToolbar = document.getElementById("actionToolbar");
const friendMessage = document.getElementById("friendMessage");
const searchInput = document.getElementById("searchInput");

// ==============================
// Tab Switching
// ==============================
tabChats.addEventListener("click", () => switchTab("chats"));
tabGroups.addEventListener("click", () => switchTab("groups"));

function switchTab(tab) {
  activeTab = tab;

  // Tailwind class toggles for active tab
  tabChats.classList.toggle("border-b-2", tab === "chats");
  tabChats.classList.toggle("border-orange-500", tab === "chats");
  tabChats.classList.toggle("font-semibold", tab === "chats");

  tabGroups.classList.toggle("border-b-2", tab === "groups");
  tabGroups.classList.toggle("border-orange-500", tab === "groups");
  tabGroups.classList.toggle("font-semibold", tab === "groups");

  displayChats(tab === "chats" ? allChats : allGroups);
  clearSelection();
}

// ==============================
// Fetch friends & groups
// ==============================
async function fetchChats() {
  try {
    const res = await fetch("/api/users/friends-with-last-message", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const chats = await res.json();

    if (Array.isArray(chats)) {
      // Sort newest first
      allChats = chats
        .map((c) => ({
          ...c,
          lastMessageTime: c.lastMessageTime || c.updatedAt || Date.now(),
          unread: Number(c.unread || 0),
        }))
        .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

      rebuildIndex("chats");
    }
  } catch (e) {
    console.error("Friends fetch error:", e);
  }

  try {
    const resG = await fetch("/api/groups/my-groups", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const groups = await resG.json();

    if (Array.isArray(groups)) {
      allGroups = groups
        .map((g) => ({
          ...g,
          lastMessageTime: g.lastMessageTime || g.updatedAt || Date.now(),
          unread: Number(g.unread || 0),
        }))
        .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

      rebuildIndex("groups");
    }
  } catch (e) {
    console.error("Groups fetch error:", e);
  }

  displayChats(activeTab === "chats" ? allChats : allGroups);

  // Join/refresh socket rooms after we know our thread IDs
  joinAllThreads();
}

function rebuildIndex(kind) {
  if (kind === "chats") {
    chatIndexById.clear();
    allChats.forEach((c, i) => chatIndexById.set(c._id, i));
  } else {
    groupIndexById.clear();
    allGroups.forEach((g, i) => groupIndexById.set(g._id, i));
  }
}

// ==============================
// Render chats / groups
// ==============================
function displayChats(list) {
  chatListEl.innerHTML = "";

  if (!list || list.length === 0) {
    chatListEl.innerHTML = `<p class="text-center text-gray-500 mt-10">No ${activeTab} yet.</p>`;
    return;
  }

  list.forEach((item) => {
    const div = document.createElement("div");
    div.className =
      "flex items-center p-3 hover:bg-[#2c2c2c] cursor-pointer select-none";
    div.dataset.id = item._id;

    div.onclick = () => {
      if (selectedChats.size > 0) {
        toggleChatSelection(div, item._id);
      } else {
        // Navigate to chat screen
        if (activeTab === "chats") {
          window.location.href = `/private-chat.html?user=${item._id}`;
        } else {
          window.location.href = `/group-chat.html?group=${item._id}`;
        }
      }
    };

    div.innerHTML = `
      <img src="${item.avatar || "/default-avatar.png"}"
           class="w-10 h-10 rounded-full mr-3 border border-gray-600" />
      <div class="flex-1">
        <div class="flex justify-between items-center">
          <span class="font-semibold text-white text-base">
            ${item.username || item.groupName}
          </span>
          <span class="text-xs text-gray-500">
            ${formatTime(item.lastMessageTime)}
          </span>
        </div>
        <div class="flex justify-between items-center gap-2">
          <span class="text-sm text-gray-400 truncate">
            ${item.lastMessage || "Start chatting..."}
          </span>
          ${
            item.unread > 0
              ? `<span class="bg-red-500 text-xs text-white px-2 rounded-full">${item.unread}</span>`
              : ""
          }
        </div>
      </div>`;

    addLongPressListeners(div, item._id);

    if (selectedChats.has(item._id)) div.classList.add("chat-selected");

    chatListEl.appendChild(div);
  });
}

function formatTime(ts) {
  try {
    return new Date(ts || Date.now()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ==============================
// Search (client-side)
// ==============================
searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase();
  const list = activeTab === "chats" ? allChats : allGroups;
  displayChats(
    list.filter(
      (item) =>
        (item.username || "").toLowerCase().includes(q) ||
        (item.email || "").toLowerCase().includes(q) ||
        (item.groupName || "").toLowerCase().includes(q)
    )
  );
});

// ==============================
// Long press multi-select
// ==============================
let longPressTimer;

function addLongPressListeners(div, id) {
  const start = () =>
    (longPressTimer = setTimeout(() => toggleChatSelection(div, id), 500));
  const clear = () => clearTimeout(longPressTimer);

  div.addEventListener("mousedown", start);
  div.addEventListener("mouseup", clear);
  div.addEventListener("mouseleave", clear);
  div.addEventListener("touchstart", start, { passive: true });
  div.addEventListener("touchend", clear);
}

function toggleChatSelection(div, id) {
  if (selectedChats.has(id)) {
    selectedChats.delete(id);
    div.classList.remove("chat-selected");
  } else {
    selectedChats.add(id);
    div.classList.add("chat-selected");
  }
  actionToolbar.classList.toggle("hidden", selectedChats.size === 0);
}

function clearSelection() {
  selectedChats.clear();
  document
    .querySelectorAll(".chat-selected")
    .forEach((el) => el.classList.remove("chat-selected"));
  actionToolbar.classList.add("hidden");
}

// ==============================
// Toolbar buttons (placeholder)
// ==============================
document.getElementById("pinBtn").addEventListener("click", () => {
  alert(`📌 Pinned: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

document.getElementById("deleteBtn").addEventListener("click", () => {
  alert(`❌ Deleted: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

document.getElementById("archiveBtn").addEventListener("click", () => {
  alert(`📦 Archived: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

document.getElementById("moreBtn").addEventListener("click", () => {
  alert("⋮ More options...");
});

// ==============================
// Select/Delete All
// ==============================
document.getElementById("selectAllBtn").addEventListener("click", () => {
  const list = activeTab === "chats" ? allChats : allGroups;
  selectedChats = new Set(list.map((c) => c._id));
  document
    .querySelectorAll("#chatList > div")
    .forEach((div) => div.classList.add("chat-selected"));
  actionToolbar.classList.remove("hidden");
});

document.getElementById("deleteAllBtn").addEventListener("click", () => {
  if (selectedChats.size === 0) {
    alert("No chats selected.");
    return;
  }
  alert(`🗑️ Deleted: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

// ==============================
// Add Friend Modal
// ==============================
function openAddFriendModal() {
  document.getElementById("addFriendModal").classList.remove("hidden");
  friendMessage.textContent = "";
}

function closeAddFriendModal() {
  document.getElementById("addFriendModal").classList.add("hidden");
  friendMessage.textContent = "";
}

function confirmAddFriend() {
  const id = document.getElementById("friendIdentifier").value.trim();
  if (!id) {
    friendMessage.textContent = "⚠️ Enter username or Gmail.";
    return;
  }

  fetch("/api/users/add-friend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ identifier: id }),
  })
    .then((res) => res.json())
    .then(async (data) => {
      if (data.error) {
        friendMessage.textContent = data.error;
        return;
      }
      friendMessage.textContent = "✅ Friend added!";
      closeAddFriendModal();
      await fetchChats(); // refresh lists
    })
    .catch(() => {
      friendMessage.textContent = "❌ Error adding friend.";
    });
}

// ==============================
// Socket.IO (Realtime)
// ==============================

// Load socket.io client if not present, then init
(function ensureSocketIoAndInit() {
  if (window.io) return initSocket();
  const s = document.createElement("script");
  s.src = "https://cdn.socket.io/4.7.5/socket.io.min.js";
  s.onload = initSocket;
  s.onerror = () => console.warn("Socket.IO client failed to load.");
  document.head.appendChild(s);
})();

function initSocket() {
  try {
    socket = io("/", {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      // Join rooms after connection (if we already fetched)
      joinAllThreads();
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket connect_error:", err?.message || err);
    });

    // ----- Assumed server events -----
    // Private message came in
    socket.on("chat:newMessage", (payload) => {
      // expected: { from, to, text, createdAt }
      // If 'from' is a friend, update that thread
      if (!payload) return refetchOnUnknown();
      const friendId = payload.from;
      upsertChatThread(friendId, {
        lastMessage: payload.text,
        lastMessageTime: payload.createdAt || Date.now(),
        incUnread: true,
      });
    });

    // Group message came in
    socket.on("group:newMessage", (payload) => {
      // expected: { groupId, from, text, createdAt }
      if (!payload) return refetchOnUnknown();
      const groupId = payload.groupId;
      upsertGroupThread(groupId, {
        lastMessage: payload.text,
        lastMessageTime: payload.createdAt || Date.now(),
        incUnread: true,
      });
    });

    // Some servers use a single "message" event with context
    socket.on("message", (msg) => {
      if (!msg) return;
      if (msg.groupId) {
        upsertGroupThread(msg.groupId, {
          lastMessage: msg.text,
          lastMessageTime: msg.createdAt || Date.now(),
          incUnread: true,
        });
      } else if (msg.from) {
        upsertChatThread(msg.from, {
          lastMessage: msg.text,
          lastMessageTime: msg.createdAt || Date.now(),
          incUnread: true,
        });
      } else {
        refetchOnUnknown();
      }
    });

    // Optional: presence updates (if your server emits)
    socket.on("presence:update", ({ userId, online }) => {
      // You could reflect presence in UI if you store it in allChats
      // For now we ignore; left as a hook.
    });
  } catch (e) {
    console.error("Socket init error:", e);
  }
}

// Tell server which rooms/threads we want realtime for
function joinAllThreads() {
  if (!socket || !socket.connected) return;

  const chatIds = allChats.map((c) => c._id);
  const groupIds = allGroups.map((g) => g._id);

  // Avoid rejoining the same rooms every time
  const newChatIds = chatIds.filter((id) => !joinedThreadIds.chats.has(id));
  const newGroupIds = groupIds.filter((id) => !joinedThreadIds.groups.has(id));

  if (newChatIds.length > 0) {
    socket.emit("chat:joinMany", { threadIds: newChatIds });
    newChatIds.forEach((id) => joinedThreadIds.chats.add(id));
  }
  if (newGroupIds.length > 0) {
    socket.emit("group:joinMany", { groupIds: newGroupIds });
    newGroupIds.forEach((id) => joinedThreadIds.groups.add(id));
  }
}

// If an event arrives we can't map, just refetch to stay consistent
let refetchTimeout = null;
function refetchOnUnknown() {
  if (refetchTimeout) return; // debounce bursty events
  refetchTimeout = setTimeout(async () => {
    refetchTimeout = null;
    await fetchChats();
  }, 400);
}

// Upsert helpers (update or insert thread, resort, re-render section if visible)
function upsertChatThread(friendId, { lastMessage, lastMessageTime, incUnread }) {
  let idx = chatIndexById.get(friendId);
  if (idx == null) {
    // Unknown thread -> refetch (safer than guessing fields)
    return refetchOnUnknown();
  }

  const t = allChats[idx];
  const unread = incUnread ? (Number(t.unread || 0) + 1) : t.unread || 0;

  const updated = { ...t, lastMessage, lastMessageTime, unread };
  allChats[idx] = updated;

  // Re-sort
  allChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  rebuildIndex("chats");

  if (activeTab === "chats") {
    // Keep current search filter applied
    applyCurrentFilterAndRender();
  }
}

function upsertGroupThread(groupId, { lastMessage, lastMessageTime, incUnread }) {
  let idx = groupIndexById.get(groupId);
  if (idx == null) {
    return refetchOnUnknown();
  }

  const t = allGroups[idx];
  const unread = incUnread ? (Number(t.unread || 0) + 1) : t.unread || 0;

  const updated = { ...t, lastMessage, lastMessageTime, unread };
  allGroups[idx] = updated;

  allGroups.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  rebuildIndex("groups");

  if (activeTab === "groups") {
    applyCurrentFilterAndRender();
  }
}

function applyCurrentFilterAndRender() {
  const q = (searchInput.value || "").toLowerCase();
  const list = activeTab === "chats" ? allChats : allGroups;
  if (!q) return displayChats(list);
  displayChats(
    list.filter(
      (item) =>
        (item.username || "").toLowerCase().includes(q) ||
        (item.email || "").toLowerCase().includes(q) ||
        (item.groupName || "").toLowerCase().includes(q)
    )
  );
}

// ==============================
// Page visibility: refresh when returning to tab
// ==============================
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    fetchChats();
  }
});

// ==============================
// Initial Load
// ==============================
fetchChats();