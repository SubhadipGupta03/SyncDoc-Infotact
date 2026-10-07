import connectDatabase from "./config/database.js";
import SyncDocumentModel from "./models/document.js";
import {
  signup,
  login,
} from "./auth/auth.js";
import express, {
  type Express,
  type Request,
  type Response,
} from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { handleWebSocketConnection } from "./collaboration/websocketSync.js";
import {transformAstToPdf,
  type PdfDocumentInput,
} from "./transformation/astToPdf.js";
const app: Express = express();

const PORT = 5000;
app.use((req: Request, res: Response, next) => {
  res.header(
    "Access-Control-Allow-Origin",
    "http://localhost:5173",
  );

  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS",
  );

  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type",
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());
app.post("/auth/signup", signup);
app.post("/auth/login", login);

app.post(
  "/documents/pdf",

  (
    req: Request,
    res: Response,
  ): void => {
    const document =
      req.body as PdfDocumentInput;

    transformAstToPdf(
      document,
      res,
    );
  },
);
// NEW: create a document
app.post(
  "/documents",
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const document =
        new SyncDocumentModel(req.body);

      await document.save();

      res.status(201).json(document);
    } catch (error: unknown) {
      console.error(
        "Failed to create document:",
        error,
      );

      res.status(400).json({
        message: "Failed to create document",
      });
    }
  },
);


app.get(
  "/documents",
  async (
    _req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const documents =
        await SyncDocumentModel.find()
          .sort({ updatedAt: -1 })
          .lean();

      res.json(documents);
    } catch (error: unknown) {
      console.error(
        "Failed to load documents:",
        error,
      );

      res.status(500).json({
        message: "Failed to load documents",
      });
    }
  },
);

app.delete(
  "/documents/:id",
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const document =
        await SyncDocumentModel.findByIdAndDelete(
          req.params.id,
        );

      if (!document) {
        res.status(404).json({
          message: "Document not found",
        });
        return;
      }

      res.json({
        message: "Document deleted successfully",
      });
    } catch (error: unknown) {
      console.error(
        "Failed to delete document:",
        error,
      );

      res.status(400).json({
        message: "Failed to delete document",
      });
    }
  },
);

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

  const documentId =
    requestUrl.searchParams.get("documentId");

  const token =
    requestUrl.searchParams.get("token");

  if (!documentId) {
    socket.close(
      1008,
      "documentId is required",
    );
    return;
  }

  if (!token) {
    socket.close(
      1008,
      "authentication required",
    );
    return;
  }

  const JWT_SECRET =
    process.env.JWT_SECRET ??
    "syncdoc-development-secret";

  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET,
    );

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("userId" in decoded) ||
      !("name" in decoded) ||
      !("email" in decoded) ||
      typeof decoded.userId !== "string" ||
      typeof decoded.name !== "string" ||
      typeof decoded.email !== "string"
    ) {
      socket.close(
        1008,
        "invalid authentication",
      );
      return;
    }

    handleWebSocketConnection(
      socket,
      documentId,
      {
        id: decoded.userId,
        name: decoded.name,
      },
    );
  } catch {
    socket.close(
      1008,
      "invalid or expired token",
    );
  }
});

const startServer = async (): Promise<void> => {
  await connectDatabase();

  httpServer.listen(PORT, () => {
    console.log(
      `SyncDoc server running on http://localhost:${PORT}`,
    );
    console.log(
      `SyncDoc WebSocket server running on ws://localhost:${PORT}/ws`,
    );
  });
};

startServer().catch((error: unknown) => {
  console.error("Failed to start SyncDoc server:", error);
  process.exit(1);
});