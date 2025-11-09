import React from "react";
import { FileText, Download } from "lucide-react";

export default function MessageBubble({ msg, isOwn }) {
  const isImage = msg.fileType?.startsWith("image/") || msg.type === "image";
  const isVideo = msg.fileType?.startsWith("video/") || msg.type === "video";
  const isFile = msg.type === "file" || (msg.fileUrl && !isImage && !isVideo);

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div className={`p-3 rounded-2xl max-w-[75%] ${isOwn ? "bg-blue-500 text-white" : "bg-gray-100 text-black dark:bg-gray-700"}`}>
        {msg.type === "text" && <div className="whitespace-pre-wrap">{msg.text}</div>}

        {isImage && msg.fileUrl && (
          <img src={msg.fileUrl} alt={msg.fileName || "image"} className="mt-2 rounded max-h-64 object-cover" />
        )}

        {isVideo && msg.fileUrl && (
          <video controls className="mt-2 rounded max-h-64 w-full">
            <source src={msg.fileUrl} type={msg.fileType} />
          </video>
        )}

        {isFile && msg.fileUrl && (
          <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 p-2 border rounded">
            <FileText />
            <div className="text-xs break-all">{msg.fileName}</div>
            <Download className="ml-auto" />
          </a>
        )}

        {msg.timestamp && (
          <div className="text-xs mt-2 text-right opacity-80">
            {new Date(msg.timestamp?.toDate?.() || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}