// /src/pages/ChatRoomPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import useChat from "../hooks/useChat";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Mic,
  Send,
  Paperclip,
  Image as ImageIcon,
  MoreVertical,
  CornerUpLeft,
} from "lucide-react";

export default function ChatRoomPage({ chatId, otherUser, onBack }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const {
    messages,
    sendMessage,
    sendMedia,
    sendVoiceMessage,
    deleteMessage,
    pinMessage,
    unpinMessage,
    setTyping,
    isTyping,
    otherUserStatus,
  } = useChat(chatId, otherUser?.uid);

  const [text, setText] = useState("");
  const [filePreview, setFilePreview] = useState(null);
  const [showActionsFor, setShowActionsFor] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    let t;
    if (text.length > 0) {
      setTyping(true);
      t = setTimeout(() => setTyping(false), 1500);
    } else setTyping(false);
    return () => clearTimeout(t);
  }, [text, setTyping]);

  const handleFilePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    setFilePreview({
      file: f,
      url: URL.createObjectURL(f),
      type: isImage ? "image" : "file",
      name: f.name,
    });
  };

  const sendComposer = async () => {
    if (!text.trim() && !filePreview) return;
    if (filePreview) {
      await sendMedia(
        filePreview.file,
        filePreview.type === "image" ? "image" : "file"
      );
      setFilePreview(null);
      setText("");
      return;
    }
    await sendMessage(text.trim());
    setText("");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendVoiceMessage(blob);
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
      };
      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert("Microphone permission denied");
    }
  };
  const stopRecording = () => recorderRef.current?.stop();

  const renderMessageBody = (m) => {
    if (m.deletedForAll || m.type === "deleted")
      return (
        <em className="text-sm text-gray-500 italic">This message was deleted</em>
      );
    if (m.type === "text") return <div>{m.text}</div>;
    if (m.type === "image")
      return (
        <img
          src={m.url}
          alt="img"
          className="max-w-xs rounded-md object-cover"
        />
      );
    if (m.type === "file")
      return (
        <a
          href={m.url}
          target="_blank"
          rel="noreferrer"
          className="underline text-sm flex items-center gap-2"
        >
          <Paperclip className="w-4 h-4" /> {m.fileName || "File"}
        </a>
      );
    if (m.type === "audio")
      return <audio controls src={m.url} className="w-48" />;
    return <div>{m.text}</div>;
  };

  const handleDeleteForMe = async (m) => {
    await deleteMessage(m.id, false);
    setShowActionsFor(null);
  };
  const handleDeleteForEveryone = async (m) => {
    await deleteMessage(m.id, true);
    setShowActionsFor(null);
  };

  const handlePin = async (m, duration) => {
    await pinMessage(m.id, duration);
    setShowActionsFor(null);
  };
  const handleUnpin = async (m) => {
    await unpinMessage(m.id);
    setShowActionsFor(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <CornerUpLeft className="w-5 h-5" />
          </button>
          <img
            src={otherUser?.photoURL || "/assets/default-avatar.png"}
            alt="avatar"
            className="w-9 h-9 rounded-full"
          />
          <div>
            <div className="font-medium text-sm">{otherUser?.name}</div>
            <div className="text-xs text-gray-500">
              {isTyping
                ? "Typing..."
                : otherUserStatus === "online"
                ? "Online"
                : `Last active ${
                    otherUser?.lastSeen
                      ? formatDistanceToNowStrict(
                          new Date(otherUser.lastSeen)
                        ) + " ago"
                      : ""
                  }`}
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() =>
              alert("Report and Block available in Settings section")
            }
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages
          .filter((m) => m.pinned?.isPinned)
          .length > 0 && (
          <div className="sticky top-0 bg-gray-100 dark:bg-gray-800 p-2 rounded-md mb-2">
            <div className="text-xs font-semibold text-gray-700 mb-1">
              📌 Pinned
            </div>
            <div className="flex gap-3 overflow-x-auto">
              {messages
                .filter((m) => m.pinned?.isPinned)
                .map((pm) => (
                  <div
                    key={pm.id}
                    className="bg-white dark:bg-gray-900 px-3 py-2 rounded-md border text-xs"
                  >
                    {pm.text || pm.fileName}
                  </div>
                ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const isMe = m.senderId === uid;
          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-xl ${
                  isMe
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                }`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setShowActionsFor(m);
                }}
              >
                {renderMessageBody(m)}
                <div className="text-[10px] mt-1 opacity-70">
                  {m.timestamp?.toDate
                    ? new Date(m.timestamp.toDate()).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-3">
        {filePreview && (
          <div className="mb-2 flex items-center gap-3 bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
            {filePreview.type === "image" ? (
              <img
                src={filePreview.url}
                alt="preview"
                className="w-16 h-16 object-cover rounded-md"
              />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center bg-gray-300 rounded-md">
                📎
              </div>
            )}
            <div className="flex-1 text-sm">{filePreview.name}</div>
            <button onClick={() => setFilePreview(null)}>✖</button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
            <ImageIcon className="w-5 h-5" />
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFilePick}
              className="hidden"
              accept="image/*,audio/*,application/pdf,.zip"
            />
          </label>

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-sm rounded-full px-4 py-2 focus:outline-none"
          />

          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`p-2 rounded-full ${
              isRecording ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-700"
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>

          <button
            onClick={sendComposer}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Action Menu */}
      {showActionsFor && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 w-72 space-y-2">
            <h3 className="font-semibold text-sm">Message actions</h3>

            <button
              onClick={() => handleDeleteForMe(showActionsFor)}
              className="w-full text-left text-sm py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Delete for me
            </button>
            <button
              onClick={() => handleDeleteForEveryone(showActionsFor)}
              className="w-full text-left text-sm py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Delete for everyone
            </button>

            {!showActionsFor?.pinned?.isPinned ? (
              <>
                <button
                  onClick={() => handlePin(showActionsFor, "12h")}
                  className="w-full text-left py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm"
                >
                  Pin 12 hours
                </button>
                <button
                  onClick={() => handlePin(showActionsFor, "24h")}
                  className="w-full text-left py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm"
                >
                  Pin 24 hours
                </button>
                <button
                  onClick={() => handlePin(showActionsFor, "7d")}
                  className="w-full text-left py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm"
                >
                  Pin 7 days
                </button>
                <button
                  onClick={() => handlePin(showActionsFor, "30d")}
                  className="w-full text-left py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm"
                >
                  Pin 30 days
                </button>
              </>
            ) : (
              <button
                onClick={() => handleUnpin(showActionsFor)}
                className="w-full text-left py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm"
              >
                Unpin
              </button>
            )}

            <button
              onClick={() => setShowActionsFor(null)}
              className="w-full text-left py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}