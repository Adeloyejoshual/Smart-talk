// /src/utils/callClient.js
import { auth } from "../firebaseClient";

const API_BASE = import.meta.env.VITE_API_URL || "/api/call";

async function authRequest(path, body = {}, opts = {}) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let json = null;
  try { json = txt ? JSON.parse(txt) : null; } catch (e) { json = { raw: txt }; }
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

export async function serverStartCall(calleeUid, type = "audio") {
  return authRequest("/start", { calleeUid, type });
}
export async function serverAcceptCall(callId) {
  return authRequest("/accept", { callId });
}
export async function serverEndCall(callId) {
  return authRequest("/end", { callId });
}
export async function serverHeartbeat(callId, elapsedSeconds = 1) {
  return authRequest("/heartbeat", { callId, elapsedSeconds });
}