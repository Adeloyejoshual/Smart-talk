import express from "express";
import { auth, db } from "../firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, setDoc, getDocs, collection, query, where } from "firebase/firestore";

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  const { username, name, email, password } = req.body;
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;

    await setDoc(doc(db, "users", uid), {
      uid,
      username,
      name,
      email,
      photoUrl: "",
      walletBalance: 0,
      freeTrialEnd: new Date(Date.now() + 90*24*60*60*1000).toISOString()
    });

    res.json({ success: true, uid });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// LOGIN (username OR email)
router.post("/login", async (req, res) => {
  const { input, password } = req.body;
  try {
    let email = input;
    if (!input.includes("@")) {
      const q = query(collection(db, "users"), where("username", "==", input));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error("Username not found");
      email = snap.docs[0].data().email;
    }

    const userCred = await signInWithEmailAndPassword(auth, email, password);
    res.json({ success: true, uid: userCred.user.uid });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// FORGOT PASSWORD
router.post("/reset", async (req, res) => {
  const { email } = req.body;
  try {
    await sendPasswordResetEmail(auth, email);
    res.json({ success: true, message: "Password reset email sent" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;