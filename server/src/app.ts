import "dotenv/config";

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import condosRoutes from "./routes/condos.routes.js";
import usersRoutes from "./routes/users.routes.js";
import financialRoutes from "./routes/financial.routes.js";
import documentsRoutes from "./routes/documents.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:8080" }));
app.use(express.json({ limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/condos", condosRoutes);
app.use("/api", usersRoutes);
app.use("/api/financial-records", financialRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/chat", chatRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Erro interno do servidor" });
});

export default app;
