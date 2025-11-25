// src/components/ProtectedRoute.jsx  
import React, { useEffect, useState, useContext } from "react";  
import { Navigate } from "react-router-dom";  
import { onAuthStateChanged } from "firebase/auth";  
import { auth } from "../firebaseConfig";  
import { ThemeContext } from "../context/ThemeContext";  
  
export default function ProtectedRoute({ children }) {  
  const [user, setUser] = useState(null);  
  const [checking, setChecking] = useState(true);  
  const [fadeOut, setFadeOut] = useState(false);  
  const { theme, wallpaper } = useContext(ThemeContext);  
  const isDark = theme === "dark";  
  
  useEffect(() => {  
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {  
      setTimeout(() => {  
        setUser(currentUser);  
        setFadeOut(true);  
        setTimeout(() => setChecking(false), 800);  
      }, 800);  
    });  
    return () => unsubscribe();  
  }, []);  
  
  if (checking) {  
    return (  
      <div  
        style={{  
          height: "100vh",  
          width: "100%",  
          display: "flex",  
          flexDirection: "column",  
          alignItems: "center",  
          justifyContent: "center",  
          background: wallpaper  
            ? `url(${wallpaper}) center/cover no-repeat`  
            : isDark  
            ? "#050505"  
            : "#fafafa",  
          color: isDark ? "#fff" : "#000",  
          fontFamily: "system-ui, sans-serif",  
          opacity: fadeOut ? 0 : 1,  
          transition: "opacity 0.8s ease",  
        }}  
      >  
        {/* Loechat Logo Circle */}  
        <div  
          style={{  
            width: 110,  
            height: 110,  
            borderRadius: "50%",  
            display: "flex",  
            alignItems: "center",  
            justifyContent: "center",  
            position: "relative",  
            background: "linear-gradient(135deg, #1E6FFB, #0047B3)",  
            backgroundSize: "300% 300%",  
            animation: "gradientShift 5s ease infinite, pulseGlow 2.2s ease-in-out infinite",  
            boxShadow: "0 0 40px 6px rgba(30,111,251,0.45)",  
          }}  
        >  
          {/* Spinner */}  
          <div  
            style={{  
              position: "absolute",  
              width: "100%",  
              height: "100%",  
              borderRadius: "50%",  
              border: "4px solid rgba(255,255,255,0.2)",  
              borderTop: "4px solid rgba(255,255,255,0.9)",  
              animation: "spin 1.4s linear infinite",  
            }}  
          />  
  
          {/* L Logo */}  
          <span  
            style={{  
              fontSize: 60,  
              fontWeight: 900,  
              color: "#fff",  
              zIndex: 2,  
              textShadow: "0 0 12px rgba(255,255,255,0.8)",  
              letterSpacing: 2,  
            }}  
          >  
            L  
          </span>  
        </div>  
  
        {/* Loechat Text */}  
        <h2  
          style={{  
            marginTop: 30,  
            fontWeight: 700,  
            fontSize: 22,  
            letterSpacing: 0.8,  
            animation: "fadeSlide 1.2s ease-in-out infinite alternate",  
            background: "linear-gradient(90deg, #1E6FFB, #0047B3)",  
            backgroundSize: "300% 300%",  
            WebkitBackgroundClip: "text",  
            WebkitTextFillColor: "transparent",  
          }}  
        >  
          Loading Loechat…  
        </h2>  
  
        <style>  
          {`  
            @keyframes spin {  
              0% { transform: rotate(0deg); }  
              100% { transform: rotate(360deg); }  
            }  
            @keyframes gradientShift {  
              0% { background-position: 0% 50%; }  
              50% { background-position: 100% 50%; }  
              100% { background-position: 0% 50%; }  
            }  
            @keyframes fadeSlide {  
              0% { opacity: 0.6; transform: translateY(4px); }  
              100% { opacity: 1; transform: translateY(-2px); }  
            }  
            @keyframes pulseGlow {  
              0%, 100% { box-shadow: 0 0 30px 5px rgba(30,111,251,0.35); transform: scale(1); }  
              50% { box-shadow: 0 0 55px 8px rgba(30,111,251,0.6); transform: scale(1.05); }  
            }  
          `}  
        </style>  
      </div>  
    );  
  }  
  
  if (!user) return <Navigate to="/" replace />;  
  return children;  
}