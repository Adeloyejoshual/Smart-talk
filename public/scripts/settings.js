// public/scripts/settings.js

document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const storedUsername = localStorage.getItem("username");

  if (usernameDisplay && storedUsername) {
    usernameDisplay.textContent = storedUsername;
  }
});

function updateUsername() {
  const newUsername = document.getElementById("newUsernameInput").value.trim();
  const userId = localStorage.getItem("userId");

  if (!newUsername || !userId) {
    alert("Please enter a valid username.");
    return;
  }

  fetch("/api/users/settings/username", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ userId, newUsername })
  })
    .then((res) => res.json())
    .then((data) => {
      const status = document.getElementById("usernameStatus");
      if (data.username) {
        localStorage.setItem("username", data.username);
        status.style.color = "green";
        status.textContent = "Username updated to: " + data.username;
        document.getElementById("usernameDisplay").textContent = data.username;
      } else {
        status.style.color = "red";
        status.textContent = data.message || "Failed to update username.";
      }
    })
    .catch((error) => {
      console.error("Error updating username:", error);
    });
}