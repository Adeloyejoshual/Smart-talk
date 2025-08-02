document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = registerForm.username.value.trim();
    const email = registerForm.email.value.trim();
    const password = registerForm.password.value.trim();

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Registration failed");
        return;
      }

      // ✅ Store token and user in localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      alert("Registration successful!");

      // ✅ Redirect to home
      window.location.href = "/home.html";
    } catch (err) {
      console.error("Register error:", err);
      alert("An error occurred. Please try again.");
    }
  });
});