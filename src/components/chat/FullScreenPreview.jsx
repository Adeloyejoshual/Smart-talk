import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function FullScreenPreview({ media, onClose }) {
  if (!media) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
        onClick={onClose}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/60 p-2 rounded-full"
        >
          <X size={20} />
        </button>

        <div
          className="max-w-full max-h-full flex items-center justify-center px-4"
          onClick={(e) => e.stopPropagation()} // prevent closing when clicking media
        >
          {/* Image preview */}
          {media.type?.startsWith("image/") && (
            <motion.img
              src={media.url}
              alt="Preview"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-lg"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}

          {/* Video preview */}
          {media.type?.startsWith("video/") && (
            <motion.video
              src={media.url}
              controls
              className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-lg"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}

          {/* Audio preview */}
          {media.type?.startsWith("audio/") && (
            <motion.audio
              src={media.url}
              controls
              className="w-[90vw] max-w-md"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}