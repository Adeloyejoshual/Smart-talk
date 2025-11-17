import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebaseConfig";

export default function ForwardMessage({ onClose, onForward, messageText }) {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    const fetchChats = async () => {
      const snap = await getDocs(collection(db, "chats"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChats(list);
    };
    fetchChats();
  }, []);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="forward-box" onClick={(e) => e.stopPropagation()}>
        <h3>Forward message</h3>

        <p className="forward-preview">“{messageText}”</p>

        <div className="forward-list">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className="forward-item"
              onClick={() => onForward(chat.id)}
            >
              <img
                src={chat.photoURL || "/avatar.png"}
                className="forward-avatar"
              />

              <div className="forward-info">
                <strong>{chat.name || "Unknown Chat"}</strong>
              </div>
            </div>
          ))}
        </div>

        <button className="popup-btn cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
          }
