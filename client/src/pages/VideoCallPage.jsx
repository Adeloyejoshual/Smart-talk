import React, { useEffect, useState } from "react";
import useCallBalanceListener from "../hooks/useCallBalanceListener";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";

export default function VideoCallPage({ callId, otherUser, onEnd }) {
  const [lowBalance, setLowBalance] = useState(false);

  useCallBalanceListener(
    callId,
    () => {
      toast.error("Call ended due to low balance");
      onEnd();
    },
    () => {
      if (!lowBalance) {
        setLowBalance(true);
        toast("Low balance — call will end soon", { icon: "⚠️" });
      }
    }
  );

  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white">
      <h2 className="text-xl font-bold mb-4">Video call with {otherUser.name}</h2>
      {/* your video stream logic here */}

      <AnimatePresence>
        {lowBalance && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 bg-yellow-600 text-white px-4 py-2 rounded-lg"
          >
            Low balance — call will end soon
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}