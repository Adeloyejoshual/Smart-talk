// src/components/WithdrawPage.jsx
import React, { useState, useEffect } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function WithdrawPage() {
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const navigate = useNavigate();

  // AUTH + LOAD BALANCE
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (userAuth) {
        setUser(userAuth);
        const docRef = doc(db, "users", userAuth.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCredits(docSnap.data().credits || 0);
        } else {
          await setDoc(docRef, { credits: 5 }); // new user bonus
          setCredits(5);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // TASK REWARDS
  const updateCredits = async (amount) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const newCredits = credits + amount;
    await updateDoc(userRef, { credits: newCredits });
    setCredits(newCredits);
  };

  const handleFollowInstagram = () => {
    window.open("https://www.instagram.com/hahahala53", "_blank");
    updateCredits(0.5);
  };

  const handleWatchVideo = () => {
    window.open(
      "https://youtube.com/shorts/mQOV18vpAu4?si=8gyR6f-eAK4SGSyw",
      "_blank"
    );
    updateCredits(0.25);
  };

  const handleInviteFriend = () => {
    navigator.clipboard.writeText(`https://yourapp.com/signup?ref=${user.uid}`);
    alert("🔗 Referral link copied! Share with friends.");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 p-6 text-white flex flex-col items-center relative"
    >
      {/* Back Button */}
      <button
        onClick={() => navigate("/wallet")}
        className="absolute top-6 left-6 text-white font-bold text-2xl"
      >
        ⬅
      </button>

      {/* Header */}
      <h2 className="mt-12 text-3xl font-bold mb-2">💵 Withdraw Funds</h2>
      <p className="text-gray-200 mb-6">Manage and withdraw your credits</p>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/20 backdrop-blur-lg rounded-2xl shadow-lg p-6 w-full max-w-md text-center mb-6"
      >
        <h3 className="text-lg font-medium text-gray-200">Your Balance</h3>
        <h1 className="text-4xl font-bold text-green-400">${credits.toFixed(2)}</h1>
      </motion.div>

      {/* Withdraw Button (Coming Soon) */}
      <button
        disabled
        className="w-full max-w-md py-3 mb-8 rounded-xl bg-gray-600 text-white font-semibold cursor-not-allowed transition"
      >
        🚧 Withdraw (Coming Soon)
      </button>

      {/* Earn More Section */}
      <h3 className="text-xl font-semibold mb-4">🎯 Complete Tasks to Earn Credits</h3>
      <div className="w-full max-w-md flex flex-col gap-4">
        <button onClick={handleWatchVideo} className={taskButtonClass}>
          🎥 Watch a video → +$0.25
        </button>
        <button onClick={handleFollowInstagram} className={taskButtonClass}>
          📱 Follow us on Instagram → +$0.50
        </button>
        <button onClick={handleInviteFriend} className={taskButtonClass}>
          👥 Invite a friend → +$0.50 per join
        </button>
      </div>
    </motion.div>
  );
}

const taskButtonClass =
  "w-full py-3 px-5 rounded-lg font-semibold text-left bg-blue-500 hover:bg-blue-600 transition text-white";