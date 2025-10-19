// src/components/ChatMediaPage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

export default function ChatMediaPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [media, setMedia] = useState([]);

  useEffect(() => {
    if (!chatId) return;
    (async () => {
      const msgsRef = collection(db, "chats", chatId, "messages");
      const q = query(msgsRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.type === "image" || m.type === "file");
      setMedia(arr);
    })();
  }, [chatId]);

  return (
    <div className={`${isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900"} min-h-screen`}>
      <div className="px-4 py-4 flex items-center gap-3 border-b">
        <button onClick={() => navigate(-1)}>←</button>
        <h2 className="text-lg font-semibold m-0">Shared Media</h2>
      </div>

      <div className="p-4">
        {media.length === 0 && <p className="text-gray-400">No media found.</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {media.map((m) => (
            <div key={m.id} className="rounded-md overflow-hidden bg-gray-100">
              {m.type === "image" ? (
                <img src={m.fileURL} alt={m.fileName} className="w-full h-40 object-cover cursor-pointer" onClick={() => window.open(m.fileURL, "_blank")} />
              ) : (
                <div className="h-40 flex items-center justify-center cursor-pointer" onClick={() => window.open(m.fileURL, "_blank")}>
                  <div className="text-center">
                    <div className="text-3xl">📎</div>
                    <div className="mt-2 text-sm">{m.fileName}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}