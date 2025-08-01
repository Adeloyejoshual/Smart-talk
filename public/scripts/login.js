document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = loginForm.email.value;
    const password = loginForm.password.value;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Login failed");
        return;
      }

      // Save token to localStorage
      localStorage.setItem("token", data.token);
      alert("Login successful!");

      // Redirect to home page
      window.location.href = "/home.html";
    } catch (err) {
      console.error("Login error:", err);
      alert("An error occurred. Try again.");
    }
  });
});