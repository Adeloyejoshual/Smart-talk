document.addEventListener("DOMContentLoaded", () => {
  const addFriendBtn = document.getElementById("addFriendBtn");
  const addFriendModal = document.getElementById("addFriendModal");
  const closeModal = document.getElementById("closeModal");
  const confirmAddFriendBtn = document.getElementById("confirmAddFriendBtn");
  const friendIdentifier = document.getElementById("friendIdentifier");
  const friendMessage = document.getElementById("friendMessage");

  // ✅ Open modal
  addFriendBtn.addEventListener("click", () => {
    addFriendModal.classList.remove("hidden");
  });

  // ✅ Close modal
  closeModal.addEventListener("click", () => {
    addFriendModal.classList.add("hidden");
    friendMessage.textContent = "";
    friendIdentifier.value = "";
  });

  // ✅ Click outside modal closes it
  window.addEventListener("click", (e) => {
    if (e.target === addFriendModal) {
      addFriendModal.classList.add("hidden");
      friendMessage.textContent = "";
      friendIdentifier.value = "";
    }
  });

  // ✅ Handle Add Friend request
  confirmAddFriendBtn.addEventListener("click", async () => {
    const identifier = friendIdentifier.value.trim();
    if (!identifier) {
      friendMessage.textContent = "Please enter a username or Gmail.";
      return;
    }

    try {
      const token = localStorage.getItem("token"); // Assuming user login saves token
      const res = await fetch("/api/users/add-friend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ identifier }),
      });

      const data = await res.json();
      if (!res.ok) {
        friendMessage.textContent = data.message || "Failed to add friend.";
      } else {
        friendMessage.textContent = "Friend request sent ✅";
        friendMessage.classList.remove("text-red-500");
        friendMessage.classList.add("text-green-500");
        setTimeout(() => {
          addFriendModal.classList.add("hidden");
          friendMessage.textContent = "";
          friendIdentifier.value = "";
        }, 1500);
      }
    } catch (err) {
      console.error("Error adding friend:", err);
      friendMessage.textContent = "Something went wrong.";
    }
  });
});