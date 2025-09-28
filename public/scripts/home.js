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

// ==============================
// DOM Elements
// ==============================
const chatListEl = document.getElementById("chatList");
const tabChats = document.getElementById("tabChats");
const tabGroups = document.getElementById("tabGroups");
const actionToolbar = document.getElementById("actionToolbar");
const searchInput = document.getElementById("searchInput");

const addFriendBtn = document.getElementById("addFriendBtn");
const addFriendModal = document.getElementById("addFriendModal");
const closeModalBtn = document.getElementById("closeModal");
const confirmAddFriendBtn = document.getElementById("confirmAddFriendBtn");
const friendIdentifierInput = document.getElementById("friendIdentifier");

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
  renderChats();
  clearSelection();
}

// ==============================
// Fetch Friends & Groups
// ==============================
async function fetchChats() {
  try {
    const res = await fetch("/api/users/friends", { headers: { Authorization: `Bearer ${token}` } });
    const chats = await res.json();
    allChats = Array.isArray(chats) ? chats : [];
  } catch (err) {
    console.error("Error fetching friends:", err);
    allChats = [];
  }

  try {
    const resG = await fetch("/api/groups/my-groups", { headers: { Authorization: `Bearer ${token}` } });
    const groups = await resG.json();
    allGroups = Array.isArray(groups) ? groups : [];
  } catch (err) {
    console.error("Error fetching groups:", err);
    allGroups = [];
  }

  renderChats();
}

// ==============================
// Render Chats / Groups
// ==============================
function renderChats() {
  chatListEl.innerHTML = "";
  const list = activeTab === "chats" ? allChats : allGroups;
  if (!list.length) {
    chatListEl.innerHTML = `<p class="text-center text-gray-500 mt-10">No ${activeTab} yet.</p>`;
    return;
  }

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "flex items-center p-3 hover:bg-[#2c2c2c] cursor-pointer select-none";
    div.dataset.id = item._id;

    div.onclick = () => {
      if (activeTab === "chats") {
        window.location.href = `/private-chat.html?user=${item._id}`;
      } else {
        window.location.href = `/group-chat.html?group=${item._id}`;
      }
    };

    div.innerHTML = `
      <img src="${item.avatar || "/default-avatar.png"}" class="w-10 h-10 rounded-full mr-3 border border-gray-600" />
      <div class="flex-1">
        <div class="flex justify-between items-center">
          <span class="font-semibold text-white text-base">${item.username || item.groupName}</span>
        </div>
      </div>
    `;

    chatListEl.appendChild(div);
  });
}

// ==============================
// Search
// ==============================
searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase();
  const list = activeTab === "chats" ? allChats : allGroups;
  renderChats(list.filter(item => (item.username || "").toLowerCase().includes(q) || (item.groupName || "").toLowerCase().includes(q)));
});

// ==============================
// Add Friend Modal
// ==============================
addFriendBtn.addEventListener("click", () => addFriendModal.classList.remove("hidden"));
closeModalBtn.addEventListener("click", () => addFriendModal.classList.add("hidden"));

confirmAddFriendBtn.addEventListener("click", async () => {
  const identifier = friendIdentifierInput.value.trim();
  if (!identifier) return alert("Enter username or email");

  try {
    const res = await fetch(`/api/users/add-friend/${identifier}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.message) {
      alert(data.message);
      friendIdentifierInput.value = "";
      addFriendModal.classList.add("hidden");
      await fetchChats(); // Refresh friends list
    } else if (data.error) {
      alert(data.error);
    }
  } catch (err) {
    alert("Failed to add friend");
    console.error(err);
  }
});

// ==============================
// Settings
// ==============================
settingsBtn.addEventListener("click", () => window.location.href = "/settings.html");

// ==============================
// Selection Toolbar (optional)
// ==============================
["pinBtn","deleteBtn","archiveBtn","moreBtn"].forEach(id => {
  const btn = document.getElementById(id);
  if(btn) btn.addEventListener("click", () => alert(`${id} clicked`));
});

// ==============================
// Initial Load
// ==============================
fetchChats();