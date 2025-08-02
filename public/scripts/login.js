document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const message = document.getElementById("message");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    message.textContent = "";

    const formData = new FormData(loginForm);
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        message.textContent = data.error || "Login failed";
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/home.html";
    } catch (err) {
      message.textContent = "Server error";
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    message.textContent = "";

    const formData = new FormData(registerForm);
    const username = formData.get("username");
    const email = formData.get("email");
    const password = formData.get("password");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        message.textContent = data.error || "Registration failed";
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/home.html";
    } catch (err) {
      message.textContent = "Server error";
    }
  });
});

function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}