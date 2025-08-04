document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgotPasswordForm");
  const message = document.getElementById("message"); // Optional if you're using a message container

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = form.email.value.trim();
    if (!email) {
      displayMessage("Please enter your email address.", "red");
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
        displayMessage(data.message || "✅ Reset link sent to your email.", "lightgreen");
      } else {
        displayMessage(data.message || "❌ Failed to send reset link.", "red");
      }
    } catch (err) {
      console.error("Error:", err);
      displayMessage("❌ Something went wrong. Please try again later.", "red");
    }
  });

  function displayMessage(msg, color) {
    if (message) {
      message.innerText = msg;
      message.style.color = color;
    } else {
      alert(msg); // Fallback if no message container
    }
  }
});