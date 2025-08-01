document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // Remove the JWT token
      localStorage.removeItem("token");

      // Optionally also remove stored user info
      localStorage.removeItem("username");

      // Redirect to login page
      window.location.href = "/login.html";
    });
  }
});