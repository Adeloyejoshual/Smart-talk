import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import API from "../api/api";
import { getGroups, createGroup } from "../api/groups";
import axios from "axios";

const socket = io("http://localhost:3000", {
  auth: { token: localStorage.getItem("token") },
});

const ChatBox = ({ user }) => {
  const [recipientId, setRecipientId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [typing, setTyping] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMember, setGroupMember] = useState("");

  useEffect(() => {
    socket.emit("join", user.id);
    fetchGroups();
  }, []);

  useEffect(() => {
    if (!recipientId && !groupId) return;

    socket.off("receive_message");
    socket.off("receive_group_message");

    if (recipientId) {
      API.get(`/messages/${recipientId}`).then((res) => setMessages(res.data));
      socket.on("receive_message", (msg) => {
        if (msg.sender === recipientId) {
          setMessages((prev) => [...prev, msg]);
        }
      });
    }

    if (groupId) {
      API.get(`/messages/group/${groupId}`).then((res) => setMessages(res.data));
      socket.on("receive_group_message", (msg) => {
        if (msg.group === groupId) {
          setMessages((prev) => [...prev, msg]);
        }
      });
    }
  }, [recipientId, groupId]);

  const fetchGroups = async () => {
    const data = await getGroups();
    setGroups(data);
  };

  const sendMessage = () => {
    if (!content.trim()) return;

    if (recipientId) {
      socket.emit("send_message", { to: recipientId, content });
    } else if (groupId) {
      socket.emit("send_group_message", { groupId, content });
    }
    setContent("");
  };

  const handleTyping = () => {
    if (recipientId) socket.emit("typing", { to: recipientId });
  };

  const handleGroupCreate = async () => {
    const res = await createGroup(groupName, [groupMember]);
    alert(`Group "${res.name}" created`);
    setGroupName("");
    setGroupMember("");
    fetchGroups();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem("token");

    try {
      const res = await axios.post("http://localhost:3000/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      const imageUrl = res.data.url;

      // Send as chat message
      if (recipientId) {
        socket.emit("send_message", { to: recipientId, content: imageUrl });
      } else if (groupId) {
        socket.emit("send_group_message", { groupId, content: imageUrl });
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Image upload failed");
    }
  };

  const renderMessage = (msg, i) => {
    const isImage = msg.content.startsWith("http") && /\.(jpg|jpeg|png|gif)/i.test(msg.content);
    return (
      <div key={i}>
        <b>{msg.sender === user.id ? "You" : msg.sender}:</b>{" "}
        {isImage ? (
          <img src={msg.content} alt="img" width="120" style={{ margin: "5px 0" }} />
        ) : (
          msg.content
        )}
      </div>
    );
  };

  return (
    <div>
      <h3>Welcome, {user.username}</h3>

      <div style={{ marginBottom: 10 }}>
        <h4>Chat Options</h4>
        <input
          placeholder="Private user ID"
          value={recipientId}
          onChange={(e) => {
            setRecipientId(e.target.value);
            setGroupId("");
          }}
        />
        <br />
        <select
          onChange={(e) => {
            setGroupId(e.target.value);
            setRecipientId("");
          }}
        >
          <option value="">-- Select Group --</option>
          {groups.map((g) => (
            <option value={g._id} key={g._id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ border: "1px solid #aaa", height: 200, overflowY: "scroll", marginBottom: 10 }}>
        {messages.map(renderMessage)}
      </div>

      {typing && <i>Typing...</i>}
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleTyping}
        placeholder="Message..."
      />
      <button onClick={sendMessage}>Send</button>
      <input type="file" accept="image/*" onChange={handleFileUpload} style={{ marginLeft: 10 }} />

      <hr />
      <h4>Create Group</h4>
      <input
        placeholder="Group Name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
      />
      <input
        placeholder="Member User ID"
        value={groupMember}
        onChange={(e) => setGroupMember(e.target.value)}
      />
      <button onClick={handleGroupCreate}>Create</button>
    </div>
  );
};

export default ChatBox;