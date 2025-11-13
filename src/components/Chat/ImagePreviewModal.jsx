// src/components/Chat/ImagePreviewModal.jsx
import React from "react";
import { X, Send } from "lucide-react";

export default function ImagePreviewModal({ file, onCancel, onSend }) {
  if (!file) return null;

  const imgURL = URL.createObjectURL(file);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col justify-center items-center z-50">
      <img
        src={imgURL}
        alt="preview"
        className="max-w-sm sm:max-w-md max-h-[70vh] rounded-lg shadow-lg"
      />
      <div className="flex space-x-3 mt-4">
        <button
          onClick={onCancel}
          className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-full"
        >
          <X className="w-4 h-4 mr-1" /> Cancel
        </button>
        <button
          onClick={() => onSend(file)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full"
        >
          <Send className="w-4 h-4 mr-1" /> Send
        </button>
      </div>
    </div>
  );
}