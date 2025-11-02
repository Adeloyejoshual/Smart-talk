import React from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiPhone, FiVideo } from "react-icons/fi";

export default function HeaderActionsBar({ user, onVoiceCall, onVideoCall }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      {/* ← Back + Avatar + Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-700 dark:text-gray-200 text-xl"
        >
          <FiArrowLeft />
        </button>

        <div className="flex items-center gap-2">
          <img
            src={user?.photoURL || "/default-avatar.png"}
            alt="Profile"
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              {user?.name || "User"}
            </h2>
            <p className="text-xs text-green-500">
              {user?.isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>
      </div>

      {/* 📞 🎥 Buttons */}
      <div className="flex items-center gap-4 text-sky-500 text-xl">
        <button onClick={onVoiceCall}>
          <FiPhone />
        </button>
        <button onClick={onVideoCall}>
          <FiVideo />
        </button>
      </div>
    </div>
  );
}