const socket = io();
const userList = document.getElementById("userList");
const welcomeUser = document.getElementById("welcomeUser");
const addFriendBtn = document.getElementById("addFriendBtn");
const addFriendModal = document.getElementById("addFriendModal");
const closeModal = document.getElementById("closeModal");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) return (window.location.href = "/login.html");

  try {
    // Load current user
    const resMe = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = await resMe.json();
    welcomeUser.textContent = `Welcome, ${user.username}!`;

    // Load friends list
    const resFriends = await fetch("/api/users/friends", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const friends = await resFriends.json();
    renderUserList(friends);
  } catch (err) {
    console.error("Error loading user:", err);
  }
});

function renderUserList(users) {
  userList.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${u.username}</span>
    `;
    userList.appendChild(li);
  });
}

// Open modal
addFriendBtn.onclick = () => {
  addFriendModal.classList.remove("hidden");
  searchInput.value = "";
  searchResults.innerHTML = "";
};

// Close modal
closeModal.onclick = () => {
  addFriendModal.classList.add("hidden");
};

// Search users
searchInput.addEventListener("input", async () => {
  const query = searchInput.value.trim();
  if (!query) return (searchResults.innerHTML = "");

  const token = localStorage.getItem("token");
  const res = await fetch(`/api/users/search?q=${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const users = await res.json();

  searchResults.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${user.username}</span>
      <button onclick="addFriend('${user._id}', this)">Add</button>
    `;
    searchResults.appendChild(li);
  });
});

// Add friend
async function addFriend(id, btn) {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`/api/users/add-friend/${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      btn.textContent = "Added";
      btn.disabled = true;
    } else {
      alert("Failed to add friend");
    }
  } catch (err) {
    alert("Error adding friend");
  }
}