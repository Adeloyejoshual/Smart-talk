// src/components/Chat/FileUploadButton.jsx
import React from "react";
import { Paperclip } from "lucide-react";

export default function FileUploadButton({ onFileSelect }) {
  const fileInputRef = React.useRef();

  return (
    <>
      <button
        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        onClick={() => fileInputRef.current.click()}
      >
        <Paperclip className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </button>
      <input
        type="file"
        hidden
        ref={fileInputRef}
        onChange={(e) => onFileSelect(e.target.files[0])}
      />
    </>
  );
}