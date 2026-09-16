import express, {
  type Express,
  type Request,
  type Response,
} from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { handleWebSocketConnection } from "./collaboration/websocketSync.js";

const app: Express = express();

const PORT = 5000;

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "SyncDoc backend is running",
  });
});

const httpServer = createServer(app);

const webSocketServer = new WebSocketServer({
  server: httpServer,
  path: "/ws",
});

webSocketServer.on("connection", (socket, request) => {
  const requestUrl = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );

  const documentId = requestUrl.searchParams.get("documentId");

  if (!documentId) {
    socket.close(1008, "documentId is required");
    return;
  }

  handleWebSocketConnection(socket, documentId);
});

httpServer.listen(PORT, () => {
  console.log(
    `SyncDoc server running on http://localhost:${PORT}`,
  );
  console.log(
    `SyncDoc WebSocket server running on ws://localhost:${PORT}/ws`,
  );
});