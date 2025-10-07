import express from "express";
import cors from "cors";
import walletRoutes from "./routes/walletRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Server is running ✅"));
app.use("/api/wallet", walletRoutes);
app.use("/api/call", billingRoutes);

export default app;