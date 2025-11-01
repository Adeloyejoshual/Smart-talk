import React, { useEffect, useState, useContext } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatPage() {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const [chats, setChats] = useState([]);
  const [user, setUser] = useState(null);

  const isDark = theme === "dark";

  // Load current user
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((userAuth) => {
      if (userAuth) {
        setUser(userAuth);
      } else {
        navigate("/");
      }
    });
    return () => unsubscribeAuth();
  }, [navigate]);

  // Load chats with real-time updates
  useEffect(() => {
    if (!user) return;

    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("participants", "array-contains", user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatsData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();

          // Load all participants info (name + profilePic)
          const participants = await Promise.all(
            data.participants.map(async (uid) => {
              const userRef = doc(db, "users", uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const u = userSnap.data();
                return {
                  uid,
                  displayName: u.displayName || "Unknown",
                  profilePic: u.profilePic || "https://i.ibb.co/ZYvPL4Z/default-avatar.png",
                };
              }
              return { uid, displayName: "Unknown", profilePic: "https://i.ibb.co/ZYvPL4Z/default-avatar.png" };
            })
          );

          return {
            id: docSnap.id,
            ...data,
            participants,
          };
        })
      );
      setChats(chatsData);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return <p>Loading user...</p>;

  return (
    <div
      style={{
        background: isDark ? "#1c1c1c" : "#f5f5f5",
        minHeight: "100vh",
        padding: "20px",
        color: isDark ? "#fff" : "#000",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>💬 Chats</h2>

      {chats.length === 0 && <p>No chats yet.</p>}

      <div>
        {chats.map((chat) => {
          const otherUsers = chat.participants.filter((p) => p.uid !== user.uid);
          return (
            <div
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                background: isDark ? "#2b2b2b" : "#fff",
                padding: "10px",
                borderRadius: "8px",
                marginBottom: "10px",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
              }}
            >
              {otherUsers.map((p) => (
                <img
                  key={p.uid}
                  src={p.profilePic}
                  alt={p.displayName}
                  style={{
                    width: "50px",
                    height: "50px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    marginRight: "10px",
                  }}
                />
              ))}

              <div>
                {otherUsers.map((p) => (
                  <p
                    key={p.uid}
                    style={{
                      margin: 0,
                      fontWeight: "bold",
                      color: isDark ? "#fff" : "#000",
                    }}
                  >
                    {p.displayName}
                  </p>
                ))}
                <p style={{ margin: 0, fontSize: "12px", color: "#888" }}>
                  {chat.lastMessage || "No messages yet."}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}