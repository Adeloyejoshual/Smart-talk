const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
dotenv.config();

const Message = require("../models/Message");
const auth = require("../middleware/verifyToken");
const uploadToCloudinary = require("../utils/cloudinaryUpload");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Memory storage for multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* -------------------- 📸 GROUP CHAT IMAGE UPLOAD -------------------- */
router.post("/group/image", auth, upload.single("image"), async (req, res) => {
  try {
    const { groupId } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No image uploaded" });

    const imageUrl = await uploadToCloudinary(file.buffer);

    const message = new Message({
      sender: req.userId,
      group: groupId,
      text: "",
      image: imageUrl,
    });

    await message.save();
    await message.populate("sender", "username");
    res.status(201).json(message);
  } catch (err) {
    console.error("Group upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* -------------------- 📸 PRIVATE CHAT MULTIPLE IMAGE UPLOAD -------------------- */
router.post("/private/image", auth, upload.array("images", 5), async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!req.files?.length) return res.status(400).json({ message: "No images uploaded" });

    const messages = await Promise.all(req.files.map(async (file) => {
      const imageUrl = await uploadToCloudinary(file.buffer);

      const msg = new Message({
        sender: req.userId,
        receiver: receiverId,
        text: "",
        image: imageUrl,
      });

      await msg.save();
      return msg;
    }));

    res.status(201).json({ success: true, messages });
  } catch (err) {
    console.error("Private image upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;