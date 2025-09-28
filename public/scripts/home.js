document.addEventListener("DOMContentLoaded", () => {
  const addFriendBtn = document.getElementById("addFriendBtn");
  const addFriendModal = document.getElementById("addFriendModal");
  const closeBtn = document.querySelector(".close");

  // Open modal on + button click
  addFriendBtn.addEventListener("click", () => {
    addFriendModal.style.display = "block";
  });

  // Close modal on × click
  closeBtn.addEventListener("click", () => {
    addFriendModal.style.display = "none";
  });

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target === addFriendModal) {
      addFriendModal.style.display = "none";
    }
  });

  // Handle Add Friend form submit
  document.getElementById("addFriendForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("friendUsername").value;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users/add-friend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();
      alert(data.message || "Friend added!");

      addFriendModal.style.display = "none";
      document.getElementById("friendUsername").value = "";
    } catch (err) {
      console.error("Error adding friend:", err);
    }
  });
});