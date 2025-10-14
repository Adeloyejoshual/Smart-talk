// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebaseConfig";

export default function ProtectedRoute({ children }) {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return (
      <div style={{ textAlign: "center", color: "#fff", marginTop: "40vh" }}>
        Checking authentication…
      </div>
    );
  }

  if (!user) {
    // Not signed in → redirect to login page
    return <Navigate to="/login" replace />;
  }

  return children;
}