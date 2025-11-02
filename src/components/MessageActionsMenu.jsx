// src/components/MessageActionsMenu.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCopy, FiEdit, FiTrash2, FiMessageCircle, FiShare2, FiX, FiMapPin } from "react-icons/fi";

export default function MessageActionsMenu({
  visible,
  position,
  onClose,
  onAction,
  onReact,
}) {
  if (!visible) return null;

  const reactions = ["❤️", "😂", "👍", "😮", "😢", "💔", "➕"];

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Background overlay (click to close) */}
          <motion.div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Action menu */}
          <motion.div
            className="absolute z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 w-52"
            style={{
              top: position?.y ?? 0,
              left: position?.x ?? 0,
              transform: "translate(-50%, -100%)",
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {/* Emoji reactions bar */}
            <div className="flex justify-between items-center px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              {reactions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onReact(emoji)}
                  className="text-xl hover:scale-110 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col text-sm">
              <ActionButton icon={<FiCopy />} label="Copy" onClick={() => onAction("copy")} />
              <ActionButton icon={<FiEdit />} label="Edit" onClick={() => onAction("edit")} />
              <ActionButton icon={<FiTrash2 />} label="Delete" onClick={() => onAction("delete")} />
              <ActionButton icon={<FiMessageCircle />} label="Reply" onClick={() => onAction("reply")} />
              <ActionButton icon={<FiShare2 />} label="Forward" onClick={() => onAction("forward")} />
              <ActionButton icon={<FiThumbtack />} label="Pin" onClick={() => onAction("pin")} />
              <ActionButton icon={<FiX />} label="Close" onClick={onClose} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Reusable button component
function ActionButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  );
}