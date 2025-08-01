const addFriendBtn = document.getElementById("addFriendBtn");
const addUserModal = document.getElementById("addUserModal");
const confirmAddFriend = document.getElementById("confirmAddFriend");
const cancelAddFriend = document.getElementById("cancelAddFriend");
const friendInput = document.getElementById("friendInput");

// Show modal
addFriendBtn.addEventListener("click", () => {
  addUserModal.classList.remove("hidden");
  friendInput.value = "";
});

// Cancel modal
cancelAddFriend.addEventListener("click", () => {
  addUserModal.classList.add("hidden");
});

// Add friend logic
confirmAddFriend.addEventListener("click", async () => {
  const friendIdentifier = friendInput.value.trim();
  const token = localStorage.getItem("token");

  if (!friendIdentifier || !token) {
    alert("Please enter a valid friend and make sure you're logged in.");
    return;
  }

  try {
    const res = await fetch("/api/users/add-friend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ identifier: friendIdentifier })
    });

    const data = await res.json();
    if (res.ok) {
      alert(data.message || "Friend added successfully!");
      addUserModal.classList.add("hidden");
      location.reload(); // Reload to update friend list
    } else {
      alert(data.message || "Failed to add friend");
    }
  } catch (err) {
    console.error(err);
    alert("An error occurred.");
  }
});