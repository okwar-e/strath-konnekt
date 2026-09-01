import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { initSocket } from "./socket";
import authRouter from "./routes/auth";

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);

const httpServer = createServer(app);
initSocket(httpServer, CLIENT_URL);

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
