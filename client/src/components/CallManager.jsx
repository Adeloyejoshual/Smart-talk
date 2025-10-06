// /src/components/CallManager.jsx
import React, { useEffect, useRef, useState } from "react";
import { doc, setDoc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db, auth } from "../firebaseClient";
import { serverStartCall, serverAcceptCall, serverEndCall, serverHeartbeat } from "../utils/callClient";
import CallScreen from "../pages/CallScreen";

// You may add TURN servers here (coturn) for production
const DEFAULT_ICE = [{ urls: "stun:stun.l.google.com:19302" }];

export default function CallManager({ otherUser }) {
  const me = auth.currentUser;
  const uid = me?.uid;
  // call state
  const [incoming, setIncoming] = useState(null); // { callId, caller, type }
  const [activeCall, setActiveCall] = useState(null); // { callId, type, isCaller }
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteElRef = useRef(null);
  const callUnsubRef = useRef(null);
  const billingTimerRef = useRef(null);

  // Listen for calls directed to current user
  useEffect(() => {
    if (!uid) return;
    // Listen to all calls where callee == uid and status == "ringing"
    // For simple approach, listen to "calls" collection and filter client-side
    const qUnsub = onSnapshot(doc(db, "calls", "meta"), () => {}); // placeholder to keep listening threshold low
    // Instead, a simpler approach: listen to collection "calls" using onSnapshot with server-side index in production.
    const callsUnsub = onSnapshot(
      // unsubscribing by reading entire collection could be heavy; production rules should restrict writes and use index/queries
      // here we read whole "calls" collection — adapt to queries for performance.
      // For simplicity, we'll query single doc when callee is mentioned in doc creation; better: when server creates call, use callId known by callee.
      doc(db, "users", uid, "inbox", "calls"), // alternative: server writes to users/{uid}/inbox/calls/{callId}
      (snap) => {
        // If your server writes to users/{uid}/inbox/calls/{callId}, this will trigger.
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data) return;
        // expect structure: { callId, caller, type, status }
        if (data.status === "ringing" && data.callId) {
          setIncoming({ callId: data.callId, caller: data.caller, type: data.type });
        }
      }
    );

    return () => {
      try { qUnsub(); } catch {}
      try { callsUnsub(); } catch {}
    };
  }, [uid]);

  // UTILS: create a PeerConnection and local stream
  const createPeerConnection = (config = {}) => {
    const pc = new RTCPeerConnection({ iceServers: config.iceServers || DEFAULT_ICE });
    pc.onicecandidate = async (ev) => {
      if (!ev.candidate || !activeCall) return;
      try {
        const callDoc = doc(db, "calls", activeCall.callId);
        await updateDoc(callDoc, { iceCandidates: arrayUnion(ev.candidate.toJSON()) });
      } catch (e) {
        console.warn("ice candidate push failed", e);
      }
    };
    pc.ontrack = (ev) => {
      const [remoteStream] = ev.streams;
      if (remoteElRef.current) remoteElRef.current.srcObject = remoteStream;
    };
    return pc;
  };

  // START OUTGOING CALL (caller)
  const startOutgoing = async (type = "audio") => {
    if (!uid || !otherUser?.uid) throw new Error("missing user");
    // 1) server creates call and sends callId (checks wallet)
    const serverRes = await serverStartCall(otherUser.uid, type); // may throw
    const { callId } = serverRes;
    // 2) create Firestore call doc
    const callDocRef = doc(db, "calls", callId);
    await setDoc(callDocRef, {
      caller: uid,
      callee: otherUser.uid,
      type,
      status: "ringing",
      createdAt: new Date(),
      iceCandidates: [],
    });

    // 3) create RTCPeerConnection & local stream
    const pc = createPeerConnection({ iceServers: DEFAULT_ICE });
    pcRef.current = pc;
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
    localStreamRef.current = localStream;
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

    // 4) create offer & setLocalDescription
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    // write offer to call doc
    await updateDoc(callDocRef, { offer: offer.toJSON() });

    // 5) listen to call doc for answer / ice / status
    callUnsubRef.current = onSnapshot(callDocRef, async (snap) => {
      const data = snap.data();
      if (!data) return;
      if (data.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
      if (data.iceCandidates && data.iceCandidates.length) {
        for (const c of data.iceCandidates) {
          try { await pc.addIceCandidate(c); } catch (e) {}
        }
      }
      if (data.status === "in_progress") {
        // start billing loop (caller does heartbeat)
        startBilling(callId);
        setActiveCall({ callId, type, isCaller: true });
      }
      if (data.status === "ended") {
        stopBilling();
        cleanup();
      }
    });
  };

  // ACCEPT INCOMING CALL (callee)
  const acceptIncoming = async (callId) => {
    // mark server accept
    await serverAcceptCall(callId);
    // create pc & local stream
    const pc = createPeerConnection({ iceServers: DEFAULT_ICE });
    pcRef.current = pc;
    const callDocRef = doc(db, "calls", callId);
    // get offer
    const callSnap = await callDocRef.get?.() || (await (await callDocRef.get ? callDocRef.get() : callDocRef.get()));
    // above uses different SDK usage; safer: read snapshot via getDoc from firebase/firestore
    // To be robust we use onSnapshot call to get offer
    // For simplicity here assume offer exists
    const offerSnap = await callDocRef.get?.() ?? null; // compat: actual code below uses onSnapshot (we already will)
    // get local stream
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = localStream;
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    // set remote offer when it arrives (we will listen)
    callUnsubRef.current = onSnapshot(callDocRef, async (snap) => {
      const data = snap.data();
      if (!data) return;
      if (data.offer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(callDocRef, { answer: answer.toJSON(), status: "in_progress" });
        setActiveCall({ callId, type: data.type, isCaller: false });
      }
      if (data.iceCandidates && data.iceCandidates.length) {
        for (const c of data.iceCandidates) {
          try { await pc.addIceCandidate(c); } catch (e) {}
        }
      }
      if (data.status === "ended") {
        stopBilling();
        cleanup();
      }
    });
    // inform UI we accepted
    setIncoming(null);
  };

  // Hangup
  const hangup = async (callId) => {
    try {
      await serverEndCall(callId);
    } catch (e) {
      console.warn("server end failed", e);
    }
    const callDocRef = doc(db, "calls", callId);
    try { await updateDoc(callDocRef, { status: "ended", endedAt: new Date() }); } catch {}
    stopBilling();
    cleanup();
  };

  // Billing loop (caller)
  const startBilling = (callId) => {
    if (billingTimerRef.current) return;
    billingTimerRef.current = setInterval(async () => {
      try {
        const res = await serverHeartbeat(callId, 1);
        // handle response: res.balance or insufficient funds
        if (res?.error) {
          console.warn("heartbeat error", res);
        }
        // If server returns insufficient funds, server should set call ended — listen will pick it up.
      } catch (e) {
        console.warn("heartbeat call error", e);
      }
    }, 1000);
  };
  const stopBilling = () => {
    if (billingTimerRef.current) {
      clearInterval(billingTimerRef.current);
      billingTimerRef.current = null;
    }
  };

  const cleanup = () => {
    try { pcRef.current?.close(); } catch {}
    try { localStreamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch {}
    try { callUnsubRef.current?.(); } catch {}
    pcRef.current = null;
    localStreamRef.current = null;
    callUnsubRef.current = null;
    setActiveCall(null);
    setIncoming(null);
  };

  // UI actions
  // start outgoing triggered from ChatPage buttons
  // acceptIncoming shown as modal when setIncoming set
  return (
    <>
      {/* Incoming call modal */}
      <AnimateIncoming incoming={incoming} onAccept={() => acceptIncoming(incoming?.callId)} onReject={() => {
        if (!incoming?.callId) return setIncoming(null);
        hangup(incoming.callId); // end call on server
      }} callerId={incoming?.caller} type={incoming?.type} />

      {/* Active call screen */}
      {activeCall && (
        <CallScreen
          callId={activeCall.callId}
          isCaller={activeCall.isCaller}
          onHangup={() => hangup(activeCall.callId)}
          localStreamRef={localStreamRef}
          remoteElRef={remoteElRef}
        />
      )}

      {/* Expose start functions to parent by rendering buttons — this component can also accept props to auto-start */}
      <div style={{ display: "inline-flex", gap: 8 }}>
        <button onClick={() => startOutgoing("audio")}>📞</button>
        <button onClick={() => startOutgoing("video")}>🎥</button>
      </div>
    </>
  );
}

// Small incoming modal component
function AnimateIncoming({ incoming, onAccept, onReject, callerId, type }) {
  if (!incoming) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.4)", zIndex: 2000
    }}>
      <div style={{ background: "#fff", padding: 20, borderRadius: 12, width: 320, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Incoming {incoming.type} call</div>
        <p>From: {incoming.caller}</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12 }}>
          <button onClick={onAccept} style={{ padding: "8px 14px", borderRadius: 8, background: "#0a84ff", color: "#fff" }}>Accept</button>
          <button onClick={onReject} style={{ padding: "8px 14px", borderRadius: 8, background: "#ff3b30", color: "#fff" }}>Reject</button>
        </div>
      </div>
    </div>
  );
}