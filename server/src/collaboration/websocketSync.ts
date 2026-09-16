import * as Y from "yjs";
import type { WebSocket } from "ws";
import { getYDoc } from "./yjsDocumentManager.js";

export const handleWebSocketConnection = (
  socket: WebSocket,
  documentId: string,
): void => {
  const document = getYDoc(documentId);

  socket.send(
    JSON.stringify({
      type: "sync-ready",
      documentId,
      stateSize: Y.encodeStateAsUpdate(document).byteLength,
    }),
  );
};
