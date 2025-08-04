import React, { useEffect, useState } from "react";
import API from "../api/api";
import { getGroups } from "../api/groups";

const ChatList = ({ user, setChatTarget }) => {
  const [groupChats, setGroupChats] = useState([]);
  const [userIdInput, setUserIdInput] = useState("");

  useEffect(() => {
    const loadGroups = async () => {
      const data = await getGroups();
      setGroupChats(data);
    };
    loadGroups();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Chat List</h2>

      <div>
        <input
          type="text"
          placeholder="User ID..."
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
          className="w-full px-3 py-2 border rounded mb-2"
        />
        <button
          onClick={() =>
            setChatTarget({ type: "user", id: userIdInput.trim() })
          }
          className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
        >
          Start Private Chat
        </button>
      </div>

      <h3 className="font-medium mt-4">Groups</h3>
      <ul className="space-y-2">
        {groupChats.map((group) => (
          <li
            key={group._id}
            onClick={() => setChatTarget({ type: "group", id: group._id })}
            className="cursor-pointer px-3 py-2 border rounded hover:bg-gray-100"
          >
            {group.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChatList;