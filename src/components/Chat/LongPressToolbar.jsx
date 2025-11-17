// src/components/Chat/LongPressToolbar.jsx
import React from "react";
import { FaTrash, FaCopy, FaReply } from "react-icons/fa";

const LongPressToolbar = ({ visible, x, y, onCopy, onDelete, onReply }) => {
  if (!visible) return null;

  return (
    <div
      className="absolute bg-white shadow-lg rounded-xl p-2 flex space-x-3 z-50"
      style={{ top: y, left: x }}
    >
      <button
        onClick={onCopy}
        className="p-2 rounded-lg hover:bg-gray-100"
      >
        <FaCopy size={16} />
      </button>

      <button
        onClick={onReply}
        className="p-2 rounded-lg hover:bg-gray-100"
      >
        <FaReply size={16} />
      </button>

      <button
        onClick={onDelete}
        className="p-2 rounded-lg hover:bg-red-100 text-red-600"
      >
        <FaTrash size={16} />
      </button>
    </div>
  );
};

export default LongPressToolbar;
