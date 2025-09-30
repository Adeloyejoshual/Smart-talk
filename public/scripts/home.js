const token = localStorage.getItem("token") || prompt("Enter your JWT token");

const addFriendBtn = document.getElementById("addFriendBtn");
const addFriendModal = document.getElementById("addFriendModal");
const modalOverlay = document.getElementById("modalOverlay");
const closeModalBtn = document.getElementById("closeModal");
const confirmAddFriendBtn = document.getElementById("confirmAddFriendBtn");
const friendIdentifierInput = document.getElementById("friendIdentifier");
const chatListEl = document.getElementById("chatList");
const settingsBtn = document.getElementById("settingsBtn");

// Open/Close Modal
function openModal() {
  addFriendModal.style.display = "block";
  modalOverlay.style.display = "block";
  friendIdentifierInput.focus();
}
function closeModal() {
  addFriendModal.style.display = "none";
  modalOverlay.style.display = "none";
}

addFriendBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

// Add Friend
confirmAddFriendBtn.addEventListener("click", async () => {
  const identifier = friendIdentifierInput.value.trim();
  if (!identifier) return alert("Enter username or email");

  try {
    const res = await fetch("/api/users/add-friend", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ identifier })
    });
    const data = await res.json();
    if (data.message) {
      alert(data.message);
      friendIdentifierInput.value = "";
      closeModal();
      await fetchFriends();
    } else if (data.error) {
      alert(data.error);
    }
  } catch (err) {
    alert("Failed to add friend");
    console.error(err);
  }
});

// Fetch Friends with last message
async function fetchFriends() {
  try {
    const res = await fetch("/api/users/chats", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const friends = await res.json();
    chatListEl.innerHTML = "";
    if (!friends.length) {
      chatListEl.innerHTML = "<p>No friends yet.</p>";
      return;
    }
    friends.forEach(f => {
      const div = document.createElement("div");
      div.className = "chat-item";

      const name = document.createElement("div");
      name.className = "chat-username";
      name.textContent = f.username;

      const lastMsg = document.createElement("div");
      lastMsg.className = "chat-last-message";
      lastMsg.textContent = f.lastMessage ? f.lastMessage.content : "No messages yet";

      div.appendChild(name);
      div.appendChild(lastMsg);

      div.onclick = () => window.location.href = `/private-chat.html?user=${f._id}`;
      chatListEl.appendChild(div);
    });
  } catch (err) {
    console.error("Failed to fetch friends", err);
  }
}

// Settings Button
settingsBtn.addEventListener("click", () => {
  window.location.href = "/settings.html";
});

// Initial load
fetchFriends();