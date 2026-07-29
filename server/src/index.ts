import app from "./app";

const port = Number(process.env.PORT) || 4002;
app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
