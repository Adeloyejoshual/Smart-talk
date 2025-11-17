// src/components/Chat/ThreeDotMenu.jsx
import React from "react";

const ThreeDotMenu = ({ isOpen, onClose, onClearChat, onDeleteChat }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute right-4 top-14 bg-white shadow-lg rounded-xl w-40 py-2 z-30">
      {/* Close background overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 w-full h-full z-10"
      ></div>

      {/* Menu options */}
      <div className="relative z-20">
        <button
          onClick={onClearChat}
          className="w-full text-left px-4 py-2 hover:bg-gray-100"
        >
          Clear Chat
        </button>

        <button
          onClick={onDeleteChat}
          className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600"
        >
          Delete Chat
        </button>
      </div>
    </div>
  );
};

export default ThreeDotMenu;
