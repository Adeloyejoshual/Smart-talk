document.getElementById("resetPasswordForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const newPassword = e.target.newPassword.value;

  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = await res.json();
    alert(data.message);

    if (res.ok) window.location.href = "/login.html";
  } catch (err) {
    console.error("Error:", err);
    alert("Reset failed.");
  }
});