// /src/routes/walletRoutes.js
import express from "express";
import { addCredit, getWallet } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/add", addCredit);
router.get("/:userId", getWallet);

export default router;