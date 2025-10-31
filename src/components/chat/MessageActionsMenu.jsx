import React from "react";
import {
  FiCopy,
  FiEdit2,
  FiTrash2,
  FiMessageSquare,
  FiShare2,
  FiX,
} from "react-icons/fi";
import { PiPushPinSimpleBold } from "react-icons/pi";

export default function MessageActionsMenu({
  position,
  onClose,
  onCopy,
  onEdit,
  onDelete,
  onReply,
  onForward,
  onPin,
}) {
  if (!position) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg flex flex-wrap justify-center gap-4 p-4 max-w-[300px]"
        style={{
          top: position.y,
          left: position.x,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action buttons */}
        <ActionButton icon={<FiCopy />} label="Copy" onClick={onCopy} />
        <ActionButton icon={<FiEdit2 />} label="Edit" onClick={onEdit} />
        <ActionButton icon={<FiTrash2 />} label="Delete" onClick={onDelete} />
        <ActionButton
          icon={<FiMessageSquare />}
          label="Reply"
          onClick={onReply}
        />
        <ActionButton icon={<FiShare2 />} label="Forward" onClick={onForward} />
        <ActionButton
          icon={<PiPushPinSimpleBold />}
          label="Pin"
          onClick={onPin}
        />
        <ActionButton icon={<FiX />} label="Close" onClick={onClose} />
      </div>
    </div>
  );
}

// 🔹 Subcomponent for each button
const ActionButton = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center text-gray-600 dark:text-gray-300 hover:text-sky-500 transition-colors"
  >
    <div className="text-2xl">{icon}</div>
    <div className="text-xs mt-1">{label}</div>
  </button>
);