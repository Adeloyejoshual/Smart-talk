// src/components/HeaderActionsBar.jsx
import React from "react";
import {
  ArrowLeft,
  Copy,
  Edit2,
  Trash2,
  MessageSquare,
  Share2,
  Pin,
  X,
} from "lucide-react";

export default function HeaderActionsBar({
  selectedCount,
  onCancel,
  onCopy,
  onEdit,
  onDelete,
  onReply,
  onForward,
  onPin,
}) {
  return (
    <div className="flex items-center justify-between bg-blue-600 text-white px-4 py-2 shadow-md transition-all duration-200">
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="hover:bg-blue-700 p-1 rounded-full transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <p className="font-medium text-sm">{selectedCount} selected</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onCopy}
          className="hover:bg-blue-700 p-1 rounded-full transition-colors"
          title="Copy"
        >
          <Copy size={20} />
        </button>

        <button
          onClick={onEdit}
          className="hover:bg-blue-700 p-1 rounded-full transition-colors"
          title="Edit"
        >
          <Edit2 size={20} />
        </button>

        <button
          onClick={onDelete}
          className="hover:bg-blue-700 p-1 rounded-full transition-colors"
          title="Delete"
        >
          <Trash2 size={20} />
        </button>

        <button
          onClick={onReply}
          className="hover:bg-blue-700 p-1 rounded-full transition-colors"
          title="Reply"
        >
          <MessageSquare size={20} />
        </button>

        <button
          onClick={onForward}
          className="hover:bg-blue-700 p-1 rounded-full transition-colors"
          title="Forward"
        >
          <Share2 size={20} />
        </button>

        <button
          onClick={onPin}
          className="hover:bg-blue-700 p-1 rounded-full transition-colors"
          title="Pin"
        >
          <Pin size={20} />
        </button>

        <button
          onClick={onCancel}
          className="hover:bg-blue-700 p-1 rounded-full transition-colors"
          title="Close"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}