// public/scripts/logout.js

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // Clear all session data
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("receiverId");

      // Redirect to login
      window.location.href = "/login.html";
    });
  }
});