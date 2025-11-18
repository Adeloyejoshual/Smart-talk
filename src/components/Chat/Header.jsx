// src/components/Chat/Header.jsx
import React from "react";
import { MoreVertical, Phone, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Header = ({
  user,
  onMenu,
  onVoiceCall,
  onVideoCall,
}) => {
  const navigate = useNavigate();

  const openProfile = () => {
    navigate(`/profile/${user?.uid}`);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white shadow-md sticky top-0 z-30">

      {/* LEFT: Avatar + Name */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={openProfile}
      >
        {/* Profile Picture */}
        <img
          src={user?.photoURL || "/default-avatar.png"}
          alt="avatar"
          className="w-10 h-10 rounded-full object-cover"
        />

        {/* Username + Status */}
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-[16px]">
            {user?.displayName || "User"}
          </span>

          <span className="text-xs text-green-600">
            {user?.online ? "Online" : user?.lastSeen || "Last seen recently"}
          </span>
        </div>
      </div>

      {/* RIGHT: Call buttons + menu */}
      <div className="flex items-center gap-2">

        {/* Voice Call */}
        <button
          onClick={onVoiceCall}
          className="p-2 rounded-full hover:bg-gray-100 transition"
        >
          <Phone size={20} className="text-blue-600" />
        </button>

        {/* Video Call */}
        <button
          onClick={onVideoCall}
          className="p-2 rounded-full hover:bg-gray-100 transition"
        >
          <Video size={22} className="text-blue-600" />
        </button>

        {/* 3-Dot Menu */}
        <button
          onClick={onMenu}
          className="p-2 rounded-full hover:bg-gray-100 transition"
        >
          <MoreVertical size={22} />
        </button>
      </div>
    </div>
  );
};

export default Header;