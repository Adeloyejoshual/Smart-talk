import React from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { Navigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import { motion } from "framer-motion"; // for smooth animation

export default function ProtectedRoute({ children }) {
  const [user, loading] = useAuthState(auth);

  // Show animated spinner while checking auth state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
        <motion.div
          className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
        <motion.p
          className="mt-4 text-lg font-medium text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
        >
          Checking authentication...
        </motion.p>
      </div>
    );
  }

  // Redirect unauthenticated users to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Render children when authenticated
  return children;
}