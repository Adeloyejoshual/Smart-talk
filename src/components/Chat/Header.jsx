// src/components/Chat/Header.jsx
import React from "react";
import { ArrowLeft, Search, Phone, Video, MoreVertical } from "lucide-react";

export default function Header({
  chatName,
  profilePic,
  onProfileClick,
  onBack,
  onSearch,
  onMenuOpen,
  onVoiceCall,
  onVideoCall,
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-white dark:bg-dark-700 shadow-md sticky top-0 z-30 border-b border-gray-100 dark:border-dark-500">

      {/* LEFT SIDE */}
      <div className="flex items-center gap-3">

        {/* Back */}
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 transition"
          >
            <ArrowLeft size={22} />
          </button>
        )}

        {/* Profile picture */}
        <div
          onClick={onProfileClick}
          className="flex items-center gap-2 cursor-pointer"
        >
          <img
            src={profilePic || "/default-avatar.png"}
            alt="Profile"
            className="w-10 h-10 rounded-full object-cover"
          />

          {/* Chat name */}
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">
            {chatName || "Chat"}
          </h2>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-2">

        {/* Voice Call */}
        <button
          onClick={onVoiceCall}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 transition"
        >
          <Phone size={20} />
        </button>

        {/* Video Call */}
        <button
          onClick={onVideoCall}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 transition"
        >
          <Video size={21} />
        </button>

        {/* Search */}
        <button
          onClick={onSearch}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 transition"
        >
          <Search size={21} />
        </button>

        {/* Menu (3 dots) */}
        <button
          onClick={onMenuOpen}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 transition"
        >
          <MoreVertical size={22} />
        </button>
      </div>
    </div>
  );
}