// public/scripts/login.js

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const message = document.getElementById("message");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    message.textContent = "";

    const formData = new FormData(loginForm);
    const input = formData.get("email").trim(); // Can be email or username
    const password = formData.get("password").trim();

    if (!input || !password) {
      message.style.color = "red";
      message.textContent = "Please enter your username/email and password.";
      return;
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const payload = {
      password,
      ...(isEmail ? { email: input } : { username: input }),
    };

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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