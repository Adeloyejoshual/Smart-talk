import React, { useEffect, useState } from "react"; import { doc, getDoc, updateDoc } from "firebase/firestore"; import { auth, db } from "../firebaseConfig"; import { useParams } from "react-router-dom"; import { Button } from "@/components/ui/button"; import { Card, CardContent } from "@/components/ui/card";

export default function UserProfile() { const { uid } = useParams(); // UID of the profile being viewed const currentUser = auth.currentUser;

const [profile, setProfile] = useState(null); const [loading, setLoading] = useState(true); const [editing, setEditing] = useState(false);

const [form, setForm] = useState({ displayName: "", bio: "", email: "", });

useEffect(() => { const fetchProfile = async () => { try { const ref = doc(db, "users", uid); const snap = await getDoc(ref); if (snap.exists()) { const data = snap.data(); setProfile(data); setForm({ displayName: data.displayName || "", bio: data.bio || "", email: data.email || "", }); } setLoading(false); } catch (err) { console.error("Profile fetch error", err); setLoading(false); } }; fetchProfile(); }, [uid]);

const isOwner = currentUser && currentUser.uid === uid;

const handleSave = async () => { try { const ref = doc(db, "users", uid); await updateDoc(ref, { displayName: form.displayName, bio: form.bio, email: form.email, }); setEditing(false); } catch (err) { console.error("Update error", err); } };

if (loading) return <p className="text-center p-4">Loading...</p>;

return ( <div className="profile-header" style={{ display:'flex', alignItems:'center', padding:'12px', background:'#1877F2', color:'#fff' }}> <button onClick={() => navigate(-1)} style={{ marginRight:'12px', background:'none', border:'none', color:'#fff', fontSize:'20px', cursor:'pointer' }}>←</button> <span style={{ fontSize:'18px', fontWeight:'600' }}>Profile</span> </div>

<div className="w-full max-w-xl mx-auto p-4">
  <Card className="rounded-2xl shadow-md">
    <CardContent className="p-6 space-y-4">
      <h2 className="text-2xl font-bold mb-2">User Profile</h2>

      {/* Show profile info */}
      {!editing ? (
        <div className="space-y-3">
          <p><strong>Name:</strong> {profile.displayName}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Bio:</strong> {profile.bio}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            className="w-full border p-2 rounded"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="Name"
          />
          <input
            className="w-full border p-2 rounded"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
          />
          <textarea
            className="w-full border p-2 rounded"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Bio"
          />
        </div>
      )}

      {/* Buttons */}
      {isOwner && (
        <div className="flex gap-2 pt-3">
          {!editing ? (
            <Button onClick={() => setEditing(true)}>Edit Profile</Button>
          ) : (
            <>
              <Button onClick={handleSave}>Save</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </>
          )}
        </div>
      )}
    </CardContent>
  </Card>
</div>

); }
