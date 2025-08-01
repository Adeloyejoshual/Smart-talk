document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (response.ok) {
    // Save token and redirect
    localStorage.setItem("token", data.token);
    localStorage.setItem("userId", data.user._id);
    localStorage.setItem("username", data.user.username);
    window.location.href = "/chat.html";
  } else {
    alert(data.message || "Login failed");
  }
});