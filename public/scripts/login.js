// public/scripts/login.js

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const message = document.getElementById("message");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    message.textContent = "";

    const formData = new FormData(loginForm);
    const email = formData.get("email").trim();
    const password = formData.get("password").trim();

    if (!email || !password) {
      message.style.color = "red";
      message.textContent = "Please enter both email and password.";
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok || !data.token || !data.user) {
        message.style.color = "red";
        message.textContent = data.message || data.error || "Login failed";
        return;
      }

      // Store token and user
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect
      message.style.color = "green";
      message.textContent = "✅ Login successful. Redirecting...";
      setTimeout(() => {
        window.location.href = "/home.html";
      }, 1000);

    } catch (err) {
      console.error("Login error:", err);
      message.style.color = "red";
      message.textContent = "Server error. Please try again later.";
    }
  });
});