// public/scripts/admin-dashboard.js
const token = localStorage.getItem("adminToken");
if (!token) window.location.href = "/admin-login.html";

const content = document.getElementById("content");
const navBtns = document.querySelectorAll(".nav-btn");

navBtns.forEach(btn => btn.addEventListener("click", () => {
  navBtns.forEach(b => b.classList.remove("bg-gray-900","text-white"));
  btn.classList.add("bg-gray-900","text-white");
  loadPage(btn.dataset.page);
}));

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("adminToken");
  window.location.href = "/admin-login.html";
});

// helper fetch
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...opts
  });
  if (!res.ok) {
    const j = await res.json().catch(()=>({ message: "Request failed" }));
    throw new Error(j.message || "Request failed");
  }
  return res.json();
}

// routing
function loadPage(page) {
  if (page === "overview") return renderOverview();
  if (page === "users") return renderUsers();
  if (page === "groups") return renderGroups();
  if (page === "reported-groups") return renderReportedGroups();
  if (page === "reports") return renderReports();
  if (page === "delete-group") return renderDeleteGroup();
  if (page === "broadcast") return renderBroadcast();
}

// default
document.querySelector('[data-page="overview"]').classList.add("bg-gray-900","text-white");
loadPage("overview");

// Overview
async function renderOverview() {
  content.innerHTML = "<p>Loading stats...</p>";
  try {
    const data = await api("/api/admin/stats");
    content.innerHTML = `
      <h2 class="text-xl font-semibold mb-4">Overview</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 rounded border"><div class="text-sm">Users</div><div class="text-2xl font-bold">${data.users}</div></div>
        <div class="p-4 rounded border"><div class="text-sm">Groups</div><div class="text-2xl font-bold">${data.groups}</div></div>
        <div class="p-4 rounded border"><div class="text-sm">Reports</div><div class="text-2xl font-bold">${data.reports}</div></div>
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<p class="text-red-600">${e.message}</p>`;
  }
}

// Users
async function renderUsers() {
  content.innerHTML = "<p>Loading users...</p>";
  try {
    const users = await api("/api/admin/users");
    const rows = users.map(u => `
      <tr class="border-b">
        <td class="px-4 py-2">${u._id}</td>
        <td class="px-4 py-2">${u.username || "-"}</td>
        <td class="px-4 py-2">${u.email || "-"}</td>
        <td class="px-4 py-2">${new Date(u.createdAt).toLocaleString()}</td>
        <td class="px-4 py-2">${u.status || "active"}</td>
        <td class="px-4 py-2">
          <button class="text-red-600" data-del="${u._id}">Delete</button>
        </td>
      </tr>
    `).join("");
    content.innerHTML = `
      <h2 class="text-xl font-semibold mb-3">Users</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50"><tr>
            <th class="px-4 py-2">ID</th><th class="px-4 py-2">Username</th><th class="px-4 py-2">Email</th><th class="px-4 py-2">Joined</th><th class="px-4 py-2">Status</th><th class="px-4 py-2">Action</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    // bind deletes
    document.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete user?")) return;
        try {
          await api(`/api/admin/users/${btn.dataset.del}`, { method: "DELETE" });
          renderUsers();
        } catch (e) { alert(e.message); }
      });
    });
  } catch (e) {
    content.innerHTML = `<p class="text-red-600">${e.message}</p>`;
  }
}

// Groups
async function renderGroups() {
  content.innerHTML = "<p>Loading groups...</p>";
  try {
    const groups = await api("/api/admin/groups");
    const rows = groups.map(g => `
      <tr class="border-b">
        <td class="px-4 py-2">${g._id}</td>
        <td class="px-4 py-2">${g.name}</td>
        <td class="px-4 py-2">${(g.members||[]).length}</td>
        <td class="px-4 py-2">${new Date(g.createdAt).toLocaleString()}</td>
        <td class="px-4 py-2"><button data-gdel="${g._id}" class="text-red-600">Delete</button></td>
      </tr>
    `).join("");
    content.innerHTML = `
      <h2 class="text-xl font-semibold mb-3">Groups</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50"><tr><th class="px-4 py-2">ID</th><th class="px-4 py-2">Name</th><th class="px-4 py-2">Members</th><th class="px-4 py-2">Created</th><th class="px-4 py-2">Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    document.querySelectorAll("[data-gdel]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete group?")) return;
        try {
          await api(`/api/admin/groups/${btn.dataset.gdel}`, { method: "DELETE" });
          renderGroups();
        } catch (e) { alert(e.message); }
      });
    });
  } catch (e) {
    content.innerHTML = `<p class="text-red-600">${e.message}</p>`;
  }
}

// Reported groups page (simple)
async function renderReportedGroups() {
  content.innerHTML = "<p>Loading reported groups...</p>";
  try {
    const data = await api("/api/admin/groups/reported");
    const rows = data.map(g => `
      <tr class="border-b">
        <td class="px-4 py-2">${g.name}</td>
        <td class="px-4 py-2">${(g.reports||[]).length}</td>
        <td class="px-4 py-2">${new Date(g.createdAt).toLocaleString()}</td>
      </tr>
    `).join("");
    content.innerHTML = `
      <h2 class="text-xl font-semibold mb-3">Reported Groups</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50"><tr><th class="px-4 py-2">Name</th><th class="px-4 py-2">Reports</th><th class="px-4 py-2">Created</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<p class="text-red-600">${e.message}</p>`;
  }
}

// Reports page
async function renderReports() {
  content.innerHTML = "<p>Loading reports...</p>";
  try {
    const users = await api("/api/admin/reports/users");
    const groups = await api("/api/admin/reports/groups");
    const messages = await api("/api/admin/reports/messages");

    const usersHtml = users.map(r => `<li>${r.reporter?.username || r.reporter} — ${r.reason}</li>`).join("");
    const groupsHtml = groups.map(r => `<li>${r.targetId} — ${r.reason}</li>`).join("");
    const msgsHtml = messages.map(r => `<li>${r.targetId} — ${r.reason}</li>`).join("");

    content.innerHTML = `
      <h2 class="text-xl font-semibold mb-3">Reports</h2>
      <div class="grid md:grid-cols-3 gap-4">
        <div class="p-3 bg-white rounded">${usersHtml ? `<ul>${usersHtml}</ul>` : "<p>No user reports</p>"}</div>
        <div class="p-3 bg-white rounded">${groupsHtml ? `<ul>${groupsHtml}</ul>` : "<p>No group reports</p>"}</div>
        <div class="p-3 bg-white rounded">${msgsHtml ? `<ul>${msgsHtml}</ul>` : "<p>No message reports</p>"}</div>
      </div>
    `;
  } catch (e) {
    content.innerHTML = `<p class="text-red-600">${e.message}</p>`;
  }
}

// delete group by id page
function renderDeleteGroup() {
  content.innerHTML = `
    <h2 class="text-xl font-semibold mb-3">Delete Group</h2>
    <div class="flex gap-2">
      <input id="delGroupId" class="border rounded p-2 flex-1" placeholder="Group ID">
      <button id="delGroupBtn" class="bg-red-600 text-white px-4 py-2 rounded">Delete</button>
    </div>
  `;
  document.getElementById("delGroupBtn").addEventListener("click", async () => {
    const id = document.getElementById("delGroupId").value.trim();
    if (!id) return alert("Enter group id");
    try {
      await api(`/api/admin/groups/${id}`, { method: "DELETE" });
      alert("Deleted (if existed)");
    } catch (e) { alert(e.message); }
  });
}

// broadcast
function renderBroadcast() {
  content.innerHTML = `
    <h2 class="text-xl font-semibold mb-3">Broadcast</h2>
    <textarea id="broadcastText" rows="6" class="w-full border rounded p-2" placeholder="Type announcement"></textarea>
    <div class="mt-2 flex justify-between items-center">
      <div class="text-sm text-gray-500">Sends to all users</div>
      <button id="broadcastBtn" class="bg-blue-600 text-white px-4 py-2 rounded">Send</button>
    </div>
  `;
  document.getElementById("broadcastBtn").addEventListener("click", async () => {
    const text = document.getElementById("broadcastText").value.trim();
    if (!text) return alert("Type your message");
    try {
      await api("/api/admin/broadcast", { method: "POST", body: JSON.stringify({ message: text }) });
      alert("Broadcast sent");
      document.getElementById("broadcastText").value = "";
    } catch (e) { alert(e.message); }
  });
}