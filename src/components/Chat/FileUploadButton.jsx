// src/components/Chat/FileUploadButton.jsx
import React from "react";
import { Paperclip } from "lucide-react";

export default function FileUploadButton({ onFileSelect }) {
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files);
    }
    e.target.value = ""; // reset input
  };

  return (
    <label className="cursor-pointer">
      <Paperclip className="text-gray-500 dark:text-gray-300" size={20} />
      <input
        type="file"
        multiple
        hidden
        onChange={handleFileChange}
        accept="image/*,video/*,.pdf,.doc,.docx,.zip,.mp3"
      />
    </label>
  );
}