import { randomUUID } from "node:crypto";
import * as Y from "yjs";
import type { RawData, WebSocket } from "ws";
import { getYDoc } from "./yjsDocumentManager.js";

const STATE_VECTOR_MESSAGE = 0;
const UPDATE_MESSAGE = 1;

interface PresenceUser {
  id: string;
  name: string;
}

interface PresenceMessage {
  type: "presence-update";
  users: PresenceUser[];
}

const documentClients = new Map<string, Set<WebSocket>>();
const clientPresence = new Map<WebSocket, PresenceUser>();

const toUint8Array = (data: RawData): Uint8Array => {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }

  return new Uint8Array(data);
};

const sendYjsMessage = (
  socket: WebSocket,
  messageType: number,
  update: Uint8Array,
): void => {
  const message = new Uint8Array(update.byteLength + 1);

  message[0] = messageType;
  message.set(update, 1);

  socket.send(message);
};

const broadcastPresence = (documentId: string): void => {
  const clients = documentClients.get(documentId);

  if (!clients) {
    return;
  }

  const users: PresenceUser[] = [];

  for (const client of clients) {
    const presence = clientPresence.get(client);

    if (presence) {
      users.push(presence);
    }
  }

  const message: PresenceMessage = {
    type: "presence-update",
    users,
  };

  const serializedMessage = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(serializedMessage);
    }
  }
};

export const handleWebSocketConnection = (
  socket: WebSocket,
  documentId: string,
): void => {
  const document = getYDoc(documentId);

  let clients = documentClients.get(documentId);

  if (!clients) {
    clients = new Set<WebSocket>();
    documentClients.set(documentId, clients);
  }

  clients.add(socket);

  const clientId = randomUUID();

  clientPresence.set(socket, {
    id: clientId,
    name: `User ${clientId.slice(0, 4)}`,
  });

  socket.send(
    JSON.stringify({
      type: "sync-ready",
      documentId,
      stateSize: Y.encodeStateAsUpdate(document).byteLength,
    }),
  );

  broadcastPresence(documentId);

  const handleDocumentUpdate = (
    update: Uint8Array,
    origin: unknown,
  ): void => {
    if (origin !== socket) {
      return;
    }

    const connectedClients = documentClients.get(documentId);

    if (!connectedClients) {
      return;
    }

    for (const client of connectedClients) {
      if (
        client !== socket &&
        client.readyState === client.OPEN
      ) {
        sendYjsMessage(client, UPDATE_MESSAGE, update);
      }
    }
  };

  document.on("update", handleDocumentUpdate);

  socket.on("message", (data: RawData) => {
    const message = toUint8Array(data);

    if (message.byteLength === 0) {
      return;
    }

    const messageType = message[0];
    const payload = message.slice(1);

    if (messageType === STATE_VECTOR_MESSAGE) {
      const update = Y.encodeStateAsUpdate(document, payload);

      sendYjsMessage(socket, UPDATE_MESSAGE, update);
      return;
    }

    if (messageType === UPDATE_MESSAGE) {
      Y.applyUpdate(document, payload, socket);
    }
  });

  socket.on("close", () => {
    document.off("update", handleDocumentUpdate);

    const connectedClients = documentClients.get(documentId);

    clientPresence.delete(socket);

    if (!connectedClients) {
      return;
    }

    connectedClients.delete(socket);

    if (connectedClients.size === 0) {
      documentClients.delete(documentId);
      return;
    }

    broadcastPresence(documentId);
  });
};