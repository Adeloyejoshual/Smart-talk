// ==============================
// Auth Check
// ==============================
const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

// ==============================
// State
// ==============================
let allChats = [];
let allGroups = [];
let selectedChats = new Set();
let activeTab = "chats";

let socket = null;
let joinedThreadIds = { chats: new Set(), groups: new Set() };

const chatIndexById = new Map();
const groupIndexById = new Map();

// ==============================
// DOM Elements
// ==============================
const chatListEl = document.getElementById("chatList");
const tabChats = document.getElementById("tabChats");
const tabGroups = document.getElementById("tabGroups");
const actionToolbar = document.getElementById("actionToolbar");
const searchInput = document.getElementById("searchInput");

// Add Friend Modal
const addFriendModal = document.getElementById("addFriendModal");
const friendIdentifierInput = document.getElementById("friendIdentifier");
const confirmAddFriendBtn = document.getElementById("confirmAddFriendBtn");
const addFriendBtn = document.getElementById("addFriendBtn");
const closeModalBtn = document.getElementById("closeModal");

// Settings Button
const settingsBtn = document.getElementById("settingsBtn");

// ==============================
// Tab Switching
// ==============================
tabChats.addEventListener("click", () => switchTab("chats"));
tabGroups.addEventListener("click", () => switchTab("groups"));

function switchTab(tab) {
  activeTab = tab;
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
// Fetch Chats & Friends
// ==============================
async function fetchChats() {
  try {
    // Friends with last messages
    const res = await fetch("/api/users/friends-with-last-message", {
      headers: { Authorization: `Bearer ${token}` },
    });
    let chats = await res.json();
    if (!Array.isArray(chats)) chats = [];

    // All friends
    const resF = await fetch("/api/users/friends", {
      headers: { Authorization: `Bearer ${token}` }
    });
    let friends = await resF.json();
    if (!Array.isArray(friends)) friends = [];

    // Merge friends without messages
    const existingIds = new Set(chats.map(c => c._id));
    friends.forEach(f => {
      if (!existingIds.has(f._id)) {
        chats.push({
          _id: f._id,
          username: f.username,
          email: f.email,
          avatar: f.avatar || "/default-avatar.png",
          lastMessage: "No messages yet",
          lastMessageTime: 0,
          unread: 0
        });
      }
    });

    allChats = chats.sort((a,b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
    rebuildIndex("chats");
    displayChats(activeTab === "chats" ? allChats : allGroups);
    joinAllThreads();

  } catch (err) {
    console.error("Fetch chats/friends error:", err);
  }
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
// Display Chats/Groups
// ==============================
function displayChats(list) {
  chatListEl.innerHTML = "";
  if (!list || list.length === 0) {
    chatListEl.innerHTML = `<p class="text-center text-gray-500 mt-10">No ${activeTab} yet.</p>`;
    return;
  }
  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "flex items-center p-3 hover:bg-[#2c2c2c] cursor-pointer select-none";
    div.dataset.id = item._id;

    div.onclick = () => {
      if (selectedChats.size > 0) {
        toggleChatSelection(div, item._id);
      } else {
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
          <span class="font-semibold text-white text-base">${item.username || item.groupName}</span>
          <span class="text-xs text-gray-500">${formatTime(item.lastMessageTime)}</span>
        </div>
        <div class="flex justify-between items-center gap-2">
          <span class="text-sm text-gray-400 truncate">${item.lastMessage || "Start chatting..."}</span>
          ${item.unread > 0 ? `<span class="bg-red-500 text-xs text-white px-2 rounded-full">${item.unread}</span>` : ""}
        </div>
      </div>`;

    addLongPressListeners(div, item._id);
    if (selectedChats.has(item._id)) div.classList.add("chat-selected");
    chatListEl.appendChild(div);
  });
}

function formatTime(ts) {
  try { return new Date(ts || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } 
  catch { return ""; }
}

// ==============================
// Search
// ==============================
searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase();
  const list = activeTab === "chats" ? allChats : allGroups;
  displayChats(list.filter(
    (item) =>
      (item.username || "").toLowerCase().includes(q) ||
      (item.email || "").toLowerCase().includes(q) ||
      (item.groupName || "").toLowerCase().includes(q)
  ));
});

// ==============================
// Long Press Selection
// ==============================
let longPressTimer;
function addLongPressListeners(div, id) {
  const start = () => longPressTimer = setTimeout(() => toggleChatSelection(div, id), 500);
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
  document.querySelectorAll(".chat-selected").forEach(el => el.classList.remove("chat-selected"));
  actionToolbar.classList.add("hidden");
}

// ==============================
// Toolbar buttons
// ==============================
["pinBtn", "deleteBtn", "archiveBtn", "moreBtn"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => {
    alert(`${id.replace("Btn", "")} action: ${[...selectedChats].join(", ")}`);
    clearSelection();
  });
});

document.getElementById("selectAllBtn").addEventListener("click", () => {
  const list = activeTab === "chats" ? allChats : allGroups;
  selectedChats = new Set(list.map(c => c._id));
  document.querySelectorAll("#chatList > div").forEach(div => div.classList.add("chat-selected"));
  actionToolbar.classList.remove("hidden");
});

document.getElementById("deleteAllBtn").addEventListener("click", () => {
  if (selectedChats.size === 0) { alert("No chats selected."); return; }
  alert(`Deleted: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

// ==============================
// Add Friend Modal
// ==============================
addFriendBtn.addEventListener("click", () => {
  addFriendModal.classList.remove("hidden");
});

closeModalBtn.addEventListener("click", () => {
  addFriendModal.classList.add("hidden");
});

confirmAddFriendBtn.addEventListener("click", async () => {
  const id = friendIdentifierInput.value.trim();
  if (!id) { alert("Enter username or Gmail"); return; }

  try {
    const res = await fetch("/api/users/add-friend", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ identifier: id }),
    });
    const data = await res.json();
    if (data.error) return alert(data.error);

    alert("Friend added!");
    addFriendModal.classList.add("hidden");
    friendIdentifierInput.value = "";
    await fetchChats();
  } catch {
    alert("Error adding friend.");
  }
});

// ==============================
// Settings
// ==============================
settingsBtn.addEventListener("click", () => window.location.href = "/settings.html");

// ==============================
// Socket.IO
// ==============================
(function initSocketClient() {
  if (window.io) return initSocket();
  const s = document.createElement("script");
  s.src = "https://cdn.socket.io/4.7.5/socket.io.min.js";
  s.onload = initSocket;
  document.head.appendChild(s);
})();

function initSocket() {
  socket = io("/", { auth: { token }, transports: ["websocket","polling"] });
  socket.on("connect", () => joinAllThreads());
  socket.on("chat:newMessage", payload => {
    if(payload) upsertChatThread(payload.from, {lastMessage:payload.text,lastMessageTime:payload.createdAt||Date.now(),incUnread:true});
  });
  socket.on("group:newMessage", payload => {
    if(payload) upsertGroupThread(payload.groupId, {lastMessage:payload.text,lastMessageTime:payload.createdAt||Date.now(),incUnread:true});
  });
}

// ==============================
// Join rooms
// ==============================
function joinAllThreads() {
  if (!socket || !socket.connected) return;
  const chatIds = allChats.map(c => c._id).filter(id => !joinedThreadIds.chats.has(id));
  const groupIds = allGroups.map(g => g._id).filter(id => !joinedThreadIds