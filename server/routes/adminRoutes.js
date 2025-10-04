// server/routes/adminRoutes.js
import express from "express";
import { verifyFirebaseToken, requireOwner } from "../utils/authMiddleware.js";
import { broadcastToAll } from "../controllers/adminController.js";

const router = express.Router();

// admin broadcast (real)
// client must send Authorization: Bearer <firebase-id-token>
router.post("/broadcast", verifyFirebaseToken, requireOwner, broadcastToAll);

export default router;
