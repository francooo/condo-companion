import "dotenv/config";

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import condosRoutes from "./routes/condos.routes.js";
import usersRoutes from "./routes/users.routes.js";
import financialRoutes from "./routes/financial.routes.js";
import documentsRoutes from "./routes/documents.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import membershipRoutes from "./routes/membership.routes.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:8080" }));
app.use(express.json({ limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/condos", condosRoutes);
app.use("/api", usersRoutes);
app.use("/api", membershipRoutes);
app.use("/api/financial-records", financialRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/chat", chatRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Erros do body-parser (corpo grande demais ou JSON malformado) são do cliente, não do servidor.
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "O arquivo ou conteúdo enviado é grande demais." });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Corpo da requisição inválido." });
  }
  console.error(err);
  res.status(500).json({ error: err.message || "Erro interno do servidor" });
});

export default app;
