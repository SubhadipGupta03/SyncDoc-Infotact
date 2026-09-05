import express, { type Express, type Request, type Response } from "express";

const app: Express = express();

const PORT = 5000;

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "SyncDoc backend is running",
  });
});

app.listen(PORT, () => {
  console.log(`SyncDoc server running on http://localhost:${PORT}`);
});