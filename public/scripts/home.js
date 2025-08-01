document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");

  if (!token) {
    // No token = user not logged in
    window.location.href = "/login.html";
    return;
  }

  // Optional: validate token with backend
  fetch("/api/users/profile", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(res => {
      if (!res.ok) {
        throw new Error("Invalid token");
      }
      return res.json();
    })
    .then(data => {
      console.log("Welcome:", data.user.username);
      document.getElementById("usernameDisplay").textContent = data.user.username;
    })
    .catch(err => {
      console.error("Redirecting due to invalid token:", err);
      localStorage.removeItem("token");
      window.location.href = "/login.html";
    });
});

  // Load username from localStorage or session
  const username = localStorage.getItem("username");
  if (username) {
    usernameDisplay.textContent = username;
  }

  // Toggle settings
  settingsBtn.addEventListener("click", () => {
    settingsSection.classList.toggle("show");
  });

  // Hide settings if clicked outside
  document.addEventListener("click", (e) => {
    if (!settingsBtn.contains(e.target) && !settingsSection.contains(e.target)) {
      settingsSection.classList.remove("show");
    }
  });

  // Load users
  async function loadUsers() {
    const res = await fetch("/api/users/list");
    const users = await res.json();
    displayUsers(users);
  }

  function displayUsers(users) {
    userList.innerHTML = "";
    users.forEach(user => {
      if (user.username !== username) {
        const li = document.createElement("li");
        li.textContent = user.username;
        li.style.padding = "10px";
        li.style.borderBottom = "1px solid #333";
        li.style.cursor = "pointer";
        li.addEventListener("click", () => {
          window.location.href = `/chat.html?to=${user.username}`;
        });
        userList.appendChild(li);
      }
    });
  }

  searchBar.addEventListener("input", async () => {
    const term = searchBar.value.trim();
    const res = await fetch(`/api/users/search?term=${term}`);
    const users = await res.json();
    displayUsers(users);
  });

  loadUsers();
});