const socket = io();
const welcomeUser = document.getElementById("welcomeUser");
const userList = document.getElementById("userList");
const addFriendBtn = document.getElementById("addFriendBtn");
const addFriendModal = document.getElementById("addFriendModal");
const closeModal = document.getElementById("closeModal");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const settingsBtn = document.getElementById("settingsBtn");

// Fetch user info from token
async function fetchUserInfo() {
  const token = localStorage.getItem("token");
  if (!token) {
    return location.href = "/login.html";
  }

  try {
    const res = await fetch("/api/users/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) return location.href = "/login.html";
    const data = await res.json();
    welcomeUser.textContent = `Welcome, ${data.username}`;
    loadFriends();
  } catch (err) {
    console.error("User info error", err);
  }
}

// Load friend list
async function loadFriends() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch("/api/users/friends", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const friends = await res.json();

    userList.innerHTML = "";
    if (friends.length === 0) {
      userList.innerHTML = "<li>No friends yet.</li>";
    } else {
      friends.forEach(friend => {
        const li = document.createElement("li");
        li.textContent = friend.username;
        userList.appendChild(li);
      });
    }
  } catch (err) {
    console.error("Error loading friends", err);
  }
}

// Show modal
addFriendBtn.addEventListener("click", () => {
  addFriendModal.classList.remove("hidden");
  searchResults.innerHTML = "";
  searchInput.value = "";
});

// Hide modal
closeModal.addEventListener("click", () => {
  addFriendModal.classList.add("hidden");
});

// Search users
searchInput.addEventListener("input", async () => {
  const query = searchInput.value.trim();
  const token = localStorage.getItem("token");
  if (!query) return (searchResults.innerHTML = "");

  try {
    const res = await fetch(`/api/users/search?q=${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const users = await res.json();
    searchResults.innerHTML = "";

    if (users.length === 0) {
      searchResults.innerHTML = "<li>No users found</li>";
    } else {
      users.forEach(user => {
        const li = document.createElement("li");
        li.textContent = `${user.username} (${user.email})`;

        const addBtn = document.createElement("button");
        addBtn.textContent = "Add";
        addBtn.onclick = () => addFriend(user._id);

        li.appendChild(addBtn);
        searchResults.appendChild(li);
      });
    }
  } catch (err) {
    console.error("Search error", err);
  }
});

// Add friend
async function addFriend(friendId) {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`/api/users/add-friend/${friendId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      alert("Friend added!");
      addFriendModal.classList.add("hidden");
      loadFriends();
    } else {
      const data = await res.json();
      alert(data.message || "Failed to add friend.");
    }
  } catch (err) {
    console.error("Add friend error", err);
  }
}

// Redirect to settings
settingsBtn.addEventListener("click", () => {
  window.location.href = "/settings.html";
});

// Initial
document.addEventListener("DOMContentLoaded", fetchUserInfo);