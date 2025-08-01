document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("formModal");
  const closeModal = document.getElementById("closeModal");
  const form = document.getElementById("settingsForm");
  const input1 = document.getElementById("input1");
  const input2 = document.getElementById("input2");
  const formTitle = document.getElementById("formTitle");

  let currentAction = "";

  const showModal = (title, isTextarea = false) => {
    formTitle.innerText = title;
    input1.value = "";
    input2.value = "";
    input2.classList.toggle("hidden", !isTextarea);
    modal.classList.remove("hidden");
  };

  document.getElementById("editProfileBtn").onclick = () => {
    currentAction = "edit";
    showModal("Edit Profile");
    input1.placeholder = "Enter new username";
  };

  document.getElementById("contactBtn").onclick = () => {
    currentAction = "contact";
    showModal("Contact Us", true);
    input1.placeholder = "Enter your email";
    input2.placeholder = "Your message";
  };

  document.getElementById("customerServiceBtn").onclick = () => {
    currentAction = "service";
    showModal("Customer Service", true);
    input1.placeholder = "Enter your email";
    input2.placeholder = "How can we help?";
  };

  closeModal.onclick = () => modal.classList.add("hidden");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const userId = localStorage.getItem("userId");
    if (!userId) return alert("Not logged in");

    let url = "", body = {};
    if (currentAction === "edit") {
      url = "/api/users/update-profile";
      body = { userId, username: input1.value };
    } else if (currentAction === "contact") {
      url = "/api/support/contact";
      body = { email: input1.value, message: input2.value };
    } else if (currentAction === "service") {
      url = "/api/support/chat";
      body = { email: input1.value, issue: input2.value };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    alert(data.message || "Submitted");
    modal.classList.add("hidden");
  };
});