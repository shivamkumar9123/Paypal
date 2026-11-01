const API_BASE = "http://127.0.0.1:8000";

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function loadSampleData() {
  const res = await fetch(`${API_BASE}/graph/load-sample`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to load sample dataset");
  return res.json();
}

export async function runAnalysis() {
  const res = await fetch(`${API_BASE}/graph/analyze`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to run graph analysis");
  return res.json();
}

export async function getDashboardSummary() {
  const res = await fetch(`${API_BASE}/dashboard/summary`);
  if (!res.ok) throw new Error("Failed to fetch dashboard summary");
  return res.json();
}

export async function getGroupDetails(groupId) {
  const res = await fetch(`${API_BASE}/graph/groups/${encodeURIComponent(groupId)}`);
  if (!res.ok) throw new Error(`Failed to fetch details for group ${groupId}`);
  return res.json();
}

export async function updateGroupStatus(groupId, { status, notes, assigned_to }) {
  const res = await fetch(`${API_BASE}/graph/groups/${encodeURIComponent(groupId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes, assigned_to }),
  });
  if (!res.ok) throw new Error(`Failed to update status for group ${groupId}`);
  return res.json();
}

export async function uploadCsvFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/graph/upload-csv`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "CSV upload failed");
  }
  return res.json();
}

export async function getTransactionDetails(transactionId) {
  const res = await fetch(`${API_BASE}/graph/transactions/${encodeURIComponent(transactionId)}`);
  if (!res.ok) throw new Error("Failed to fetch transaction details");
  return res.json();
}

export async function getPayPalStatus() {
  const res = await fetch(`${API_BASE}/paypal/status`);
  if (!res.ok) throw new Error("Failed to fetch PayPal status");
  return res.json();
}

export async function createPayPalOrder(amount, currency = "USD") {
  const res = await fetch(`${API_BASE}/paypal/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Number(amount), currency }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create PayPal order");
  }
  return res.json();
}

export async function capturePayPalOrder(orderId) {
  const res = await fetch(`${API_BASE}/paypal/capture-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to capture PayPal order");
  }
  return res.json();
}
