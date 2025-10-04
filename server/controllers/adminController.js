// server/controllers/adminController.js
import admin from "firebase-admin";

/**
 * Write an admin announcement to Firestore (so clients listening to `admin_announcements` get it).
 * Expects: { message: string, title?: string }
 * Protected: verifyFirebaseToken + requireOwner
 */
export async function broadcastToAll(req, res) {
  try {
    const { message, title } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ message: "Message required" });

    const db = admin.firestore();
    const docRef = await db.collection("admin_announcements").add({
      title: title || "Announcement",
      message: message,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user?.email || req.user?.uid || "owner"
    });

    return res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error("broadcast error:", err);
    return res.status(500).json({ message: err.message || "broadcast failed" });
  }
}
