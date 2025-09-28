// ==============================
// Auth Check
// ==============================
const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

// ==============================
// State
// ==============================
let allFriends = [];
let selectedFriend = null;

// ==============================
// DOM Elements
// ==============================
const chatListEl = document.getElementById("chatList");
const searchInput = document.getElementById("searchInput");
const addFriendBtn = document.getElementById("addFriendBtn");
const addFriendModal = document.getElementById("addFriendModal");
const closeModalBtn = document.getElementById("closeModal");
const confirmAddFriendBtn = document.getElementById("confirmAddFriendBtn");
const friendIdentifierInput = document.getElementById("friendIdentifier");
const settingsBtn = document.getElementById("settingsBtn");

// ==============================
// Fetch Friends
// ==============================
async function fetchFriends() {
  try {
    const res = await fetch("/api/users/friends", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const friends = await res.json();
    if (Array.isArray(friends)) {
      allFriends = friends;
      renderFriends(allFriends);
    }
  } catch (err) {
    console.error("Error fetching friends:", err);
  }
}

// ==============================
// Render Friends
// ==============================
function renderFriends(friends) {
  chatListEl.innerHTML = "";
  if (!friends || friends.length === 0) {
    chatListEl.innerHTML = `<p style="color:#999; text-align:center; margin-top:1rem;">No friends yet.</p>`;
    return;
  }

  friends.forEach(friend => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.innerHTML = `
      <img class="chat-avatar" src="${friend.avatar || '/default-avatar.png'}" />
      <div class="chat-info">
        <div class="name">${friend.username}</div>
        <div class="last-message">${friend.email}</div>
      </div>
    `;
    div.addEventListener("click", () => {
      window.location.href = `/private-chat.html?user=${friend._id}`;
    });
    chatListEl.appendChild(div);
  });
}

// ==============================
// Search
// ==============================
searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase();
  const filtered = allFriends.filter(f =>
    f.username.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)
  );
  renderFriends(filtered);
});

// ==============================
// Add Friend Modal
// ==============================
addFriendBtn.addEventListener("click", () => {
  addFriendModal.style.display = "flex";
});

closeModalBtn.addEventListener("click", () => {
  addFriendModal.style.display = "none";
  friendIdentifierInput.value = "";
});

confirmAddFriendBtn.addEventListener("click", async () => {
  const identifier = friendIdentifierInput.value.trim();
  if (!identifier) {
    alert("Enter username or email");
    return;
  }

  try {
    const res = await fetch("/api/users/add-friend-by-identifier", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ identifier })
    });
    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    alert("Friend added!");
    addFriendModal.style.display = "none";
    friendIdentifierInput.value = "";
    fetchFriends(); // Refresh friend list
  } catch (err) {
    alert("Failed to add friend.");
    console.error(err);
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
fetchFriends();