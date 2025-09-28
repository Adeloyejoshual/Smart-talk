// Auth check
const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

// DOM Elements
const chatListEl = document.getElementById("chatList");
const searchInput = document.getElementById("searchInput");
const addFriendBtn = document.getElementById("addFriendBtn");
const addFriendModal = document.getElementById("addFriendModal");
const closeModalBtn = document.getElementById("closeModal");
const confirmAddFriendBtn = document.getElementById("confirmAddFriendBtn");
const friendIdentifierInput = document.getElementById("friendIdentifier");

let friends = [];

// Fetch friends
async function fetchFriends() {
  try {
    const res = await fetch("/api/users/chats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    friends = await res.json();
    renderFriends(friends);
  } catch (err) {
    console.error("Error fetching friends:", err);
  }
}

// Render friends list
function renderFriends(list) {
  chatListEl.innerHTML = "";
  if (!list.length) {
    chatListEl.innerHTML = "<p>No friends yet.</p>";
    return;
  }

  list.forEach(friend => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.innerHTML = `
      <img src="${friend.avatar || '/default-avatar.png'}" class="chat-avatar" />
      <div class="chat-info">
        <span class="name">${friend.username}</span>
        <span class="last-message">${friend.email}</span>
      </div>
    `;
    div.onclick = () => alert("Chat with " + friend.username); // placeholder
    chatListEl.appendChild(div);
  });
}

// Search
searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase();
  renderFriends(friends.filter(f => f.username.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)));
});

// Add Friend Modal
addFriendBtn.addEventListener("click", () => addFriendModal.classList.remove("hidden"));
closeModalBtn.addEventListener("click", () => addFriendModal.classList.add("hidden"));

// Confirm add friend
confirmAddFriendBtn.addEventListener("click", async () => {
  const identifier = friendIdentifierInput.value.trim();
  if (!identifier) return alert("Enter username or email");

  try {
    const res = await fetch("/api/users/add-friend", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ identifier }),
    });
    const data = await res.json();
    alert(data.message || data.error);
    friendIdentifierInput.value = "";
    addFriendModal.classList.add("hidden");
    fetchFriends(); // refresh list
  } catch (err) {
    alert("Failed to add friend");
    console.error(err);
  }
});

// Initial load
fetchFriends();