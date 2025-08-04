const express = require("express");
const router = express.Router();
const Group = require("../models/Group");
const verifyToken = require("../middleware/verifyToken");
const User = require("../models/User");

// @route   POST /api/groups
// @desc    Create a new group
// @access  Private
router.post("/", verifyToken, async (req, res) => {
  const { name } = req.body;

  if (!name) return res.status(400).json({ message: "Group name is required" });

  try {
    const group = await Group.create({
      name,
      members: [req.userId],
    });

    res.status(201).json({ success: true, group });
  } catch (err) {
    console.error("Create group error:", err);
    res.status(500).json({ message: "Failed to create group" });
  }
});

// @route   GET /api/groups/my
// @desc    Get all groups the user belongs to
// @access  Private
router.get("/my", verifyToken, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userId });
    res.json(groups);
  } catch (err) {
    console.error("Fetch user groups error:", err);
    res.status(500).json({ message: "Failed to load groups" });
  }
});

// @route   POST /api/groups/:groupId/add-member
// @desc    Add a user to a group
// @access  Private
router.post("/:groupId/add-member", verifyToken, async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body;

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (!group.members.includes(req.userId)) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    if (group.members.includes(userId)) {
      return res.status(400).json({ message: "User already in group" });
    }

    group.members.push(userId);
    await group.save();

    res.json({ message: "Member added", group });
  } catch (err) {
    console.error("Add group member error:", err);
    res.status(500).json({ message: "Failed to add member" });
  }
});

module.exports = router;