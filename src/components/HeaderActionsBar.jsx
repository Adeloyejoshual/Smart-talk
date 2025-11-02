import React from "react";
import { FiArrowLeft, FiPhone, FiVideo, FiMoreVertical } from "react-icons/fi";
import { motion } from "framer-motion";

export default function HeaderActionsBar({
  name,
  status,
  onBack,
  onVoiceCall,
  onVideoCall,
}) {
  return (
    <motion.div
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm"
    >
      {/* ← Back + Avatar + Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-600 dark:text-gray-300 hover:text-blue-500"
        >
          <FiArrowLeft size={22} />
        </button>

        <div className="flex items-center gap-2">
          <img
            src="https://ui-avatars.com/api/?name=Kude&background=random"
            alt="avatar"
            className="w-9 h-9 rounded-full"
          />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {name}
            </h2>
            <p className="text-xs text-green-600 dark:text-green-400">
              {status}
            </p>
          </div>
        </div>
      </div>

      {/* 📞 🎥 ⋮ */}
      <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
        <button
          onClick={onVoiceCall}
          className="hover:text-blue-500 transition"
        >
          <FiPhone size={20} />
        </button>

        <button
          onClick={onVideoCall}
          className="hover:text-blue-500 transition"
        >
          <FiVideo size={20} />
        </button>

        <button className="hover:text-blue-500 transition">
          <FiMoreVertical size={20} />
        </button>
      </div>
    </motion.div>
  );
}