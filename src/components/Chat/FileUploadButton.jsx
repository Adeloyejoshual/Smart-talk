import React, { useRef } from "react";
import { Paperclip } from "lucide-react"; // your icon library
import { uploadFileWithProgress } from "../../awsS3";

export default function FileUploadButton({ onFileSelect }) {
  const inputRef = useRef(null);

  const handleClick = () => inputRef.current.click();

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    onFileSelect?.(file);
    e.target.value = null; // reset input
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600"
      >
        <Paperclip size={18} />
      </button>
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
}