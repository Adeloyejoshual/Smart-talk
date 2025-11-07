import React, { useState, useRef } from "react";
import { uploadFileWithProgress } from "../../awsS3";
import {
  Paperclip,
  X,
  Send,
  Maximize2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FileUploadButton({ chatId, onUploadComplete }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [fullScreenIndex, setFullScreenIndex] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    const previews = selected.map((file) => ({
      file,
      url: file.type.startsWith("image/") || file.type.startsWith("video/")
        ? URL.createObjectURL(file)
        : null,
      caption: "",
    }));
    setFiles(previews);
  };

  const updateCaption = (index, value) => {
    setFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, caption: value } : item))
    );
  };

  const cancelUpload = () => {
    setFiles([]);
    setProgress({});
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startUpload = async () => {
    setUploading(true);
    try {
      for (const item of files) {
        const { file, caption } = item;
        const url = await uploadFileWithProgress(file, chatId, (p) =>
          setProgress((prev) => ({ ...prev, [file.name]: p }))
        );
        onUploadComplete(url, file.type, caption);
      }
      cancelUpload();
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Try again.");
      setUploading(false);
    }
  };

  const handleSwipe = (event, info) => {
    const offset = info.offset.x;
    if (offset < -100 && fullScreenIndex < files.length - 1) {
      setFullScreenIndex((prev) => prev + 1);
    } else if (offset > 100 && fullScreenIndex > 0) {
      setFullScreenIndex((prev) => prev - 1);
    }
  };

  return (
    <>
      {!files.length && (
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,application/pdf"
            multiple
            onChange={handleFileChange}
          />
          <Paperclip size={22} className="text-gray-500 hover:text-blue-500" />
        </label>
      )}

      <AnimatePresence>
        {files.length > 0 && (
          <>
            {/* Overlay */}
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cancelUpload}
            />

            {/* Bottom Sheet */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl p-4 shadow-2xl max-w-md mx-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 120, damping: 15 }}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-gray-800 font-semibold text-base">
                  {files.length > 1
                    ? `Preview (${files.length} files)`
                    : "Preview"}
                </h3>
                <button
                  onClick={cancelUpload}
                  className="bg-gray-100 p-1.5 rounded-full hover:bg-gray-200"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pb-2">
                {files.map((item, index) => (
                  <div
                    key={item.file.name}
                    className="relative bg-gray-50 rounded-lg overflow-hidden shadow-sm"
                  >
                    {item.url && (
                      <div
                        className="relative"
                        onClick={() => setFullScreenIndex(index)}
                      >
                        {item.file.type.startsWith("image/") && (
                          <img
                            src={item.url}
                            alt={item.file.name}
                            className="object-cover w-full max-h-64 cursor-pointer"
                          />
                        )}
                        {item.file.type.startsWith("video/") && (
                          <video
                            src={item.url}
                            className="object-cover w-full max-h-64 cursor-pointer"
                            controls
                          />
                        )}
                        <button className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white">
                          <Maximize2 size={14} />
                        </button>
                      </div>
                    )}

                    <div className="p-3">
                      <input
                        type="text"
                        placeholder="Add a caption..."
                        value={item.caption}
                        onChange={(e) => updateCaption(index, e.target.value)}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>

                    {uploading && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                        <div
                          className="bg-blue-500 h-1"
                          style={{
                            width: `${(progress[item.file.name] || 0) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-end">
                {!uploading ? (
                  <button
                    onClick={startUpload}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-medium"
                  >
                    <Send size={16} /> Send
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">Uploading...</p>
                )}
              </div>
            </motion.div>

            {/* Fullscreen Viewer with Swipe */}
            <AnimatePresence>
              {fullScreenIndex !== null && (
                <motion.div
                  className="fixed inset-0 bg-black z-[9999] flex flex-col"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center justify-between p-4 text-white bg-black/40">
                    <button
                      onClick={() => setFullScreenIndex(null)}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft /> <span>Back</span>
                    </button>
                    <span className="text-sm opacity-75">
                      {fullScreenIndex + 1}/{files.length}
                    </span>
                  </div>

                  <motion.div
                    className="flex-1 flex items-center justify-center overflow-hidden"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={handleSwipe}
                  >
                    {files[fullScreenIndex]?.file?.type.startsWith("image/") ? (
                      <img
                        src={files[fullScreenIndex].url}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <video
                        src={files[fullScreenIndex].url}
                        className="max-h-full max-w-full object-contain"
                        controls
                        autoPlay
                      />
                    )}
                  </motion.div>

                  {/* Optional navigation arrows for desktop */}
                  <div className="absolute inset-y-0 left-0 flex items-center px-4">
                    {fullScreenIndex > 0 && (
                      <ChevronLeft
                        className="text-white cursor-pointer opacity-75 hover:opacity-100"
                        onClick={() => setFullScreenIndex((prev) => prev - 1)}
                        size={32}
                      />
                    )}
                  </div>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4">
                    {fullScreenIndex < files.length - 1 && (
                      <ChevronRight
                        className="text-white cursor-pointer opacity-75 hover:opacity-100"
                        onClick={() => setFullScreenIndex((prev) => prev + 1)}
                        size={32}
                      />
                    )}
                  </div>

                  <div className="p-4 bg-black/70">
                    <input
                      type="text"
                      value={files[fullScreenIndex]?.caption || ""}
                      onChange={(e) =>
                        updateCaption(fullScreenIndex, e.target.value)
                      }
                      placeholder="Add a caption..."
                      className="w-full bg-transparent border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>
    </>
  );
}