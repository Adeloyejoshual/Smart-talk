// src/components/FriendProfilePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { db, auth } from "../firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

export default function FriendProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const myUid = auth.currentUser?.uid;

  const [friend, setFriend] = useState(null);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [sharedPhotos, setSharedPhotos] = useState([]);
  const [sharedDocs, setSharedDocs] = useState([]);
  const [sharedAudio, setSharedAudio] = useState([]);
  const [sharedLinks, setSharedLinks] = useState([]);
  const [typing, setTyping] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const COLORS = {
    headerBlue: "#0047ff",
    textLight: "#fff",
    lightCard: "#f2f4f8",
  };

  // Fetch profile
  useEffect(() => {
    const load = async () => {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (snap.exists()) setFriend({ id: uid, ...snap.data() });

      setLoading(false);
    };
    load();
  }, [uid]);

  // Live last seen update + typing status
  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, "users", uid);
    return onSnapshot(ref, (snap) => {
      setFriend((prev) => ({ id: uid, ...snap.data() }));
      setTyping(snap.data()?.typing || false);
    });
  }, [uid]);

  // Mutual friends
  useEffect(() => {
    if (!friend) return;

    const q = query(collection(db, "users"));
    return onSnapshot(q, (snapshot) => {
      const allUsers = [];
      snapshot.forEach((s) => allUsers.push({ id: s.id, ...s.data() }));

      const mine = allUsers.find((u) => u.id === myUid)?.friends || [];
      const theirs = friend.friends || [];

      const mutual = allUsers.filter((u) => mine.includes(u.id) && theirs.includes(u.id));
      setMutualFriends(mutual);
    });
  }, [friend]);

  // Shared media + docs + audio + links
  useEffect(() => {
    if (!uid || !myUid) return;

    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", myUid)
    );

    return onSnapshot(q, (snapshot) => {
      const photos = [];
      const docs = [];
      const audio = [];
      const links = [];

      snapshot.forEach((snap) => {
        const msg = snap.data();

        if (!msg.participants?.includes(uid)) return;

        if (msg.photoURL) photos.push(msg.photoURL);
        if (msg.fileURL && msg.fileType?.startsWith("doc")) docs.push(msg.fileURL);
        if (msg.fileURL && msg.fileType?.startsWith("audio")) audio.push(msg.fileURL);
        if (msg.link) links.push(msg.link);
      });

      setSharedPhotos(photos);
      setSharedDocs(docs);
      setSharedAudio(audio);
      setSharedLinks(links);
    });
  }, [uid, myUid]);

  // Block / Unblock
  const toggleBlock = async () => {
    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", myUid)
    );

    const snap = await getDocs(q);

    snap.forEach(async (s) => {
      const data = s.data();
      if (data.members.includes(uid)) {
        const ref = doc(db, "chats", s.id);

        await updateDoc(ref, {
          blockedBy: isBlocked ? arrayRemove(myUid) : arrayUnion(myUid),
        });
      }
    });
  };

  // Add friend
  const addFriend = async () => {
    await updateDoc(doc(db, "users", myUid), {
      friends: arrayUnion(uid),
    });
  };

  // Remove friend
  const removeFriend = async () => {
    await updateDoc(doc(db, "users", myUid), {
      friends: arrayRemove(uid),
    });
  };

  // QR code generator
  useEffect(() => {
    if (!friend) return;

    QRCode.toDataURL(`https://yourapp.com/UserProfilePage/${uid}`).then((url) =>
      setQrCode(url)
    );
  }, [friend]);

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div style={{ height: "100vh", overflowY: "auto", background: COLORS.lightCard }}>
      {/* HEADER */}
      <div
        style={{
          height: 56,
          background: COLORS.headerBlue,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: 18 }}
        >
          ←
        </button>

        <div style={{ fontSize: 18, fontWeight: 600 }}>{friend.name}</div>
      </div>

      {/* PROFILE PICTURE */}
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        {friend.photoURL ? (
          <img
            src={friend.photoURL}
            style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: COLORS.headerBlue,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 40,
              fontWeight: "bold",
              margin: "auto",
            }}
          >
            {friend.name[0].toUpperCase()}
          </div>
        )}

        <h2>{friend.name}</h2>
        <p style={{ opacity: 0.7 }}>
          {typing
            ? "Typing…"
            : friend.online
            ? "Online"
            : friend.lastSeen
            ? `Last seen: ${new Date(
                friend.lastSeen.toDate ? friend.lastSeen.toDate() : friend.lastSeen
              ).toLocaleString()}`
            : "Offline"}
        </p>
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ padding: 16 }}>
        <button
          onClick={() => navigate(`/Chat/${uid}`)}
          style={{
            width: "100%",
            background: COLORS.headerBlue,
            color: "#fff",
            padding: 12,
            borderRadius: 10,
            border: "none",
            marginBottom: 12,
          }}
        >
          Message
        </button>

        <button
          onClick={() =>
            navigate("/VoiceCallPage", { state: { friendId: uid } })
          }
          style={{
            width: "100%",
            background: "#0a9",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
            border: "none",
            color: "#fff",
          }}
        >
          Voice Call
        </button>

        <button
          onClick={() =>
            navigate("/VideoCallPage", { state: { friendId: uid } })
          }
          style={{
            width: "100%",
            background: "#f60",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
            border: "none",
            color: "#fff",
          }}
        >
          Video Call
        </button>

        {/* FRIEND / BLOCK BUTTONS */}
        {friend.friends?.includes(myUid) ? (
          <button
            onClick={removeFriend}
            style={{
              width: "100%",
              background: "#777",
              padding: 12,
              borderRadius: 10,
              border: "none",
              color: "#fff",
              marginBottom: 12,
            }}
          >
            Remove Friend
          </button>
        ) : (
          <button
            onClick={addFriend}
            style={{
              width: "100%",
              background: "#222",
              padding: 12,
              borderRadius: 10,
              border: "none",
              color: "#fff",
              marginBottom: 12,
            }}
          >
            Add Friend
          </button>
        )}

        <button
          onClick={toggleBlock}
          style={{
            width: "100%",
            background: isBlocked ? "#444" : "crimson",
            padding: 12,
            borderRadius: 10,
            border: "none",
            color: "#fff",
          }}
        >
          {isBlocked ? "Unblock" : "Block"}
        </button>
      </div>

      {/* ABOUT */}
      {friend.about && (
        <div style={{ padding: "0 16px 20px" }}>
          <h3>About</h3>
          <p style={{ opacity: 0.7 }}>{friend.about}</p>
        </div>
      )}

      {/* MUTUAL FRIENDS */}
      <div style={{ padding: "0 16px 20px" }}>
        <h3>Mutual Friends ({mutualFriends.length})</h3>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingTop: 8 }}>
          {mutualFriends.map((u) => (
            <div key={u.id} style={{ textAlign: "center", width: 60 }}>
              {u.photoURL ? (
                <img
                  src={u.photoURL}
                  style={{ width: 50, height: 50, borderRadius: "50%" }}
                />
              ) : (
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: "50%",
                    background: COLORS.headerBlue,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                  }}
                >
                  {u.name[0].toUpperCase()}
                </div>
              )}
              <p style={{ fontSize: 12 }}>{u.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SHARED PHOTOS */}
      <div style={{ padding: "0 16px 20px" }}>
        <h3>Shared Photos</h3>
        <MediaGrid list={sharedPhotos} />
      </div>

      {/* SHARED DOCUMENTS */}
      <div style={{ padding: "0 16px 20px" }}>
        <h3>Shared Documents</h3>
        <FileList list={sharedDocs} />
      </div>

      {/* SHARED AUDIO */}
      <div style={{ padding: "0 16px 20px" }}>
        <h3>Shared Audio</h3>
        <FileList list={sharedAudio} />
      </div>

      {/* SHARED LINKS */}
      <div style={{ padding: "0 16px 20px" }}>
        <h3>Shared Links</h3>
        <LinkList list={sharedLinks} />
      </div>

      {/* QR CODE SHARE */}
      <div style={{ padding: 16 }}>
        <h3>Share Profile</h3>
        <img src={qrCode} style={{ width: 150, height: 150 }} />
      </div>
    </div>
  );
}

// Small components
function MediaGrid({ list }) {
  if (!list.length) return <p style={{ opacity: 0.6 }}>No media.</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
      {list.map((m, i) => (
        <img
          key={i}
          src={m}
          style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6 }}
        />
      ))}
    </div>
  );
}

function FileList({ list }) {
  if (!list.length) return <p style={{ opacity: 0.6 }}>No files.</p>;
  return (
    <ul>
      {list.map((url, i) => (
        <li key={i} style={{ margin: "6px 0" }}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url.split("/").pop()}
          </a>
        </li>
      ))}
    </ul>
  );
}

function LinkList({ list }) {
  if (!list.length) return <p style={{ opacity: 0.6 }}>No links.</p>;
  return (
    <ul>
      {list.map((l, i) => (
        <li key={i} style={{ margin: "6px 0" }}>
          <a href={l} target="_blank" rel="noopener noreferrer">{l}</a>
        </li>
      ))}
    </ul>
  );
}