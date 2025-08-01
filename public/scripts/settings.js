// public/scripts/settings.js

async function updateUsername() {
  const newUsername = document.getElementById("newUsernameInput").value;
  const statusEl = document.getElementById("usernameStatus");

  if (!newUsername.trim()) {
    statusEl.textContent = "Username cannot be empty.";
    statusEl.style.color = "red";
    return;
  }

  try {
    const res = await fetch("/api/users/update-username", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: newUsername }),
    });

    const data = await res.json();
    if (res.ok) {
      statusEl.textContent = "Username updated successfully!";
      statusEl.style.color = "green";
    } else {
      statusEl.textContent = data.message || "Failed to update username.";
      statusEl.style.color = "red";
    }
  } catch (error) {
    console.error("Error updating username:", error);
    statusEl.textContent = "An error occurred.";
    statusEl.style.color = "red";
  }
}