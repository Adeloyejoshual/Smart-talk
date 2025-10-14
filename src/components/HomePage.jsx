import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebaseConfig";
import { collection, getDocs, setDoc, doc, query, where } from "firebase/firestore";
import UserCard from "./UserCard";

export default function HomePage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      const usersCol = collection(db, "users");
      const userSnapshot = await getDocs(usersCol);
      const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  // Add new user by Gmail
  const addUserByEmail = async () => {
    const email = prompt("Enter user's Gmail:");
    if (!email) return;

    const userQuery = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(userQuery);

    if (!querySnapshot.empty) {
      alert("User already exists!");
      const existingUser = querySnapshot.docs[0].data();
      navigate(`/chat/${querySnapshot.docs[0].id}`); // redirect to chat
      return;
    }

    // Create new user
    const newUserRef = doc(collection(db, "users"));
    const newUserData = {
      email: email,
      displayName: email.split("@")[0],
      balance: 5, // automatically add $5
    };
    await setDoc(newUserRef, newUserData);

    alert("User added successfully!");

    // Refresh list
    setUsers(prev => [...prev, { id: newUserRef.id, ...newUserData }]);

    // Redirect to chat with new user
    navigate(`/chat/${newUserRef.id}`);
  };

  const handleUserClick = (user) => {
    navigate(`/chat/${user.id}`);
  };

  if (loading) return <p>Loading users...</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h2>All Users</h2>
      <div>
        {users.map(user => (
          <UserCard key={user.id} user={user} onClick={handleUserClick} />
        ))}
      </div>

      {/* Floating Add User Button */}
      <button
        onClick={addUserByEmail}
        style={{
          position: "fixed",
          bottom: "30px",
          right: "30px",
          padding: "15px 20px",
          borderRadius: "50%",
          backgroundColor: "green",
          color: "#fff",
          border: "none",
          fontSize: "20px",
          cursor: "pointer",
        }}
      >
        +
      </button>
    </div>
  );
}