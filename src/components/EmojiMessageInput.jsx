import React, { useState, useRef } from "react";
import EmojiPicker from "emoji-picker-react";
import { FiSend, FiSmile, FiPaperclip, FiX, FiImage, FiVideo } from "react-icons/fi";

export default function EmojiMessageInput({ onSend }) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [file, setFile] = useState(null);
  const fileInputRef = useRef();

  // 😀 Add emoji to message
  const handleEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  // 📤 Send message or file
  const handleSend = () => {
    if (file) {
      onSend({ type: "file", file });
      setFile(null);
    } else if (text.trim()) {
      onSend({ type: "text", text: text.trim() });
      setText("");
    }
    setShowEmoji(false);
  };

  // 📁 Handle file select
  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  // ❌ Clear selected file
  const clearFile = () => setFile(null);

  return (
    <div className="relative bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-2">
      {/* 🖼️ File Preview */}
      {file && (
        <div className="relative w-full flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded-xl">
          <div className="flex items-center gap-2">
            {file.type.startsWith("image/") && (
              <img
                src={URL.createObjectURL(file)}
                alt="preview"
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            {file.type.startsWith("video/") && (
              <video
                src={URL.createObjectURL(file)}
                className="w-16 h-16 rounded-lg object-cover"
                muted
                loop
              />
            )}
            {!file.type.startsWith("image/") &&
              !file.type.startsWith("video/") && (
                <div className="p-3 bg-gray-300 dark:bg-gray-600 rounded-lg">
                  📁 {file.name}
                </div>
              )}
          </div>
          <button
            onClick={clearFile}
            className="text-gray-500 hover:text-red-500"
          >
            <FiX size={20} />
          </button>
        </div>
      )}

      {/* 💬 Input Bar */}
      <div className="flex items-center gap-3">
        {/* 📎 Attach File */}
        <button
          onClick={() => fileInputRef.current.click()}
          className="text-gray-500 hover:text-blue-500"
        >
          <FiPaperclip size={22} />
        </button>
        <input
          type="file"
          hidden
          ref={fileInputRef}
          accept="image/*,video/*,.pdf,.doc,.docx,.mp3,.wav"
          onChange={handleFileSelect}
        />

        {/* 😀 Emoji Button */}
        <div className="relative">
          <button
            onClick={() => setShowEmoji((prev) => !prev)}
            className="text-gray-500 hover:text-blue-500"
          >
            <FiSmile size={22} />
          </button>
          {showEmoji && (
            <div className="absolute bottom-12 left-0 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-xl">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme="dark"
                emojiStyle="apple"
                width={300}
                height={350}
              />
            </div>
          )}
        </div>

        {/* ✏️ Text Input */}
        <input
          type="text"
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 px-2"
        />

        {/* 📤 Send */}
        <button
          onClick={handleSend}
          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full"
        >
          <FiSend size={20} />
        </button>
      </div>
    </div>
  );
}