document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const message = document.getElementById('message');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.textContent = '';

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value.trim();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      // Save token
      localStorage.setItem('token', data.token);
      window.location.href = '/home.html';
    } catch (err) {
      message.textContent = err.message;
    }
  });
});