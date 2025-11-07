// src/components/Chat/FullScreenPreview.jsx
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function FullScreenPreview({
  files,
  activeIndex = 0,
  onClose,
  onPrev,
  onNext,
}) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext]);

  if (!files?.length) return null;
  const file = files[activeIndex];

  return (
    <AnimatePresence>
      {file && (
        <motion.div
          key={file.url}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative max-w-[95vw] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {file.type.startsWith("image") ? (
              <img
                src={file.url}
                alt="Preview"
                className="max-h-[90vh] max-w-[95vw] object-contain"
              />
            ) : (
              <video
                src={file.url}
                controls
                autoPlay
                className="max-h-[90vh] max-w-[95vw] object-contain bg-black"
              />
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition"
            >
              <X size={22} />
            </button>

            {/* Navigation Arrows (Desktop only) */}
            {files.length > 1 && (
              <>
                <button
                  onClick={onPrev}
                  className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full"
                >
                  <ChevronLeft size={26} />
                </button>
                <button
                  onClick={onNext}
                  className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full"
                >
                  <ChevronRight size={26} />
                </button>
              </>
            )}

            {/* Dots indicator */}
            {files.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                {files.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx === activeIndex
                        ? "bg-white scale-110"
                        : "bg-white/40 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}