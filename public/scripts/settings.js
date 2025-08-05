document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const avatarInput = document.getElementById("avatar-input");
  const avatarWrapper = document.getElementById("avatar-wrapper");
  const avatarImg = document.getElementById("avatar-img");
  const usernameDisplay = document.getElementById("username-display");

  // Load user data
  fetch("/api/users/me", {
    headers: { Authorization: "Bearer " + token },
  })
    .then((res) => res.json())
    .then((user) => {
      usernameDisplay.textContent = user.username || "User";
      if (user.avatar) {
        avatarImg.src = user.avatar;
      }
    });

  // Open file picker on avatar click
  avatarWrapper.addEventListener("click", () => {
    avatarInput.click();
  });

  // Handle image upload
  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    fetch("/api/users/upload-avatar", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.avatar) {
          avatarImg.src = data.avatar;
        }
      })
      .catch(() => alert("Upload failed"));
  });
});