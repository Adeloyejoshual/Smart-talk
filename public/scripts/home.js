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

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return (window.location.href = "/login.html");

  usernameDisplay.textContent = user.username;
  fetchUsers("");

  searchBar.addEventListener("input", () => {
    fetchUsers(searchBar.value.trim());
  });

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
            div.innerHTML = `
              <span>${u.username} (${u.email})</span>
              <button class="add-friend-btn" data-id="${u._id}">Add Friend</button>
            `;
            userList.appendChild(div);
          });

          document.querySelectorAll(".add-friend-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
              const targetUserId = btn.getAttribute("data-id");
              try {
                const res = await fetch("/api/users/add", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    currentUserId: user._id,
                    targetUserId
                  })
                });

                const result = await res.json();
                if (res.ok) {
                  alert(result.message);
                } else {
                  alert(result.message || "Failed to add friend");
                }
              } catch (err) {
                alert("Network error");
              }
            });
          });
        }
      })
      .catch(() => {
        userList.innerHTML = "<p>Failed to load users</p>";
      });
  }

  addUserBtn.addEventListener("click", () => {
    addUserModal.classList.remove("hidden");
  });

  closeModal.addEventListener("click", () => {
    addUserModal.classList.add("hidden");
    createUserForm.reset();
  });

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

  darkToggle.addEventListener("change", () => {
    const theme = darkToggle.checked ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  });

  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  darkToggle.checked = savedTheme === "dark";
});