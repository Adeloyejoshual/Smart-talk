document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const searchBar = document.getElementById("searchBar");
  const userList = document.getElementById("userList");
  const addUserBtn = document.getElementById("addUserBtn");
  const addUserModal = document.getElementById("addUserModal");
  const closeModal = document.getElementById("closeModal");
  const createUserForm = document.getElementById("createUserForm");
  const settingsBtn = document.getElementById("settingsBtn");
  const darkToggle = document.getElementById("darkModeToggle");
  const addFriendBtn = document.getElementById("addFriendBtn");

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return (window.location.href = "/login.html");

  usernameDisplay.textContent = user.username;

  let selectedUserId = null;

  // Load users initially
  fetchUsers("");

  // Search listener
  searchBar.addEventListener("input", () => {
    fetchUsers(searchBar.value.trim());
  });

  // Fetch users
  function fetchUsers(search) {
    fetch(`/api/users?search=${search}&current=${user.username}`)
      .then(res => res.json())
      .then(data => {
        userList.innerHTML = "";
        selectedUserId = null;
        addFriendBtn.disabled = true;

        if (data.length === 0) {
          userList.innerHTML = "<p>No users found</p>";
        } else {
          data.forEach(u => {
            const div = document.createElement("div");
            div.className = "user";
            div.textContent = `${u.username} (${u.email})`;
            div.dataset.userId = u._id;

            div.addEventListener("click", () => {
              const allUsers = document.querySelectorAll(".user");
              allUsers.forEach(el => el.classList.remove("selected"));
              div.classList.add("selected");
              selectedUserId = u._id;
              addFriendBtn.disabled = false;
            });

            userList.appendChild(div);
          });
        }
      })
      .catch(() => {
        userList.innerHTML = "<p>Failed to load users</p>";
      });
  }

  // Handle Add Friend
  addFriendBtn.addEventListener("click", async () => {
    if (!selectedUserId) return alert("Select a user first.");

    try {
      const res = await fetch("/api/users/add-friend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user._id,
          friendId: selectedUserId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Friend added successfully!");
        fetchUsers(searchBar.value.trim()); // refresh
      } else {
        alert(data.message || "Failed to add friend.");
      }
    } catch (err) {
      alert("Network error. Try again.");
    }
  });

  // Show Add User modal
  addUserBtn.addEventListener("click", () => {
    addUserModal.classList.remove("hidden");
  });

  // Close modal
  closeModal.addEventListener("click", () => {
    addUserModal.classList.add("hidden");
    createUserForm.reset();
  });

  // Handle Create User
  createUserForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(createUserForm);
    const newUser = {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password")
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser)
      });

      const data = await res.json();

      if (res.ok) {
        alert("User added successfully!");
        addUserModal.classList.add("hidden");
        createUserForm.reset();
        fetchUsers(searchBar.value.trim());
      } else {
        alert(data.message || "Failed to add user.");
      }
    } catch (error) {
      alert("Network error. Try again.");
    }
  });

  // Theme toggle
  darkToggle.addEventListener("change", () => {
    const theme = darkToggle.checked ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  });

  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  darkToggle.checked = savedTheme === "dark";
});