const token = localStorage.getItem("token");
let allChats = [];
let selectedChats = new Set();

const chatListEl = document.getElementById("chatList");
const actionToolbar = document.getElementById("actionToolbar");

// Fetch chats from API and render
async function fetchChats() {
  try {
    const res = await fetch("/api/users/friends-with-last-message", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const chats = await res.json();
    if (!Array.isArray(chats)) return;

    allChats = chats.map(chat => ({
      ...chat,
      lastMessage: chat.lastMessage || "Start chatting...",
      time: new Date(chat.lastMessageTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: chat.unread || 0,
    })).sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));

    displayChats(allChats);
  } catch (error) {
    console.error("❌ Fetch chats failed:", error);
  }
}

// Render chat items
function displayChats(chats) {
  chatListEl.innerHTML = "";

  chats.forEach(chat => {
    const div = document.createElement("div");
    div.className = "flex items-center p-3 hover:bg-[#2c2c2c] cursor-pointer select-none";
    div.dataset.chatId = chat._id;

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

    div.onclick = () => {
      if (selectedChats.size > 0) {
        toggleChatSelection(div, chat._id);
      } else {
        window.location.href = `/private-chat.html?user=${chat._id}`;
      }
    };

    addLongPressListeners(div, chat._id);

    // Highlight if already selected
    if (selectedChats.has(chat._id)) div.classList.add("chat-selected");

    chatListEl.appendChild(div);
  });
}

// Filter chats by search input
function filterChats() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const filtered = allChats.filter(chat =>
    (chat.username || "").toLowerCase().includes(query) ||
    (chat.name || "").toLowerCase().includes(query) ||
    (chat.email || "").toLowerCase().includes(query)
  );
  displayChats(filtered);
}

// Long press multi-select support
let longPressTimer;

function addLongPressListeners(element, chatId) {
  element.addEventListener("mousedown", () => {
    longPressTimer = setTimeout(() => toggleChatSelection(element, chatId), 500);
  });
  element.addEventListener("mouseup", () => clearTimeout(longPressTimer));
  element.addEventListener("mouseleave", () => clearTimeout(longPressTimer));

  element.addEventListener("touchstart", () => {
    longPressTimer = setTimeout(() => toggleChatSelection(element, chatId), 500);
  });
  element.addEventListener("touchend", () => clearTimeout(longPressTimer));
}

// Select/unselect a chat
function toggleChatSelection(element, chatId) {
  if (selectedChats.has(chatId)) {
    selectedChats.delete(chatId);
    element.classList.remove("chat-selected");
  } else {
    selectedChats.add(chatId);
    element.classList.add("chat-selected");
  }
  selectedChats.size > 0 ? showToolbar() : hideToolbar();
}

// Show/hide toolbar
function showToolbar() {
  actionToolbar.classList.remove("hidden");
}
function hideToolbar() {
  actionToolbar.classList.add("hidden");
}

// Clear all selection
function clearSelection() {
  selectedChats.clear();
  document.querySelectorAll(".chat-selected").forEach(el => el.classList.remove("chat-selected"));
  hideToolbar();
}

// Generic API POST helper
async function postApi(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return await res.json();
}

// Toolbar buttons handlers
async function handlePin() {
  if (selectedChats.size === 0) return alert("Select chats first.");
  if (!confirm(`Pin ${selectedChats.size} chat(s)?`)) return;
  try {
    const data = await postApi("/api/chats/pin", { chatIds: [...selectedChats] });
    if (data.error) return alert("❌ " + data.error);
    alert(data.message || "Chats pinned!");
    clearSelection();
    fetchChats();
  } catch {
    alert("Error pinning chats.");
  }
}
async function handleDelete() {
  if (selectedChats.size === 0) return alert("Select chats first.");
  if (!confirm(`Delete ${selectedChats.size} chat(s)? This cannot be undone.`)) return;
  try {
    const data = await postApi("/api/chats/delete", { chatIds: [...selectedChats] });
    if (data.error) return alert("❌ " + data.error);
    alert(data.message || "Chats deleted!");
    clearSelection();
    fetchChats();
  } catch {
    alert("Error deleting chats.");
  }
}
async function handleArchive() {
  if (selectedChats.size === 0) return alert("Select chats first.");
  if (!confirm(`Archive ${selectedChats.size} chat(s)?`)) return;
  try {
    const data = await postApi("/api/chats/archive", { chatIds: [...selectedChats] });
    if (data.error) return alert("❌ " + data.error);
    alert(data.message || "Chats archived!");
    clearSelection();
    fetchChats();
  } catch {
    alert("Error archiving chats.");
  }
}
function handleMore() {
  alert("⋮ More options...");
}

// Select all chats
function selectAllChats() {
  selectedChats = new Set(allChats.map(c => c._id));
  document.querySelectorAll("#chatList > div").forEach(div => div.classList.add("chat-selected"));
  showToolbar();
}
// Delete all selected chats (trigger delete action)
function deleteAllSelected() {
  if (selectedChats.size === 0) {
    alert("No chats selected to delete.");
    return;
  }
  handleDelete();
}

// Add friend modal controls
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

// Add group modal controls
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

// Clear selection if clicking outside chat list or toolbar buttons
document.body.addEventListener("click", (e) => {
  const targetIsChatListOrToolbar = chatListEl.contains(e.target) || actionToolbar.contains(e.target);
  const clickedControlBtn = [
    "selectAllBtn", "deleteAllBtn", "pinBtn", "deleteBtn", "archiveBtn", "moreBtn", "addFriendBtn"
  ].includes(e.target.id);

  if (!targetIsChatListOrToolbar && !clickedControlBtn) {
    clearSelection();
  }
});

// Event listeners
document.getElementById("searchInput").addEventListener("input", filterChats);

document.getElementById("pinBtn").addEventListener("click", handlePin);
document.getElementById("deleteBtn").addEventListener("click", handleDelete);
document.getElementById("archiveBtn").addEventListener("click", handleArchive);
document.getElementById("moreBtn").addEventListener("click", handleMore);
document.getElementById("selectAllBtn").addEventListener("click", selectAllChats);
document.getElementById("deleteAllBtn").addEventListener("click", deleteAllSelected);

// Initial fetch on page load
fetchChats();