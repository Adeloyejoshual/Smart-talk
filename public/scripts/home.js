const token = localStorage.getItem("token");
if(!token) window.location.href="/login.html";

let allChats = [], allGroups = [], selectedChats = new Set();
let activeTab = "chats";

const chatListEl = document.getElementById("chatList");
const tabChats = document.getElementById("tabChats");
const tabGroups = document.getElementById("tabGroups");
const actionToolbar = document.getElementById("actionToolbar");

// Tab switching
tabChats.addEventListener("click", () => switchTab("chats"));
tabGroups.addEventListener("click", () => switchTab("groups"));

function switchTab(tab){
  activeTab = tab;
  if(tab === "chats"){
    tabChats.classList.add("tab-active");
    tabGroups.classList.remove("tab-active");
    displayChats(allChats);
  } else {
    tabGroups.classList.add("tab-active");
    tabChats.classList.remove("tab-active");
    displayChats(allGroups);
  }
  clearSelection();
}

// Fetch chats & groups
async function fetchChats(){
  try{
    const resChats = await fetch("/api/users/friends-with-last-message", { headers:{ Authorization:`Bearer ${token}` } });
    const chats = await resChats.json();
    allChats = chats.map(c => ({
      ...c,
      lastMessage: c.lastMessage || "Start chatting...",
      time: new Date(c.lastMessageTime || Date.now()).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
      unread: c.unread || 0
    })).sort((a,b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
  } catch(e){ console.error(e); }

  try{
    const resGroups = await fetch("/api/groups/my-groups", { headers:{ Authorization:`Bearer ${token}` } });
    const groups = await resGroups.json();
    allGroups = groups.map(g => ({
      ...g,
      lastMessage: g.lastMessage || "No messages yet",
      time: new Date(g.lastMessageTime || Date.now()).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
      unread: g.unread || 0
    })).sort((a,b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
  } catch(e){ console.error(e); }

  switchTab(activeTab);
}

// Display chats/groups
function displayChats(list){
  chatListEl.innerHTML = "";
  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "flex items-center p-3 hover:bg-[#2c2c2c] cursor-pointer select-none";
    div.dataset.id = item._id;

    div.onclick = () => {
      if(selectedChats.size > 0) toggleChatSelection(div, item._id);
      else window.location.href = activeTab==="chats"?`/private-chat.html?user=${item._id}`:`/group-chat.html?group=${item._id}`;
    };

    div.innerHTML = `
      <img src="${item.avatar || '/default-avatar.png'}" class="w-10 h-10 rounded-full mr-3 border border-gray-600" />
      <div class="flex-1">
        <div class="flex justify-between items-center">
          <span class="font-semibold text-white text-base">${item.username||item.name||item.groupName}</span>
          <span class="text-xs text-gray-500">${item.time}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-gray-400 truncate">${item.lastMessage}</span>
          ${item.unread > 0 ? `<span class="bg-red-500 text-xs text-white px-2 rounded-full">${item.unread}</span>` : ""}
        </div>
      </div>
    `;

    addLongPressListeners(div, item._id);
    if(selectedChats.has(item._id)) div.classList.add("chat-selected");
    chatListEl.appendChild(div);
  });
}

// Search
document.getElementById("searchInput").addEventListener("input", () => {
  const q = document.getElementById("searchInput").value.toLowerCase();
  const list = activeTab==="chats"?allChats:allGroups;
  displayChats(list.filter(item => (item.username||item.name||"").toLowerCase().includes(q)));
});

// Long press for multi-select
let longPressTimer;
function addLongPressListeners(div,id){
  div.addEventListener("mousedown", ()=>{ longPressTimer=setTimeout(()=>toggleChatSelection(div,id),500); });
  div.addEventListener("mouseup", ()=>clearTimeout(longPressTimer));
  div.addEventListener("mouseleave", ()=>clearTimeout(longPressTimer));
  div.addEventListener("touchstart", ()=>{ longPressTimer=setTimeout(()=>toggleChatSelection(div,id),500); });
  div.addEventListener("touchend", ()=>clearTimeout(longPressTimer));
}

// Toggle selection
function toggleChatSelection(div,id){
  if(selectedChats.has(id)){ selectedChats.delete(id); div.classList.remove("chat-selected"); }
  else { selectedChats.add(id); div.classList.add("chat-selected"); }
  actionToolbar.classList.toggle("hidden", selectedChats.size === 0);
}
function clearSelection(){
  selectedChats.clear();
  document.querySelectorAll(".chat-selected").forEach(el => el.classList.remove("chat-selected"));
  actionToolbar.classList.add("hidden");
}

// Toolbar buttons
document.getElementById("pinBtn").addEventListener("click", () => { alert(`📌 Pinned: ${[...selectedChats].join(", ")}`); clearSelection(); });
document.getElementById("deleteBtn").addEventListener("click", () => { alert(`❌ Deleted: ${[...selectedChats].join(", ")}`); clearSelection(); });
document.getElementById("archiveBtn").addEventListener("click", () => { alert(`📦 Archived: ${[...selectedChats].join(", ")}`); clearSelection(); });
document.getElementById("moreBtn").addEventListener("click", () => { alert("⋮ More options..."); });

// Select / Delete All
document.getElementById("selectAllBtn").addEventListener("click", () => {
  const list = activeTab==="chats"?allChats:allGroups;
  selectedChats = new Set(list.map(c=>c._id));
  document.querySelectorAll("#chatList > div").forEach(div=>div.classList.add("chat-selected"));
  actionToolbar.classList.remove("hidden");
});
document.getElementById("deleteAllBtn").addEventListener("click", () => {
  if(selectedChats.size===0){ alert("No chats selected."); return; }
  alert(`🗑️ Deleted: ${[...selectedChats].join(", ")}`);
  clearSelection();
});

// Add Friend Modal
function openAddFriendModal(){ document.getElementById("addFriendModal").classList.remove("hidden"); }
function closeAddFriendModal(){ document.getElementById("addFriendModal").classList.add("hidden"); }
function confirmAddFriend(){
  const id = document.getElementById("friendIdentifier").value.trim();
  if(!id) return alert("Enter username or Gmail.");
  fetch("/api/users/add-friend", {
    method:"POST",
    headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
    body: JSON.stringify({ identifier: id })
  }).then(res => res.json())
    .then(data => {
      if(data.error) return alert("❌ " + data.error);
      alert("✅ Friend added!");
      closeAddFriendModal();
      fetchChats(); // Refresh chat list immediately
    }).catch(()=>alert("Error adding friend."));
}

// Initial fetch
fetchChats();