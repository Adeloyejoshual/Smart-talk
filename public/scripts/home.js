// ==============================
// Add Friend Modal
// ==============================
addFriendBtn.addEventListener("click", () => {
  addFriendModal.classList.remove("hidden");
});

closeModalBtn.addEventListener("click", () => {
  addFriendModal.classList.add("hidden");
  friendIdentifierInput.value = "";
});

// Close modal when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === addFriendModal) {
    addFriendModal.classList.add("hidden");
    friendIdentifierInput.value = "";
  }
});

confirmAddFriendBtn.addEventListener("click", () => {
  const id = friendIdentifierInput.value.trim();
  if (!id) {
    alert("Enter username or Gmail");
    return;
  }

  fetch("/api/users/add-friend", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ identifier: id }),
  })
    .then(res => res.json())
    .then(async data => {
      if (data.error) {
        alert(data.error);
        return;
      }
      alert("Friend added!");
      addFriendModal.classList.add("hidden");
      friendIdentifierInput.value = "";
      await fetchChats(); // reload chat list
    })
    .catch(() => alert("Error adding friend."));
});

// ==============================
// Settings
// ==============================
settingsBtn.addEventListener("click", () => window.location.href = "/settings.html");