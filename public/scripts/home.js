// Auth check
const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

// DOM elements
const chatListEl = document.getElementById("chatList");
const searchInput = document.getElementById("searchInput");
const addFriendBtn = document.getElementById("addFriendBtn");
const addFriendModal = document.getElementById("addFriendModal");
const closeModalBtn = document.getElementById("closeModal");
const confirmAddFriendBtn = document.getElementById("confirmAddFriendBtn");
const friendIdentifierInput = document.getElementById("friendIdentifier");

let allChats = [];

// ====================
// Fetch friends
// ====================
async function fetchChats() {
  try {
    const res = await fetch("/api/users/chats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const friends = await res.json();
    allChats = Array.isArray(friends) ? friends : [];
    renderChats(allChats);
  } catch (err) {
    console.error("Failed to fetch friends:", err);
  }
}

// ====================
// Render friends
// ====================
function renderChats(list) {
  const data = list || allChats;
  chatListEl.innerHTML = "";

  if (!data.length) {
    chatListEl.innerHTML = `<p class="text-center text-gray-500 mt-10">No friends yet.</p>`;
    return;
  }

  data.forEach(friend => {
    const div = document.createElement("div");
    div.className = "chat-item flex items-center p-3 hover:bg-[#2c2c2c] cursor-pointer select-none";
    div.dataset.id = friend._id;

    div.addEventListener("click", () => {
      window.location.href = `/chat.html?user=${friend._id}`;
    });

    div.innerHTML = `
      <img src="${friend.avatar || '/default-avatar.png'}" class="chat-avatar mr-3" />
      <div class="chat-info">
        <div class="name">${friend.username}</div>
      </div>
    `;
    chatListEl.appendChild(div);
  });
}

// ====================
// Search
// ====================
searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase();
  const filtered = allChats.filter(f => f.username.toLowerCase().includes(q));
  renderChats(filtered);
});

// ====================
// Add Friend Modal
// ====================
addFriendBtn.addEventListener("click", () => addFriendModal.classList.remove("hidden"));
closeModalBtn.addEventListener("click", () => addFriendModal.classList.add("hidden"));

confirmAddFriendBtn.addEventListener("click", async () => {
  const identifier = friendIdentifierInput.value.trim();
  if (!identifier) return alert("Enter username or email");

  try {
    const res = await fetch("/api/users/add-friend", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifier }),
    });

    const data = await res.json();
    if (data.message) {
      alert(data.message);
      friendIdentifierInput.value = "";
      addFriendModal.classList.add("hidden");
      await fetchChats(); // Refresh list
    } else if (data.error) {
      alert(data.error);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to add friend");
  }
});

// ====================
// Initial load
// ====================
fetchChats();