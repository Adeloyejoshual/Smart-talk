// public/forgot-password.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgotPasswordForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();

    if (!email) {
      alert("Please enter your email address.");
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Reset link sent to your email.");
      } else {
        alert(data.message || "Failed to send reset link.");
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Something went wrong. Please try again later.");
    }
  });
});