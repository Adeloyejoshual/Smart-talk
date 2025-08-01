// public/scripts/settings.js

document.addEventListener("DOMContentLoaded", () => {
  const editForm = document.getElementById("editProfileForm");
  const contactForm = document.getElementById("contactForm");
  const customerServiceInfo = document.getElementById("customerServiceInfo");

  // Load Customer Service Info
  fetch("/api/settings/customer-service")
    .then((res) => res.json())
    .then((data) => {
      customerServiceInfo.innerHTML = `
        <p><strong>Email:</strong> ${data.supportEmail}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Hours:</strong> ${data.workingHours}</p>
      `;
    });

  // Handle Edit Profile Form
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userId = localStorage.getItem("userId");
    const username = document.getElementById("editUsername").value;
    const email = document.getElementById("editEmail").value;

    try {
      const res = await fetch("/api/settings/edit-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, username, email }),
      });

      const result = await res.json();
      alert(result.message);
    } catch (err) {
      alert("Failed to update profile.");
    }
  });

  // Handle Contact Form
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("contactEmail").value;
    const message = document.getElementById("contactMessage").value;

    try {
      const res = await fetch("/api/settings/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, message }),
      });

      const result = await res.json();
      alert(result.message);
    } catch (err) {
      alert("Failed to send message.");
    }
  });
});