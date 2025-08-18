// public/scripts/admin-login.js
document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const passcode = document.getElementById("passcode").value.trim();

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, passcode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");
    localStorage.setItem("adminToken", data.token);
    window.location.href = "/admin-dashboard.html";
  } catch (err) {
    const el = document.getElementById("error");
    el.textContent = err.message;
    el.classList.remove("hidden");
  }
});
