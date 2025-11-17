import React from "react";

export default function ImagePreview({ url, onClose }) {
  return (
    <div className="image-preview-overlay" onClick={onClose}>
      <img src={url} alt="preview" />
    </div>
  );
}