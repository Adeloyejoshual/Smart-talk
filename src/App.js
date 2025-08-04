import React, { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import ChatBox from "./components/ChatBox";

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [showRegister, setShowRegister] = useState(false);

  if (!user) {
    return showRegister ? (
      <Register onSwitch={() => setShowRegister(false)} />
    ) : (
      <Login onLogin={setUser} />
    );
  }

  return (
    <div className="App">
      <ChatBox user={user} />
      <button onClick={() => {
        localStorage.clear();
        setUser(null);
      }}>Logout</button>
    </div>
  );
}

export default App;