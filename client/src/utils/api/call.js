import { getAuth } from "firebase/auth";

/**
 * Start a new call session
 * @param {Array<string>} participants - Array of participant UIDs
 * @param {string} hostUid - UID of the host
 */
export async function startCall(participants, hostUid) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken();

  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/call/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ participants, hostUid }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Failed to start call");
  return data.sessionId;
}

/**
 * End a call session and trigger billing
 * @param {string} sessionId - Session ID from startCall()
 */
export async function endCall(sessionId) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken();

  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/call/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Failed to end call");
  return data;
}
