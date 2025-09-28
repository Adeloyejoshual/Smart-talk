const socket = io({ auth: { token: localStorage.getItem('token') } });

socket.on('connect', () => console.log('Connected to Socket.IO'));

const chatList = document.getElementById('chatList');

function openAddFriendModal() {
  document.getElementById('addFriendModal').classList.remove('hidden');
}

function closeAddFriendModal() {
  document.getElementById('addFriendModal').classList.add('hidden');
}

async function confirmAddFriend() {
  const identifier = document.getElementById('friendIdentifier').value.trim();
  const messageEl = document.getElementById('friendMessage');

  if (!identifier) {
    messageEl.textContent = 'Enter username or email';
    return;
  }

  try {
    const res = await fetch('/api/users/add-friend', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ identifier }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error adding friend');

    messageEl.style.color = 'green';
    messageEl.textContent = 'Friend added!';
    setTimeout(closeAddFriendModal, 1500);
  } catch (err) {
    messageEl.style.color = 'red';
    messageEl.textContent = err.message;
  }
}

// Add event listeners to chat tabs
document.getElementById('tabChats').addEventListener('click', () => console.log('Chats tab clicked'));
document.getElementById('tabGroups').addEventListener('click', () => console.log('Groups tab clicked'));