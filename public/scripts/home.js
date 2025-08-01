document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const searchBar = document.getElementById("searchBar");
  const userList = document.getElementById("userList");
  const addUserBtn = document.getElementById("addUserBtn");
  const addUserModal = document.getElementById("addUserModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const addFriendForm = document.getElementById("addFriendForm");

  // Fetch logged-in user info
  fetch("/api/users/me", {
    headers: {
      Authorization: localStorage.getItem("token"),
    },
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.username) {
        usernameDisplay.textContent = data.username;
      } else {
        window.location.href = "/login.html";
      }
    })
    .catch(() => {
      window.location.href = "/login.html";
    });

  // Load friends list
  function loadFriends() {
    fetch('/api/users/list', {
      headers: {
        'Authorization': localStorage.getItem('token')
      }
    })
      .then(res => res.json())
      .then(data => {
        userList.innerHTML = ""; // Clear existing list

        if (!data.friends || data.friends.length === 0) {
          userList.innerHTML = "<p>No friends found.</p>";
          return;
        }

        data.friends.forEach(friend => {
          const div = document.createElement("div");
          div.className = "friend-item";
          div.dataset.id = friend._id;
          div.dataset.username = friend.username;

          div.innerHTML = `
            <div class="avatar"></div>
            <div class="info">
              <div class="username">${friend.username}</div>
              <div class="start-chat">Tap to chat</div>
            </div>
          `;

          div.addEventListener("click", () => {
            window.location.href = \`/chat.html?user=${friend._id}\`;
          });

          userList.appendChild(div);
        });
      })
      .catch(error => {
        console.error("Error fetching friends:", error);
        userList.innerHTML = "<p>Failed to load friends.</p>";
      });
  }

  // Call it on page load
  loadFriends();

  // Add friend modal open
  addUserBtn.addEventListener("click", () => {
    addUserModal.style.display = "block";
  });

  // Close modal
  closeModalBtn.addEventListener("click", () => {
    addUserModal.style.display = "none";
  });

  // Add friend form submit
  addFriendForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("friendEmail");
    const email = emailInput.value.trim();

    if (!email) return;

    fetch("/api/users/add-friend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: localStorage.getItem("token"),
      },
      body: JSON.stringify({ email }),
    })
      .then((res) => res.json())
      .then((data) => {
        alert(data.message || "Friend added!");
        emailInput.value = "";
        addUserModal.style.display = "none";
        loadFriends(); // Refresh list
      })
      .catch((error) => {
        console.error("Add friend error:", error);
        alert("Failed to add friend.");
      });
  });

  // Search bar filter (optional enhancement)
  searchBar.addEventListener("input", () => {
    const term = searchBar.value.toLowerCase();
    const items = document.querySelectorAll(".friend-item");
    items.forEach((item) => {
      const username = item.dataset.username.toLowerCase();
      item.style.display = username.includes(term) ? "flex" : "none";
    });
  });
});