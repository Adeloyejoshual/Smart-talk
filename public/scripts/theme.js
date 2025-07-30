// theme.js - global dark mode script

document.addEventListener("DOMContentLoaded", () => {
  const html = document.documentElement;
  const toggle = document.getElementById("darkModeToggle");

  // Check saved preference
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    html.classList.add("dark-mode");
    if (toggle) toggle.checked = true;
  }

  // Toggle dark mode
  if (toggle) {
    toggle.addEventListener("change", () => {
      if (toggle.checked) {
        html.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
      } else {
        html.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
      }
    });
  }
});