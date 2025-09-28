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
let activeTab = "chats";

// ==============================
// DOM Elements
// ==============================
const chatListEl = document.getElementById("chatList");
const tabChats = document.getElementById("tabChats");
const tabGroups = document.getElementById("tabGroups");
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
  tabChats.classList.toggle("active", tab === "chats");
  tabGroups.classList.toggle("active", tab === "groups");
  renderChats();
}

// ==============================
// Fetch Friends & Groups
// ==============================
async function fetchChats() {
  try {
    const res = await fetch("/api/users/friends", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const chats = await res.json();
    allChats = Array.isArray(chats) ? chats : [];
  } catch (err) {
    console.error("Error fetching friends:", err);
    allChats = [];
  }

  try {
    const resG = await fetch("/api/groups/my-groups", {
      headers: { Authorization: `Bearer ${token}` }
    });
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
function renderChats(filteredList) {
  chatListEl.innerHTML = "";
  const list = filteredList || (activeTab === "chats" ? allChats : allGroups);
  if (!list.length) {
    chatListEl.innerHTML = `<p class="text-center text-gray-500 mt-10">No ${activeTab} yet.</p>`;
    return;
  }

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.dataset.id = item._id;

    div.addEventListener("click", () => {
      if (activeTab === "chats") {
        window.location.href = `/private-chat.html?user=${item._id}`;
      } else {
        window.location.href = `/group-chat.html?group=${item._id}`;
      }
    });

    div.innerHTML = `
      <img src="${item.avatar || '/default-avatar.png'}" class="chat-avatar" />
      <div class="chat-info">
        <span class="name">${item.username || item.groupName}</span>
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
  const filtered = list.filter(item =>
    (item.username || "").toLowerCase().includes(q) ||
    (item.groupName || "").toLowerCase().includes(q)
  );
  renderChats(filtered);
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
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.message) {
      alert(data.message);
      friendIdentifierInput.value = "";
      addFriendModal.classList.add("hidden");
      await fetchChats();
    } else if (data.error) {
      alert(data.error);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to add friend");
  }
});

// ==============================
// Settings Button
// ==============================
settingsBtn.addEventListener("click", () => {
  window.location.href = "/settings.html";
});

// ==============================
// Initial Load
// ==============================
fetchChats();