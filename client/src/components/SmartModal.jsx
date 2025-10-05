import React, { useEffect } from "react";

const SmartModal = ({
  title,
  message,
  type = "info",
  onConfirm,
  onClose,
  confirmText = "OK",
  autoClose = false,
  duration = 3000, // auto-close after 3 seconds by default
}) => {
  const colors = {
    success: "bg-green-100 text-green-800 border-green-300",
    error: "bg-red-100 text-red-800 border-red-300",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-300",
    info: "bg-blue-100 text-blue-800 border-blue-300",
  };

  // Auto-close effect
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80 max-w-sm text-center border-t-4 transition-all duration-200">
        <div className={`rounded-full p-3 w-fit mx-auto mb-3 ${colors[type]}`}>
          {type === "success" && "✅"}
          {type === "error" && "❌"}
          {type === "warning" && "⚠️"}
          {type === "info" && "ℹ️"}
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 text-sm mb-5">{message}</p>

        {!autoClose && (
          <div className="flex justify-center gap-3">
            {onConfirm && (
              <button
                onClick={onConfirm}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                {confirmText}
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartModal;
