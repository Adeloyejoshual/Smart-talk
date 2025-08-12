const token = localStorage.getItem("token");
let allChats = [];
let selectedChats = new Set();

// Fetch chats from API
async function fetchChats() {
  try {
    const res = await fetch("/api/users/friends-with-last-message", {
      headers: { Authorization: `Bearer ${token}` },
    });
    let chats = await res.json();
    if (!Array.isArray(chats)) return;

    chats.forEach(chat => {
      chat.lastMessage = chat.lastMessage || "Start chatting...";
      chat.time = new Date(chat.lastMessageTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      chat.unread = chat.unread || 0;
    });

    chats.sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
    allChats = chats;
    displayChats(chats);
  } catch (err) {
    console.error("❌ Fetch chats failed:", err);
  }
}

// Display chats in the chat list
function displayChats(chats) {
  const list = document.getElementById("chatList");
  list.innerHTML = "";

  chats.forEach(chat => {
    const div = document.createElement("div");
    div.className = "flex items-center p-3 hover:bg-[#2c2c2c] cursor-pointer select-none";
    div.setAttribute("data-chat-id", chat._id);

    div.onclick = () => {
      if (selectedChats.size > 0) {
        toggleChatSelection(div, chat._id);
      } else {
        window.location.href = `/private-chat.html?user=${chat._id}`;
      }
    };

    div.innerHTML = `
      <img src="${chat.avatar || '/default-avatar.png'}" class="w-10 h-10 rounded-full mr-3 border border-gray-600" />
      <div class="flex-1">
        <div class="flex justify-between items-center">
          <span class="font-semibold text-white text-base">${chat.username || chat.name}</span>
          <span class="text-xs text-gray-500">${chat.time}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-gray-400 truncate">${chat.lastMessage}</span>
          ${chat.unread > 0 ? `<span class="bg-red-500 text-xs text-white px-2 rounded-full">${chat.unread}</span>` : ""}
        </div>
      </div>
    `;

    addLongPressListeners(div, chat._id);

    list.appendChild(div);
  });
}

// Search filter
document.getElementById("searchInput").addEventListener("input", () => {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const filtered = allChats.filter(chat =>
    (chat.username || "").toLowerCase().includes(q) ||
    (chat.name || "").toLowerCase().includes(q) ||
    (chat.email || "").toLowerCase().includes(q)
  );
  displayChats(filtered);
});

// Long press handlers for multi-select toggle
let longPressTimer;

function addLongPressListeners(chatDiv, chatId) {
  chatDiv.addEventListener("mousedown", () => {
    longPressTimer = setTimeout(() => {
      toggleChatSelection(chatDiv, chatId);
    }, 500);
  });
  chatDiv.addEventListener("mouseup", () => clearTimeout(longPressTimer));
  chatDiv.addEventListener("mouseleave", () => clearTimeout(longPressTimer));

  chatDiv.addEventListener("touchstart", () => {
    longPressTimer = setTimeout(() => {
      toggleChatSelection(chatDiv, chatId);
    }, 500);
  });
  chatDiv.addEventListener("touchend", () => clearTimeout(longPressTimer));
}

// Toggle chat selection in UI and in set
function toggleChatSelection(chatDiv, chatId) {
  if (selectedChats.has(chatId)) {
    selectedChats.delete(chatId);
    chatDiv.classList.remove("chat-selected");
  } else {
    selectedChats.add(chatId);
    chatDiv.classList.add("chat-selected");
  }

  if (selectedChats.size > 0) {
    showToolbar();
  } else {
    hideToolbar();
  }
}

// Show/hide action toolbar
const actionToolbar = document.getElementById("actionToolbar");
function showToolbar() {
  actionToolbar.classList.remove("hidden");
}
function hideToolbar() {
  actionToolbar.classList.add("hidden");
}

// Clear selection (remove highlights + reset set + hide toolbar)
function clearSelection() {
  selectedChats.clear();
  document.querySelectorAll(".chat-selected").forEach(el => el.classList.remove("chat-selected"));
  hideToolbar();
}

// Toolbar buttons handlers
document.getElementById("pinBtn").addEventListener("click", () => {
  alert(`📌 Pinned chats: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

document.getElementById("deleteBtn").addEventListener("click", () => {
  alert(`❌ Deleted chats: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

document.getElementById("archiveBtn").addEventListener("click", () => {
  alert(`📦 Archived chats: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

document.getElementById("moreBtn").addEventListener("click", () => {
  alert("⋮ More options...");
});

// Select All button behavior
document.getElementById("selectAllBtn").addEventListener("click", () => {
  selectedChats = new Set(allChats.map(c => c._id));
  document.querySelectorAll("#chatList > div").forEach(div => div.classList.add("chat-selected"));
  showToolbar();
});

// Delete All button behavior
document.getElementById("deleteAllBtn").addEventListener("click", () => {
  if (selectedChats.size === 0) {
    alert("No chats selected to delete.");
    return;
  }
  alert(`🗑️ Deleted chats: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

// Add Friend modal controls
function openAddFriendModal() {
  document.getElementById("addFriendModal").classList.remove("hidden");
}
function closeAddFriendModal() {
  document.getElementById("addFriendModal").classList.add("hidden");
}
function confirmAddFriend() {
  const id = document.getElementById("friendIdentifier").value.trim();
  if (!id) return alert("Enter username or Gmail.");

  fetch("/api/users/add-friend", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ identifier: id }),
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) return alert("❌ " + data.error);
    alert("✅ Friend added successfully!");
    closeAddFriendModal();
    fetchChats();
  })
  .catch(() => alert("Error adding friend."));
}

// Add Group modal controls
function openAddGroupModal() {
  document.getElementById("addGroupModal").classList.remove("hidden");
}
function closeAddGroupModal() {
  document.getElementById("addGroupModal").classList.add("hidden");
}
function confirmAddGroupMember() {
  const group = document.getElementById("groupNameInput").value.trim();
  const member = document.getElementById("memberIdentifier").value.trim();
  if (!group || !member) return alert("Fill in all fields.");

  fetch("/api/groups/add-member", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ groupName: group, identifier: member }),
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) return alert("❌ " + data.error);
    alert(`✅ Member added to ${group}!`);
    closeAddGroupModal();
  })
  .catch(() => alert("Error adding member to group."));
}

// Clear selection if click outside chat list and toolbar/buttons
document.body.addEventListener("click", (e) => {
  const chatList = document.getElementById("chatList");
  const targetIsChatListOrToolbar = chatList.contains(e.target) || actionToolbar.contains(e.target);
  const clickedControlBtn = ["selectAllBtn", "deleteAllBtn", "pinBtn", "deleteBtn", "archiveBtn", "moreBtn", "addFriendBtn"].includes(e.target.id);
  if (!targetIsChatListOrToolbar && !clickedControlBtn) {
    clearSelection();
  }
});

// Initial fetch of chats on load
fetchChats();