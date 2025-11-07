// src/components/Chat/FileUploadButton.jsx
import React, { useRef } from "react";
import { uploadFileWithProgress } from "../../awsS3";

export default function FileUploadButton({ onFileSelect }) {
  const fileInputRef = useRef();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    onFileSelect(file);
    fileInputRef.current.value = ""; // reset input
  };

  return (
    <>
      <button
        type="button"
        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        onClick={() => fileInputRef.current.click()}
      >
        📎
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}