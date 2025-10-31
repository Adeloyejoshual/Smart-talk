import React, { useState, useEffect } from "react";
import { FaPlay, FaPause, FaFileAlt } from "react-icons/fa";
import { FiCheck, FiCheckCircle } from "react-icons/fi";

export default function MessageBubble({
  message,
  isOwn,
  onLongPress,
  onReply,
}) {
  const [pressTimer, setPressTimer] = useState(null);
  const [audio, setAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 🎧 Handle audio play/pause
  useEffect(() => {
    if (message.type === "audio") {
      const a = new Audio(message.content);
      setAudio(a);
      return () => a.pause();
    }
  }, [message]);

  const handlePlay = () => {
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // ⏱️ Long press detection
  const handleTouchStart = () => {
    const timer = setTimeout(() => onLongPress(message), 400);
    setPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  // 🕒 Timestamp formatting
  const formatTime = (ts) => {
    if (!ts?.seconds) return "";
    const date = new Date(ts.seconds * 1000);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      className={`flex ${isOwn ? "justify-end" : "justify-start"} w-full`}
    >
      <div
        className={`relative max-w-[80%] p-2 rounded-2xl shadow-md ${
          isOwn
            ? "bg-sky-500 text-white rounded-br-none"
            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none"
        }`}
      >
        {/* 💬 Reply preview */}
        {message.replyTo && (
          <div
            className={`text-xs italic mb-1 border-l-2 pl-2 ${
              isOwn ? "border-white" : "border-sky-400"
            }`}
          >
            Replying to: {message.replyTo.slice(0, 25)}...
          </div>
        )}

        {/* 📄 Message types */}
        {message.type === "text" && <p>{message.content}</p>}

        {message.type === "image" && (
          <img
            src={message.content}
            alt="image"
            className="rounded-xl max-h-60 object-cover cursor-pointer mt-1"
            onClick={() => window.open(message.content, "_blank")}
          />
        )}

        {message.type === "video" && (
          <video
            src={message.content}
            controls
            className="rounded-xl max-h-64 mt-1"
          />
        )}

        {message.type === "audio" && (
          <button
            onClick={handlePlay}
            className="flex items-center gap-2 bg-white/10 rounded-lg p-2"
          >
            {isPlaying ? (
              <FaPause className="text-lg" />
            ) : (
              <FaPlay className="text-lg" />
            )}
            <span className="text-sm">Audio</span>
          </button>
        )}

        {message.type === "file" && (
          <a
            href={message.content}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-white/10 rounded-lg"
          >
            <FaFileAlt />
            <span className="truncate text-sm">{message.fileName}</span>
          </a>
        )}

        {/* ✏️ Edited label */}
        {message.isEdited && (
          <span className="text-[10px] opacity-70 ml-1">(edited)</span>
        )}

        {/* 🕒 Time + tick */}
        <div
          className={`text-[10px] mt-1 flex items-center justify-end ${
            isOwn ? "text-white/80" : "text-gray-400"
          }`}
        >
          {formatTime(message.createdAt)}
          {isOwn && (
            <FiCheckCircle className="ml-1 text-xs text-white/70 dark:text-sky-400" />
          )}
        </div>
      </div>
    </div>
  );
}