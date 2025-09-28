document.addEventListener("DOMContentLoaded", () => {
  const addFriendBtn = document.getElementById("addFriendBtn");
  const addFriendModal = document.getElementById("addFriendModal");
  const closeBtn = document.querySelector(".close");
  const loggedInUser = document.getElementById("loggedInUser");
  const friendsList = document.getElementById("friendsList");

  // Load logged-in user info
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("username");
  if (user) loggedInUser.textContent = user;

  // Open modal
  addFriendBtn.addEventListener("click", () => {
    addFriendModal.style.display = "block";
  });

  // Close modal (× button)
  closeBtn.addEventListener("click", () => {
    addFriendModal.style.display = "none";
  });

  // Close modal (outside click)
  window.addEventListener("click", (e) => {
    if (e.target === addFriendModal) {
      addFriendModal.style.display = "none";
    }
  });

  // Handle Add Friend form submit
  document.getElementById("addFriendForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("friendUsername").value;

    try {
      const res = await fetch("/api/users/add-friend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();
      alert(data.message || "Friend added!");

      addFriendModal.style.display = "none";
      document.getElementById("friendUsername").value = "";
      loadFriends(); // refresh list
    } catch (err) {
      console.error("Error adding friend:", err);
    }
  });

  // Load friends from API
  async function loadFriends() {
    try {
      const res = await fetch("/api/users/friends", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      friendsList.innerHTML = "";
      if (data.friends && data.friends.length > 0) {
        data.friends.forEach(friend => {
          const li = document.createElement("li");
          li.textContent = friend.username || friend.email;
          friendsList.appendChild(li);
        });
      } else {
        friendsList.innerHTML = "<li>No friends yet</li>";
      }
    } catch (err) {
      console.error("Error loading friends:", err);
    }
  }

  loadFriends();
});