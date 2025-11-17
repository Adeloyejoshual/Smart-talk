// src/components/Chat/ImagePreview.jsx
import React from "react";
import { FaTimes } from "react-icons/fa";

const ImagePreview = ({ file, onCancel, onSend }) => {
  if (!file) return null;

  const url = URL.createObjectURL(file);

  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 z-50 flex flex-col justify-center items-center">
      <div className="relative w-full max-w-md rounded-xl overflow-hidden">
        <img src={url} alt="preview" className="w-full rounded-xl" />

        <button
          onClick={onCancel}
          className="absolute top-3 right-3 bg-white p-2 rounded-full"
        >
          <FaTimes size={16} />
        </button>
      </div>

      <button
        onClick={onSend}
        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-full"
      >
        Send
      </button>
    </div>
  );
};

export default ImagePreview;
