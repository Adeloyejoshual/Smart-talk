// src/components/Chat/ChatInput.jsx
import React, { useState } from "react";
import { Paperclip, Send } from "lucide-react";

export default function ChatInput({ onSendMessage }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);

  const handleSend = async () => {
    if (!text && !file) return;
    let fileURL = null;

    // Upload to Cloudinary (if file selected)
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "0HoyRB6wC0eba-Cbat0nhiIRoa8");
      formData.append("folder", "chatImages");

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/dtp8wg4e1/image/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      fileURL = data.secure_url;
      setFile(null);
    }

    await onSendMessage(text, fileURL);
    setText("");
  };

  return (
    <div className="flex items-center px-3 py-2">
      <label className="p-2 cursor-pointer">
        <Paperclip className="text-gray-500 w-5 h-5" />
        <input
          type="file"
          hidden
          onChange={(e) => setFile(e.target.files[0])}
        />
      </label>

      <input
        type="text"
        className="flex-1 px-3 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
      />

      <button
        onClick={handleSend}
        className="p-2 ml-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
}