// src/components/Chat/ChatInput.jsx
import React, { useRef, useState, useEffect } from "react";
import { X, FileText } from "lucide-react";
import Sortable from "react-sortablejs";

const MAX_FILES = 30;
const VISIBLE_THUMBS = 5;

// Helpers
const getFileExtension = (file) => file.name.split(".").pop().toUpperCase();
const isDocument = (file) => {
  const docTypes = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"];
  return docTypes.includes(getFileExtension(file).toLowerCase());
};
const getVideoThumbnail = (file) =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.currentTime = 1;
    video.onloadeddata = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 120;
      canvas.height = 90;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
  });

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  selectedFiles,
  setSelectedFiles,
  isDark,
}) {
  const fileInputRef = useRef(null);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [fileThumbnails, setFileThumbnails] = useState({});

  // Generate video thumbnails
  useEffect(() => {
    selectedFiles.forEach(async (file) => {
      if (file.type.startsWith("video/") && !fileThumbnails[file.name]) {
        const thumb = await getVideoThumbnail(file);
        setFileThumbnails((prev) => ({ ...prev, [file.name]: thumb }));
      }
    });
  }, [selectedFiles]);

  // Handle file selection
  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const combinedFiles = [...selectedFiles, ...files].slice(0, MAX_FILES);
    setSelectedFiles(combinedFiles);
  };

  const removeFile = (index) => {
    const newFiles = [...selectedFiles];
    const removed = newFiles.splice(index, 1)[0];
    setSelectedFiles(newFiles);
    setFileThumbnails((prev) => {
      const copy = { ...prev };
      delete copy[removed.name];
      return copy;
    });
  };

  const displayFiles = showAllFiles
    ? selectedFiles
    : selectedFiles.slice(0, VISIBLE_THUMBS);

  const renderPreview = (file) => {
    if (file.type.startsWith("image/")) {
      return (
        <img
          src={URL.createObjectURL(file)}
          alt={file.name}
          style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }}
        />
      );
    } else if (file.type.startsWith("video/")) {
      const thumb = fileThumbnails[file.name];
      return thumb ? (
        <img
          src={thumb}
          alt={file.name}
          style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }}
        />
      ) : (
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 8,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <FileText size={24} />
        </div>
      );
    } else if (isDocument(file)) {
      return (
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 8,
            background: "#f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#000",
          }}
        >
          <FileText size={20} />
        </div>
      );
    } else {
      return (
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 8,
            background: "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#000",
          }}
        >
          <FileText size={20} />
        </div>
      );
    }
  };

  return (
    <div style={{ padding: 8, background: isDark ? "#1b1b1b" : "#fff" }}>
      {/* File previews */}
      {selectedFiles.length > 0 && (
        <Sortable
          tag="div"
          options={{ animation: 150 }}
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            marginBottom: 8,
            paddingBottom: 4,
          }}
        >
          {displayFiles.map((file, i) => (
            <div
              key={i}
              style={{ position: "relative", cursor: "grab", textAlign: "center" }}
              data-id={i}
              title={file.name}
            >
              {renderPreview(file)}
              <div
                style={{
                  maxWidth: 60,
                  fontSize: 10,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: 2,
                }}
              >
                {file.name}
              </div>
              <button
                onClick={() => removeFile(i)}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "#ff4d4f",
                  border: "none",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
              {i === VISIBLE_THUMBS - 1 &&
                selectedFiles.length > VISIBLE_THUMBS &&
                !showAllFiles && (
                  <div
                    onClick={() => setShowAllFiles(true)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      background: "rgba(0,0,0,0.5)",
                      color: "#fff",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: 8,
                      fontWeight: "bold",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  >
                    +{selectedFiles.length - VISIBLE_THUMBS}
                  </div>
                )}
            </div>
          ))}
        </Sortable>
      )}

      {/* Input bar */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFiles}
          style={{ display: "none" }}
        />
        <button onClick={() => fileInputRef.current.click()}>📎</button>
        <input
          type="text"
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            outline: "none",
            background: isDark ? "#0b0b0b" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
        />
        <button onClick={sendTextMessage}>📩</button>
      </div>
    </div>
  );
}