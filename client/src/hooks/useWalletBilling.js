// /src/hooks/useWalletBilling.js
import { useEffect, useRef, useState } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, auth, getIdToken } from "../firebaseClient";
import {
  serverStartCall,
  serverAcceptCall,
  serverEndCall,
  serverHeartbeat,
} from "../utils/callClient";

/**
 * useWalletBilling
 *
 * responsibilities:
 * - read wallet balance (from Firestore wallets/{uid})
 * - start call via serverStartCall() (server checks wallet >= min)
 * - ensure calls/{callId} doc exists and write users/{callee}/inbox/calls/{callId}
 * - start heartbeat (caller only) that calls serverHeartbeat(callId, 1) every second
 * - auto-end call when server returns insufficient funds (HTTP 402) or when local wallet <= STOP_THRESHOLD
 *
 * NOTE: this hook assumes wallet is stored at collection "wallets/{uid}" (doc "balance").
 * If you prefer "users/{uid}/wallet/balance" adapt the walletDocRef accordingly.
 */

const START_MIN = 0.5; // must have >= $0.50 to start (client-side guard)
const STOP_THRESHOLD = 0.0033; // when balance reaches <= this, stop call
const HEARTBEAT_INTERVAL_MS = 1000; // 1 second

export default function useWalletBilling() {
  const [wallet, setWallet] = useState({ balanceUsd: 0, loading: true });
  const [incomingCall, setIncomingCall] = useState(null); // { callId, caller, type, createdAt }
  const [activeCall, setActiveCall] = useState(null); // { callId, type, isCaller }
  const heartbeatRef = useRef(null);
  const callsUnsubRef = useRef(null);
  const walletUnsubRef = useRef(null);

  // --- wallet listener (wallets/{uid})
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (!u) {
        setWallet({ balanceUsd: 0, loading: false });
        if (walletUnsubRef.current) walletUnsubRef.current();
        return;
      }
      const wDoc = doc(db, "wallets", u.uid); // <--- dedicated collection wallets/{uid}
      walletUnsubRef.current = onSnapshot(
        wDoc,
        (snap) => {
          if (!snap.exists()) {
            setWallet({ balanceUsd: 0, loading: false });
          } else {
            const d = snap.data();
            setWallet({ balanceUsd: Number(d.balanceUsd || 0), loading: false });
          }
        },
        (err) => {
          console.error("wallet listener error", err);
          setWallet((s) => ({ ...s, loading: false }));
        }
      );
    });

    return () => {
      try { unsubAuth(); } catch {}
      try { walletUnsubRef.current && walletUnsubRef.current(); } catch {}
    };
  }, []);

  // --- listen to users/{uid}/inbox/calls for incoming calls
  useEffect(() => {
    let unsubAuth = null;
    const setup = (u) => {
      if (!u) return;
      const inboxDoc = doc(db, "users", u.uid, "inbox", "call"); // a single doc pointer or specifically users/{uid}/inbox/calls/{callId}
      // design: server writes users/{calleeUid}/inbox/calls/{callId} OR users/{uid}/inbox/call (latest)
      // Here we listen for one convenient pointer doc at users/{uid}/inbox/call
      callsUnsubRef.current = onSnapshot(inboxDoc, (snap) => {
        if (!snap.exists()) {
          setIncomingCall(null);
          return;
        }
        const d = snap.data();
        if (!d || !d.callId) {
          setIncomingCall(null);
          return;
        }
        // expected fields: callId, caller, type, status
        if (d.status === "ringing") {
          setIncomingCall({ callId: d.callId, caller: d.caller, type: d.type, createdAt: d.createdAt || null });
        } else {
          setIncomingCall(null);
        }
      });
    };

    unsubAuth = auth.onAuthStateChanged((u) => {
      if (callsUnsubRef.current) callsUnsubRef.current();
      setup(u);
    });

    return () => {
      try { unsubAuth(); } catch {}
      try { callsUnsubRef.current && callsUnsubRef.current(); } catch {}
    };
  }, []);

  // --- helper: start heartbeat (caller only)
  const startHeartbeat = (callId) => {
    if (heartbeatRef.current) return;
    heartbeatRef.current = setInterval(async () => {
      try {
        const res = await serverHeartbeat(callId, 1);
        // serverHeartbeat returns json { ok, charged, chargedTotal, balance }
        if (res && res.balance !== undefined) {
          // optional: update local wallet view optimistically (Firestore already updates if server writes)
          if (res.balance <= STOP_THRESHOLD) {
            // end call - low funds
            console.warn("balance low, ending call", res.balance);
            await stopCall(callId);
          }
        }
      } catch (e) {
        // server may respond with 402 (insufficient funds) - serverStartCall/heartbeat wrapper throws above
        console.warn("heartbeat error", e);
        // if insufficient funds specifically, stop
        if (e?.status === 402 || (e?.body && e.body.error === "Insufficient funds")) {
          await stopCall(callId);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  // --- start call (caller) ---
  // returns { callId, ratePerSecond } on success
  const startCall = async (calleeUid, type = "audio") => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    // local guard
    if (wallet.balanceUsd < START_MIN) {
      throw new Error(`Insufficient balance. Minimum ${START_MIN} required to start call.`);
    }

    // 1) call server to create call record (server validates wallet >= min)
    const res = await serverStartCall(calleeUid, type); // may throw
    const callId = res.callId;

    // 2) create/ensure Firestore call doc (signaling) and pointer to callee inbox
    const callDocRef = doc(db, "calls", callId);
    await setDoc(callDocRef, {
      caller: user.uid,
      callee: calleeUid,
      type,
      status: "ringing",
      createdAt: new Date(),
      iceCandidates: [],
    });

    // 3) create pointer for callee: users/{calleeUid}/inbox/call  (server may also do this)
    const inboxRef = doc(db, "users", calleeUid, "inbox", "call");
    await setDoc(inboxRef, {
      callId,
      caller: user.uid,
      type,
      status: "ringing",
      createdAt: new Date(),
    });

    // set activeCall in client (caller)
    setActiveCall({ callId, type, isCaller: true });

    // start listening to call doc for status changes (so we can start heartbeat when in_progress)
    const unsub = onSnapshot(callDocRef, (snap) => {
      const d = snap.data();
      if (!d) return;
      if (d.status === "in_progress") {
        // start heartbeat (caller)
        startHeartbeat(callId);
      }
      if (d.status === "ended") {
        // cleanup
        stopHeartbeat();
        setActiveCall(null);
        // remove inbox pointer (optional)
        try { deleteDoc(inboxRef); } catch {}
        unsub();
      }
    });

    return { callId, ratePerSecond: res.ratePerSecond };
  };

  // --- accept call (callee) ---
  const acceptIncomingCall = async (callId) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    // let server mark call in_progress
    await serverAcceptCall(callId);
    // update inbox pointer to in_progress (so caller sees it)
    const callSnapRef = doc(db, "calls", callId);
    await updateDoc(callSnapRef, { status: "in_progress", startedAt: new Date() }).catch(() => {});
    // clear inbox pointer for callee (optional)
    const inboxRef = doc(db, "users", user.uid, "inbox", "call");
    try { await deleteDoc(inboxRef); } catch {}
    // set activeCall for callee (heartbeat started only by caller)
    setActiveCall({ callId, type: "audio", isCaller: false });
  };

  // --- stop / end call (both sides) ---
  const stopCall = async (callId) => {
    if (!callId) return;
    try {
      await serverEndCall(callId).catch(() => {});
    } catch (e) {
      // ignore network errors - still try to update firestore
      console.warn("serverEndCall failed", e);
    }
    // update firestore call doc
    try {
      const callDocRef = doc(db, "calls", callId);
      await updateDoc(callDocRef, { status: "ended", endedAt: new Date() }).catch(() => {});
    } catch (e) {}
    // stop local heartbeat & activeCall
    stopHeartbeat();
    setActiveCall(null);
  };

  // alias for external use
  const endCall = stopCall;

  return {
    wallet,
    incomingCall,
    activeCall,
    startCall,
    acceptIncomingCall,
    endCall,
  };
}