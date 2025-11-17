// src/components/Chat/MessageInput.jsx
import React, { useState } from "react";
import { FaMicrophone, FaPaperPlane, FaImage } from "react-icons/fa";

const MessageInput = ({
  onSendText,
  onSendVoice,
  onSendImage,
  replyingTo,
  cancelReply,
}) => {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (!text.trim()) return;
    onSendText(text, replyingTo);
    setText("");
  };

  return (
    <div className="p-3 border-t bg-white">
      {replyingTo && (
        <div className="p-2 bg-gray-100 rounded-md mb-2 flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Replying to: {replyingTo.text.slice(0, 40)}...
          </div>
          <button onClick={cancelReply} className="text-red-500 text-sm">
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <label className="cursor-pointer">
          <FaImage size={20} className="text-blue-600" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onSendImage(e.target.files[0])}
          />
        </label>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          className="flex-1 border rounded-full px-3 py-2 outline-none"
        />

        {text.trim() ? (
          <button
            onClick={handleSend}
            className="p-3 bg-blue-600 text-white rounded-full"
          >
            <FaPaperPlane />
          </button>
        ) : (
          <button
            onClick={onSendVoice}
            className="p-3 bg-gray-200 text-gray-800 rounded-full"
          >
            <FaMicrophone />
          </button>
        )}
      </div>
    </div>
  );
};

export default MessageInput;
