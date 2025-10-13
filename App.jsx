import React, { useContext } from "react";
import HomePage from "./HomePage";
import { ThemeContext } from "./ThemeContext";

export default function App() {
  const { theme, wallpaper } = useContext(ThemeContext);

  return (
    <div
      className={`app-container ${theme}-theme`}
      style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : "none", backgroundSize: "cover", minHeight: "100vh" }}
    >
      <HomePage />
    </div>
  );
}