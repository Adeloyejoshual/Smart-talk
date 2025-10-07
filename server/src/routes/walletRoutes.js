import express from "express";
import {
  getBalance,
  creditWallet,
  debitWallet,
} from "../controllers/walletController.js";

const router = express.Router();

router.get("/balance/:uid", getBalance);
router.post("/credit", creditWallet);
router.post("/debit", debitWallet);

export default router;