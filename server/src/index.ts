import app from "./app.js";

const port = Number(process.env.PORT) || 4002;
app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
