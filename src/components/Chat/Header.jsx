// src/components/Chat/Header.jsx
import React from "react";
import { MoreVertical } from "lucide-react";

const Header = ({ chatName, onMenuOpen }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-white shadow-md sticky top-0 z-20">
      {/* Chat Title */}
      <h2 className="text-lg font-semibold">{chatName || "Chat"}</h2>

      {/* 3-Dot Menu Button */}
      <button
        onClick={onMenuOpen}
        className="p-2 rounded-full hover:bg-gray-100 transition"
      >
        <MoreVertical size={22} />
      </button>
    </div>
  );
};

export default Header;
