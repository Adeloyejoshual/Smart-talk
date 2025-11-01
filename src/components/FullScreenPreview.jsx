// src/components/FullScreenPreview.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function FullScreenPreview({ media, onClose }) {
  if (!media) return null;

  const isImage = media.type?.startsWith("image/");
  const isVideo = media.type?.startsWith("video/");
  const isAudio = media.type?.startsWith("audio/");

  return (
    <AnimatePresence>
      {media && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white p-2 rounded-full hover:bg-white/20 transition"
          >
            <X size={26} />
          </button>

          {/* Display based on file type */}
          <div className="max-w-3xl w-full flex justify-center items-center">
            {isImage && (
              <motion.img
                key={media.url}
                src={media.url}
                alt="Preview"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="max-h-[80vh] rounded-lg shadow-lg"
              />
            )}

            {isVideo && (
              <motion.video
                key={media.url}
                src={media.url}
                controls
                autoPlay
                className="max-h-[80vh] rounded-lg shadow-lg"
              />
            )}

            {isAudio && (
              <motion.audio
                key={media.url}
                src={media.url}
                controls
                autoPlay
                className="w-[80%] bg-white/10 rounded-lg mt-6"
              />
            )}

            {!isImage && !isVideo && !isAudio && (
              <p className="text-white text-lg">Unsupported file type</p>
            )}
          </div>

          {/* File name */}
          <p className="text-gray-300 text-sm mt-3">{media.name || ""}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}