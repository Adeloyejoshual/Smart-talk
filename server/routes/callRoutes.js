// server/routes/callRoutes.js
import express from "express";
import { verifyFirebaseToken } from "../utils/authMiddleware.js";
import { startCall, endCall } from "../controllers/callController.js";

const router = express.Router();

// All call endpoints require Firebase token
router.post("/start", verifyFirebaseToken, startCall);
router.post("/end", verifyFirebaseToken, endCall);

export default router;
