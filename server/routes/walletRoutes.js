import express from "express";
import { getBalance, addCredit, sendCredit } from "../controllers/walletController.js";
const router = express.Router();

router.get("/:uid", getBalance);
router.post("/add", addCredit);
router.post("/send", sendCredit);

export default router;
