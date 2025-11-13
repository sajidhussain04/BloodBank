const API = window.location.origin;
const token = localStorage.getItem('adminToken');

if (!token) window.location.href = 'admin-login.html';

async function fetchData(endpoint, method = 'GET', body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${endpoint}`, opts);
  return res.ok ? res.json() : null;
}

function logout(){ localStorage.removeItem('adminToken'); window.location.href='admin-login.html'; }

async function loadInventory() {
  const data = await fetchData('/api/inventory');
  const ctx = document.getElementById('inventoryChart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(data),
      datasets: [{ label: 'Units', data: Object.values(data), backgroundColor: '#d32f2f' }]
    }
  });
}

async function loadDonors() {
  const donors = await fetchData('/api/donors');
  const tbody = document.querySelector('#donorTable tbody');
  tbody.innerHTML = donors.map(d =>
    `<tr><td>${d.name}</td><td>${d.bloodGroup}</td><td>${d.phone}</td><td>${d.location}</td>
     <td><button onclick="deleteDonor('${d._id}')">🗑️</button></td></tr>`).join('');
}

async function loadRequests() {
  const reqs = await fetchData('/api/requests');
  const tbody = document.querySelector('#requestTable tbody');
  tbody.innerHTML = reqs.map(r =>
    `<tr><td>${r.patientName}</td><td>${r.bloodGroup}</td><td>${r.unitsRequired}</td>
     <td>${r.hospitalName}</td><td>${r.city}</td><td>${r.status}</td>
     <td><button onclick="approveRequest('${r._id}')">✅</button> <button onclick="deleteRequest('${r._id}')">🗑️</button></td></tr>`
  ).join('');
}

async function deleteDonor(id){ await fetchData(`/api/donors/${id}`,'DELETE'); loadDonors(); }
async function deleteRequest(id){ await fetchData(`/api/requests/${id}`,'DELETE'); loadRequests(); }
async function approveRequest(id){ await fetchData(`/api/requests/${id}/approve`,'PATCH'); loadRequests(); }

loadInventory(); loadDonors(); loadRequests();
