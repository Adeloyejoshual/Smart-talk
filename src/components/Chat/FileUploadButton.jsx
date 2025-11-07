// src/components/Chat/FileUploadButton.jsx
import React, { useRef } from "react";
import { Paperclip } from "lucide-react";

export default function FileUploadButton({ onFileSelect }) {
  const fileInputRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && onFileSelect) {
      onFileSelect(file);
      e.target.value = ""; // reset so same file can be re-uploaded
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current.click()}
        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        aria-label="Attach file"
      >
        <Paperclip size={20} className="text-gray-500 dark:text-gray-300" />
      </button>

      <input
        type="file"
        accept="image/*,video/*,application/pdf"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}