import React from "react";
import { motion } from "framer-motion";
import { FiArrowLeft, FiPhone, FiVideo } from "react-icons/fi";

export default function HeaderActionsBar({
  contactName = "Unknown",
  contactStatus = "Online",
  onBack,
  onCall,
  onVideo,
}) {
  return (
    <motion.div
      className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ← Back + Avatar + Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-600 dark:text-gray-300 hover:text-blue-500"
        >
          <FiArrowLeft size={22} />
        </button>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm">
          {contactName[0]?.toUpperCase()}
        </div>

        {/* Name + Status */}
        <div className="flex flex-col leading-tight">
          <span className="text-gray-900 dark:text-white font-semibold text-[15px]">
            {contactName}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            {contactStatus}
          </span>
        </div>
      </div>

      {/* 📞 🎥 Icons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCall}
          className="text-gray-600 dark:text-gray-300 hover:text-blue-500"
        >
          <FiPhone size={20} />
        </button>
        <button
          onClick={onVideo}
          className="text-gray-600 dark:text-gray-300 hover:text-blue-500"
        >
          <FiVideo size={22} />
        </button>
      </div>
    </motion.div>
  );
}