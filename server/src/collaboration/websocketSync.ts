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

interface BlockLock {
  blockId: string;
  userId: string;
  userName: string;
}

interface BlockLockMessage {
  type: "block-lock-update";
  lock: BlockLock;
}

interface BlockUnlockMessage {
  type: "block-lock-update";
  lock: BlockLock;
  released: true;
}

interface BlockLockDeniedMessage {
  type: "block-lock-denied";
  blockId: string;
  owner: BlockLock;
}

interface LockRequestMessage {
  type: "lock-request";
  blockId: string;
}

interface UnlockRequestMessage {
  type: "unlock-request";
  blockId: string;
}

const documentClients = new Map<
  string,
  Set<WebSocket>
>();

const clientPresence = new Map<
  WebSocket,
  PresenceUser
>();

const documentLocks = new Map<
  string,
  Map<string, BlockLock>
>();

const toUint8Array = (
  data: RawData,
): Uint8Array => {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (Array.isArray(data)) {
    return new Uint8Array(
      Buffer.concat(data),
    );
  }

  return new Uint8Array(data);
};

const sendYjsMessage = (
  socket: WebSocket,
  messageType: number,
  update: Uint8Array,
): void => {
  const message = new Uint8Array(
    update.byteLength + 1,
  );

  message[0] = messageType;
  message.set(update, 1);

  if (socket.readyState === socket.OPEN) {
    socket.send(message);
  }
};

const sendJsonMessage = (
  socket: WebSocket,
  message: unknown,
): void => {
  if (socket.readyState === socket.OPEN) {
    socket.send(
      JSON.stringify(message),
    );
  }
};

const broadcastPresence = (
  documentId: string,
): void => {
  const clients =
    documentClients.get(documentId);

  if (!clients) {
    return;
  }

  const users: PresenceUser[] = [];

  for (const client of clients) {
    const presence =
      clientPresence.get(client);

    if (presence) {
      users.push(presence);
    }
  }

  const message: PresenceMessage = {
    type: "presence-update",
    users,
  };

  for (const client of clients) {
    sendJsonMessage(client, message);
  }
};

const sendCurrentLocks = (
  socket: WebSocket,
  documentId: string,
): void => {
  const locks =
    documentLocks.get(documentId);

  if (!locks) {
    return;
  }

  for (const lock of locks.values()) {
    sendJsonMessage(socket, {
      type: "block-lock-update",
      lock,
    } satisfies BlockLockMessage);
  }
};

const broadcastLock = (
  documentId: string,
  lock: BlockLock,
): void => {
  const clients =
    documentClients.get(documentId);

  if (!clients) {
    return;
  }

  const message: BlockLockMessage = {
    type: "block-lock-update",
    lock,
  };

  for (const client of clients) {
    sendJsonMessage(client, message);
  }
};

const broadcastUnlock = (
  documentId: string,
  lock: BlockLock,
): void => {
  const clients =
    documentClients.get(documentId);

  if (!clients) {
    return;
  }

  const message: BlockUnlockMessage = {
    type: "block-lock-update",
    lock,
    released: true,
  };

  for (const client of clients) {
    sendJsonMessage(client, message);
  }
};

const releaseClientLocks = (
  documentId: string,
  userId: string,
): void => {
  const locks =
    documentLocks.get(documentId);

  if (!locks) {
    return;
  }

  const releasedLocks: BlockLock[] = [];

  for (const [
    blockId,
    lock,
  ] of locks.entries()) {
    if (lock.userId === userId) {
      locks.delete(blockId);
      releasedLocks.push(lock);
    }
  }

  for (const lock of releasedLocks) {
    broadcastUnlock(
      documentId,
      lock,
    );
  }

  if (locks.size === 0) {
    documentLocks.delete(
      documentId,
    );
  }
};

const handleLockRequest = (
  socket: WebSocket,
  documentId: string,
  blockId: string,
): void => {
  const presence =
    clientPresence.get(socket);

  if (!presence || !blockId) {
    return;
  }

  let locks =
    documentLocks.get(documentId);

  if (!locks) {
    locks = new Map<
      string,
      BlockLock
    >();

    documentLocks.set(
      documentId,
      locks,
    );
  }

  const existingLock =
    locks.get(blockId);

  if (existingLock) {
    if (
      existingLock.userId ===
      presence.id
    ) {
      sendJsonMessage(socket, {
        type: "block-lock-update",
        lock: existingLock,
      } satisfies BlockLockMessage);

      return;
    }

    sendJsonMessage(socket, {
      type: "block-lock-denied",
      blockId,
      owner: existingLock,
    } satisfies BlockLockDeniedMessage);

    return;
  }

  const lock: BlockLock = {
    blockId,
    userId: presence.id,
    userName: presence.name,
  };

  locks.set(
    blockId,
    lock,
  );

  broadcastLock(
    documentId,
    lock,
  );
};

const handleUnlockRequest = (
  socket: WebSocket,
  documentId: string,
  blockId: string,
): void => {
  const presence =
    clientPresence.get(socket);

  const locks =
    documentLocks.get(documentId);

  if (
    !presence ||
    !locks ||
    !blockId
  ) {
    return;
  }

  const existingLock =
    locks.get(blockId);

  if (
    !existingLock ||
    existingLock.userId !==
      presence.id
  ) {
    return;
  }

  locks.delete(blockId);

  broadcastUnlock(
    documentId,
    existingLock,
  );

  if (locks.size === 0) {
    documentLocks.delete(
      documentId,
    );
  }
};

const isLockRequest = (
  message: unknown,
): message is LockRequestMessage => {
  if (
    typeof message !== "object" ||
    message === null
  ) {
    return false;
  }

  if (
    !("type" in message) ||
    !("blockId" in message)
  ) {
    return false;
  }

  return (
    message.type ===
      "lock-request" &&
    typeof message.blockId ===
      "string" &&
    message.blockId.length > 0
  );
};

const isUnlockRequest = (
  message: unknown,
): message is UnlockRequestMessage => {
  if (
    typeof message !== "object" ||
    message === null
  ) {
    return false;
  }

  if (
    !("type" in message) ||
    !("blockId" in message)
  ) {
    return false;
  }

  return (
    message.type ===
      "unlock-request" &&
    typeof message.blockId ===
      "string" &&
    message.blockId.length > 0
  );
};

export const handleWebSocketConnection = (
  socket: WebSocket,
  documentId: string,
): void => {
  const document =
    getYDoc(documentId);

  let clients =
    documentClients.get(documentId);

  if (!clients) {
    clients = new Set<WebSocket>();

    documentClients.set(
      documentId,
      clients,
    );
  }

  clients.add(socket);

  const clientId = randomUUID();

  const presence: PresenceUser = {
    id: clientId,
    name: `User ${clientId.slice(
      0,
      4,
    )}`,
  };

  clientPresence.set(
    socket,
    presence,
  );

  sendJsonMessage(socket, {
    type: "sync-ready",
    documentId,
    stateSize:
      Y.encodeStateAsUpdate(
        document,
      ).byteLength,
    user: presence,
  });

  broadcastPresence(
    documentId,
  );

  sendCurrentLocks(
    socket,
    documentId,
  );

  const handleDocumentUpdate = (
    update: Uint8Array,
    origin: unknown,
  ): void => {
    if (origin !== socket) {
      return;
    }

    const connectedClients =
      documentClients.get(
        documentId,
      );

    if (!connectedClients) {
      return;
    }

    for (const client of connectedClients) {
      if (
        client !== socket &&
        client.readyState ===
          client.OPEN
      ) {
        sendYjsMessage(
          client,
          UPDATE_MESSAGE,
          update,
        );
      }
    }
  };

  document.on(
    "update",
    handleDocumentUpdate,
  );

  socket.on(
    "message",
    (
      data: RawData,
      isBinary: boolean,
    ) => {
      /*
       * Text messages are used for:
       * - lock-request
       * - unlock-request
       *
       * The isBinary flag is important because
       * ws can provide text frames as Buffer data.
       */
      if (!isBinary) {
        try {
          const message: unknown =
            JSON.parse(
              data.toString(),
            );

          if (
            isLockRequest(message)
          ) {
            handleLockRequest(
              socket,
              documentId,
              message.blockId,
            );

            return;
          }

          if (
            isUnlockRequest(message)
          ) {
            handleUnlockRequest(
              socket,
              documentId,
              message.blockId,
            );
          }
        } catch {
          // Ignore malformed JSON messages.
        }

        return;
      }

      /*
       * Binary messages are used for Yjs:
       * - state vector requests
       * - document updates
       */
      const message =
        toUint8Array(data);

      if (
        message.byteLength === 0
      ) {
        return;
      }

      const messageType =
        message[0];

      const payload =
        message.slice(1);

      if (
        messageType ===
        STATE_VECTOR_MESSAGE
      ) {
        const update =
          Y.encodeStateAsUpdate(
            document,
            payload,
          );

        sendYjsMessage(
          socket,
          UPDATE_MESSAGE,
          update,
        );

        return;
      }

      if (
        messageType ===
        UPDATE_MESSAGE
      ) {
        Y.applyUpdate(
          document,
          payload,
          socket,
        );
      }
    },
  );

  socket.on(
    "close",
    () => {
      document.off(
        "update",
        handleDocumentUpdate,
      );

      const connectedClients =
        documentClients.get(
          documentId,
        );

      clientPresence.delete(
        socket,
      );

      /*
       * If the user disconnects while
       * holding any block locks, release
       * those locks for the remaining users.
       */
      releaseClientLocks(
        documentId,
        presence.id,
      );

      if (!connectedClients) {
        return;
      }

      connectedClients.delete(
        socket,
      );

      if (
        connectedClients.size ===
        0
      ) {
        documentClients.delete(
          documentId,
        );

        documentLocks.delete(
          documentId,
        );

        return;
      }

      broadcastPresence(
        documentId,
      );
    },
  );
};