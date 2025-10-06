// /server/index.js
import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import callRoutes from "./routes/callRoutes.js";
import authMiddleware from "./middleware/auth.js";

// 🔥 Initialize Admin SDK
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors());
app.use(express.json());

// protect /api/call routes with auth middleware
app.use("/api/call", authMiddleware, callRoutes);

app.get("/", (req, res) => res.send("Call billing API running"));
app.listen(8080, () => console.log("Server running on port 8080"));