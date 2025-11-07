// src/components/Chat/FullScreenPreview.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function FullScreenPreview({ media, startIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex]);

  const next = () => setCurrentIndex((prev) => (prev + 1) % media.length);
  const prev = () =>
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);

  if (!media?.length) return null;
  const item = media[currentIndex];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-black/60 p-2 rounded-full text-white hover:bg-black/80"
        >
          <X size={20} />
        </button>

        {/* Navigation arrows */}
        {media.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 p-2 rounded-full text-white hover:bg-black/80"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={next}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 p-2 rounded-full text-white hover:bg-black/80"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        {/* Media content */}
        <motion.div
          key={item.url}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.25 }}
          className="max-w-full max-h-[85vh] flex items-center justify-center"
        >
          {item.type?.startsWith("image/") ? (
            <img
              src={item.url}
              alt="preview"
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
          ) : item.type?.startsWith("video/") ? (
            <video
              src={item.url}
              controls
              autoPlay
              className="max-h-[85vh] max-w-full rounded-lg"
            />
          ) : null}
        </motion.div>

        {/* Counter */}
        {media.length > 1 && (
          <div className="absolute bottom-5 text-white text-sm opacity-75">
            {currentIndex + 1} / {media.length}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}