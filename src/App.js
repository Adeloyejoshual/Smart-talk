import React, { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Home from "./components/Home";
import PrivateChat from "./components/PrivateChat";
import GroupChat from "./components/GroupChat";
import Settings from "./components/Settings";

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [showRegister, setShowRegister] = useState(false);
  const [currentPage, setCurrentPage] = useState("home"); // home | private | group | settings
  const [selectedChat, setSelectedChat] = useState(null); // userId or groupId for chat

  // Logout
  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setCurrentPage("home");
  };

  if (!user) {
    return showRegister ? (
      <Register onSwitch={() => setShowRegister(false)} />
    ) : (
      <Login onLogin={setUser} onSwitch={() => setShowRegister(true)} />
    );
  }

  // Navigation logic
  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return (
          <Home
            user={user}
            onOpenPrivateChat={(chatId) => {
              setSelectedChat(chatId);
              setCurrentPage("private");
            }}
            onOpenGroupChat={(groupId) => {
              setSelectedChat(groupId);
              setCurrentPage("group");
            }}
            onOpenSettings={() => setCurrentPage("settings")}
          />
        );
      case "private":
        return (
          <PrivateChat
            user={user}
            chatId={selectedChat}
            onBack={() => setCurrentPage("home")}
          />
        );
      case "group":
        return (
          <GroupChat
            user={user}
            groupId={selectedChat}
            onBack={() => setCurrentPage("home")}
          />
        );
      case "settings":
        return (
          <Settings
            user={user}
            onBack={() => setCurrentPage("home")}
            onLogout={handleLogout}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="App bg-gray-100 min-h-screen">
      {renderPage()}
    </div>
  );
}

export default App;