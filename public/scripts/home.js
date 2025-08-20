const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

let allChats = [], allGroups = [], selectedChats = new Set();
let activeTab = "chats";

const chatListEl = document.getElementById("chatList");
const tabChats = document.getElementById("tabChats");
const tabGroups = document.getElementById("tabGroups");
const actionToolbar = document.getElementById("actionToolbar");

// ----------------- Tabs -----------------
tabChats.addEventListener("click", () => switchTab("chats"));
tabGroups.addEventListener("click", () => switchTab("groups"));

function switchTab(tab) {
  activeTab = tab;
  tabChats.classList.toggle("tab-active", tab === "chats");
  tabGroups.classList.toggle("tab-active", tab === "groups");
  displayChats(tab === "chats" ? allChats : allGroups);
  clearSelection();
}

// ----------------- Fetch Data -----------------
async function fetchChats() {
  try {
    const resChats = await fetch("/api/users/friends-with-last-message", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!resChats.ok) throw new Error("Failed to fetch friends");

    const chats = await resChats.json();
    allChats = (chats || []).map(c => ({
      _id: c._id,
      username: c.username,
      email: c.email || "",
      avatar: c.avatar,
      lastMessage: c.lastMessage || "Start chatting...",
      lastMessageTime: c.lastMessageTime || Date.now(),
      time: new Date(c.lastMessageTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: c.unread || 0,
    })).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  } catch (e) {
    console.error("Friends fetch error:", e);
  }

  try {
    const resGroups = await fetch("/api/groups/my-groups", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!resGroups.ok) throw new Error("Failed to fetch groups");

    const groups = await resGroups.json();
    allGroups = (groups || []).map(g => ({
      _id: g._id,
      groupName: g.groupName,
      avatar: g.avatar,
      lastMessage: g.lastMessage || "No messages yet",
      lastMessageTime: g.lastMessageTime || Date.now(),
      time: new Date(g.lastMessageTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: g.unread || 0,
    })).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  } catch (e) {
    console.error("Groups fetch error:", e);
  }

  switchTab(activeTab);
}

// ----------------- Render Chats -----------------
function displayChats(list) {
  chatListEl.innerHTML = "";
  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "flex items-center p-3 hover:bg-[#2c2c2c] cursor-pointer select-none";
    div.dataset.id = item._id;

    div.onclick = () => {
      if (selectedChats.size > 0) {
        toggleChatSelection(div, item._id);
      } else {
        window.location.href = activeTab === "chats"
          ? `/private-chat.html?user=${item._id}`
          : `/group-chat.html?group=${item._id}`;
      }
    };

    div.innerHTML = `
      <img src="${item.avatar || '/default-avatar.png'}" class="w-10 h-10 rounded-full mr-3 border border-gray-600" />
      <div class="flex-1">
        <div class="flex justify-between items-center">
          <span class="font-semibold text-white text-base">${item.username || item.groupName}</span>
          <span class="text-xs text-gray-500">${item.time}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-gray-400 truncate">${item.lastMessage}</span>
          ${item.unread > 0 ? `<span class="bg-red-500 text-xs text-white px-2 rounded-full">${item.unread}</span>` : ""}
        </div>
      </div>`;
    
    addLongPressListeners(div, item._id);
    if (selectedChats.has(item._id)) div.classList.add("chat-selected");
    chatListEl.appendChild(div);
  });
}

// ----------------- Search -----------------
document.getElementById("searchInput").addEventListener("input", () => {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const list = activeTab === "chats" ? allChats : allGroups;
  displayChats(list.filter(item =>
    (item.username || "").toLowerCase().includes(q) ||
    (item.email || "").toLowerCase().includes(q) ||
    (item.groupName || "").toLowerCase().includes(q)
  ));
});

// ----------------- Selection -----------------
let longPressTimer;
function addLongPressListeners(div, id) {
  div.addEventListener("mousedown", () => { longPressTimer = setTimeout(() => toggleChatSelection(div, id), 500); });
  div.addEventListener("mouseup", () => clearTimeout(longPressTimer));
  div.addEventListener("mouseleave", () => clearTimeout(longPressTimer));
  div.addEventListener("touchstart", () => { longPressTimer = setTimeout(() => toggleChatSelection(div, id), 500); });
  div.addEventListener("touchend", () => clearTimeout(longPressTimer));
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

// ----------------- Toolbar -----------------
document.getElementById("pinBtn").addEventListener("click", () => {
  console.log(`📌 Pinned: ${[...selectedChats].join(", ")}`);
  clearSelection();
});
document.getElementById("deleteBtn").addEventListener("click", () => {
  console.log(`❌ Deleted: ${[...selectedChats].join(", ")}`);
  clearSelection();
});
document.getElementById("archiveBtn").addEventListener("click", () => {
  console.log(`📦 Archived: ${[...selectedChats].join(", ")}`);
  clearSelection();
});
document.getElementById("moreBtn").addEventListener("click", () => {
  console.log("⋮ More options...");
});

// ----------------- Select/Delete All -----------------
document.getElementById("selectAllBtn").addEventListener("click", () => {
  const list = activeTab === "chats" ? allChats : allGroups;
  selectedChats = new Set(list.map(c => c._id));
  document.querySelectorAll("#chatList > div").forEach(div => div.classList.add("chat-selected"));
  actionToolbar.classList.remove("hidden");
});

document.getElementById("deleteAllBtn").addEventListener("click", () => {
  if (selectedChats.size === 0) return alert("No chats selected.");
  console.log(`🗑️ Deleted: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

// ----------------- Add Friend -----------------
function openAddFriendModal() {
  document.getElementById("addFriendModal").classList.remove("hidden");
}
function closeAddFriendModal() {
  document.getElementById("addFriendModal").classList.add("hidden");
}

async function confirmAddFriend() {
  const id = document.getElementById("friendIdentifier").value.trim();
  if (!id) return alert("Enter username or Gmail.");

  try {
    const res = await fetch("/api/users/add-friend", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ identifier: id })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return alert("❌ " + (data.error || "Unable to add friend"));
    }

    alert("✅ Friend added!");
    closeAddFriendModal();
    await fetchChats();
  } catch (err) {
    console.error("Add friend error:", err);
    alert("⚠️ Error adding friend. Please try again.");
  }
}

// ----------------- Init -----------------
fetchChats();