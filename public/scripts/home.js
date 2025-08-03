const socket = io();
const welcomeUser = document.getElementById("welcomeUser");
const userList = document.getElementById("userList");
const addFriendBtn = document.getElementById("addFriendBtn");
const addFriendModal = document.getElementById("addFriendModal");
const closeModal = document.getElementById("closeModal");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const settingsBtn = document.getElementById("settingsBtn");

// Load current user and friends
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/api/users/me", {
      headers: { Authorization: localStorage.getItem("token") }
    });
    if (!res.ok) throw new Error("Unauthorized");
    const user = await res.json();
    welcomeUser.textContent = `Welcome, ${user.username}!`;

    // Show friends
    const friendsRes = await fetch("/api/users/list", {
      headers: { Authorization: localStorage.getItem("token") }
    });
    const friends = await friendsRes.json();
    userList.innerHTML = "";
    friends.forEach(friend => {
      const li = document.createElement("li");
      li.textContent = friend.username;
      userList.appendChild(li);
    });
  } catch (err) {
    window.location.href = "/login.html";
  }
});

// Show modal
addFriendBtn.addEventListener("click", () => {
  addFriendModal.classList.remove("hidden");
  searchInput.value = "";
  searchResults.innerHTML = "";
});

// Hide modal
closeModal.addEventListener("click", () => {
  addFriendModal.classList.add("hidden");
});

// Search users
searchInput.addEventListener("input", async () => {
  const query = searchInput.value.trim();
  if (query.length === 0) {
    searchResults.innerHTML = "";
    return;
  }

  const res = await fetch(`/api/users/search?q=${query}`, {
    headers: { Authorization: localStorage.getItem("token") }
  });

  const users = await res.json();
  searchResults.innerHTML = "";

  users.forEach(user => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${user.username} (${user.email}) 
      <button class="addBtn" data-id="${user._id}">Add</button>
    `;
    searchResults.appendChild(li);
  });
});

// Add friend
searchResults.addEventListener("click", async (e) => {
  if (e.target.classList.contains("addBtn")) {
    const userId = e.target.dataset.id;
    await fetch("/api/users/add-friend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("token")
      },
      body: JSON.stringify({ friendId: userId })
    });

    e.target.parentElement.remove(); // Remove from list after adding
    alert("Friend added!");
  }
});

// Go to settings
settingsBtn.addEventListener("click", () => {
  window.location.href = "/settings.html";
});