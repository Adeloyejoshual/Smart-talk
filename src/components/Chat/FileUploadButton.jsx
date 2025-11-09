import React from "react";
import { Paperclip } from "lucide-react";

export default function FileUploadButton({ onFileSelect }) {
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) onFileSelect(files);
    e.target.value = null; // reset
  };

  return (
    <label className="cursor-pointer">
      <Paperclip size={18} className="text-gray-500" />
      <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.zip,.mp3" onChange={handleFileChange} hidden />
    </label>
  );
}