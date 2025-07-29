// public/scripts/home.js
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

  // Load current user
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return (window.location.href = "/login.html");

  usernameDisplay.textContent = user.username;

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
        if (data.length === 0) {
          userList.innerHTML = "<p>No users found</p>";
        } else {
          data.forEach(u => {
            const div = document.createElement("div");
            div.className = "user";
            div.textContent = `${u.username} (${u.email})`;
            userList.appendChild(div);
          });
        }
      })
      .catch(() => {
        userList.innerHTML = "<p>Failed to load users</p>";
      });
  }

  // Show Add User modal
  addUserBtn.addEventListener("click", () => {
    addUserModal.classList.remove("hidden");
  });

  // Close modal
  closeModal.addEventListener("click", () => {
    addUserModal.classList.add("hidden");
    createUserForm.reset();
  });

  // Handle Add User form
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
        fetchUsers(searchBar.value.trim()); // Refresh list
      } else {
        alert(data.message || "Failed to add user.");
      }
    } catch (error) {
      alert("Network error. Try again.");
    }
  });

  // Dark mode toggle
  darkToggle.addEventListener("change", () => {
    const theme = darkToggle.checked ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  });

  // Set theme on load
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  darkToggle.checked = savedTheme === "dark";
});
