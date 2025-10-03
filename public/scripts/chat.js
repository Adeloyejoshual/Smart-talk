import express from "express";
const router = express.Router();

// Dummy for now → later fetch from Firestore
router.get("/list", (req, res) => {
  res.json([
    { id: "1", name: "Family Group", last: "Mom: Don’t forget milk", time: "09:30" },
    { id: "2", name: "John Doe", last: "Hey, are you free?", time: "12:45" }
  ]);
});

export default router;