import * as Y from "yjs";
import type { RawData, WebSocket } from "ws";
import {getYDoc,loadYDocFromDatabase,} from "./yjsDocumentManager.js";
import YjsDocumentModel from "../models/yjsDocument.js";

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

interface BlockSelection {
  blockId: string;
  selectionStart: number;
  selectionEnd: number;
  cursorPosition: number;
  userId: string;
  userName: string;
}

interface BlockSelectionMessage {
  type: "block-selection-update";
  selection: BlockSelection;
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

const documentSelections = new Map<
  string,
  Map<string, BlockSelection>
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
const broadcastSelections = (
  documentId: string,
): void => {
  const selections =
    documentSelections.get(documentId);

    const currentSelections = selections
    ? Array.from(selections.values())
    : [];

  const clients =
    documentClients.get(documentId);

  if (!clients) {
    return;
  }
  const message = {
    type: "block-selection-update",
    selections: currentSelections,
  };

  for (const client of clients) {
    sendJsonMessage(
      client,
      message,
    );
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
const sendCurrentSelections = (
  socket: WebSocket,
  documentId: string,
): void => {
  const selections =
    documentSelections.get(
      documentId,
    );

  if (!selections) {
    return;
  }

  sendJsonMessage(socket, {
    type: "block-selection-update",
    selections: Array.from(
      selections.values(),
    ),
  });
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

  const selections = documentSelections.get(documentId);

if (selections) {
  selections.delete(presence.id);

  if (selections.size === 0) {
    documentSelections.delete(documentId);
  }
}

broadcastSelections(documentId);

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
const isBlockSelectionMessage = (
  message: unknown,
): message is BlockSelectionMessage => {
  if (
    typeof message !== "object" ||
    message === null
  ) {
    return false;
  }

  if (
    !("type" in message) ||
    !("selection" in message)
  ) {
    return false;
  }

  if (
    message.type !==
    "block-selection-update"
  ) {
    return false;
  }

  const selection = message.selection;

  if (
    typeof selection !== "object" ||
    selection === null
  ) {
    return false;
  }

  if (
    !("blockId" in selection) ||
    !("selectionStart" in selection) ||
    !("selectionEnd" in selection) ||
    !("cursorPosition" in selection)
  ) {
    return false;
  }

  return (
    typeof selection.blockId ===
      "string" &&
    selection.blockId.length > 0 &&
    typeof selection.selectionStart ===
      "number" &&
    typeof selection.selectionEnd ===
      "number" &&
    typeof selection.cursorPosition ===
      "number"
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

export const handleWebSocketConnection =  async (

  socket: WebSocket,
  documentId: string,
   authenticatedUser: PresenceUser,
):Promise<void> => {
  
  /*
   * Get the single authoritative Yjs document
   * for this documentId.
   */
  
  const document = getYDoc(documentId);
  

await loadYDocFromDatabase(
  documentId,
  document,
);


  /*
   * Register this WebSocket client.
   */
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

  /*
   * Create presence identity.
   */
  const presence: PresenceUser =
  authenticatedUser;

clientPresence.set(
  socket,
  presence,
);

  /*
   * Tell the browser that the connection
   * and current Yjs document are ready.
   */
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

  /*
   * IMPORTANT:
   *
   * There is intentionally NO document.on("update")
   * broadcaster here.
   *
   * Updates are handled in exactly one place below:
   *
   * WebSocket message
   *       ↓
   * Y.applyUpdate()
   *       ↓
   * encode complete server state
   *       ↓
   * send complete state to other clients
   *
   * This prevents duplicate/conflicting broadcast
   * paths.
   */
  

  socket.on(
    "message",
   async (
      data: RawData,
      isBinary: boolean,
    ) => {
      
      /*
       * --------------------------------------------------
       * TEXT MESSAGES
       * --------------------------------------------------
       *
       * Used for block lock/unlock messages.
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
  isBlockSelectionMessage(message)
) {
  const selection: BlockSelection = {
    blockId:
      message.selection.blockId,
    selectionStart:
      message.selection.selectionStart,
    selectionEnd:
      message.selection.selectionEnd,
    cursorPosition:
      message.selection.cursorPosition,
    userId: presence.id,
    userName: presence.name,
  };

  let selections =
    documentSelections.get(
      documentId,
    );

  if (!selections) {
    selections = new Map<
      string,
      BlockSelection
    >();

    documentSelections.set(
      documentId,
      selections,
    );
  }

  selections.set(
    presence.id,
    selection,
  );

  broadcastSelections(
    documentId,
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

            return;
          }
        } catch {
          // Ignore malformed JSON.
        }

        return;
      }

      /*
       * --------------------------------------------------
       * BINARY YJS MESSAGES
       * --------------------------------------------------
       */
      const message = toUint8Array(data);
      
      

      if (
        message.byteLength === 0
      ) {
        return;
      }

      const messageType =
        message[0];

      const payload =
        message.slice(1);

      /*
       * --------------------------------------------------
       * STATE VECTOR REQUEST
       * --------------------------------------------------
       *
       * Browser asks:
       *
       * "Give me the Yjs updates I am missing."
       */
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

      /*
       * --------------------------------------------------
       * YJS UPDATE FROM A CLIENT
       * --------------------------------------------------
       *
       * This is the important section.
       *
       * Tab 1
       *   ↓
       * WebSocket
       *   ↓
       * Server
       *   ↓
       * Y.applyUpdate()
       *   ↓
       * Complete server state
       *   ↓
       * Tab 2
       */
      if (
        messageType ===
        UPDATE_MESSAGE
      ) {
        console.log(
          "[SyncDoc] =======================================",
        );

        

        /*
         * Apply Tab 1's update to the authoritative
         * server Yjs document.
         */
        Y.applyUpdate(
          document,
          payload,
          socket,
        );
  const serverBlocks =
  document.getMap<string>("blocks");



/*
 * Generate the COMPLETE current Yjs state.
 */
const fullState =
  Y.encodeStateAsUpdate(
    document,
  );

/*
 * Persist the complete Yjs state
 * to MongoDB.
 */

await YjsDocumentModel.findOneAndUpdate(
  { documentId },
  {
    $set: {
      state: Buffer.from(fullState),
      updatedAt: new Date(),
    },
  },
  {
    upsert: true,
    new: true,
  },
);
        
        

        /*
         * Get every browser connected to this document.
         */
        const connectedClients =
          documentClients.get(
            documentId,
          );

        if (
          connectedClients
        ) {
          for (
            const client of
              connectedClients
          ) {
            /*
             * Do NOT send the update back to the
             * browser that originally sent it.
             */
            if (
              client === socket
            ) {
              continue;
            }

            if (
              client.readyState !==
              client.OPEN
            ) {
              continue;
            }

            /*
             * Send the COMPLETE Yjs document state
             * to the other browser.
             */
            sendYjsMessage(
              client,
              UPDATE_MESSAGE,
              fullState,
            );

            
          }
        }


        return;
      }
    },
  );

  /*
   * --------------------------------------------------
   * SOCKET CLOSE
   * --------------------------------------------------
   */
  socket.on(
    "close",
    () => {
      const connectedClients =
        documentClients.get(
          documentId,
        );

      clientPresence.delete(
        socket,
      );

const selections =
  documentSelections.get(
    documentId,
  );

if (selections) {
  selections.delete(
    presence.id,
  );

  if (selections.size === 0) {
    documentSelections.delete(
      documentId,
    );
  } else {
    broadcastSelections(
      documentId,
    );
  }
}
      /*
       * Release all locks owned by this user.
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

      /*
       * No clients remain.
       */
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

      /*
       * Notify remaining browsers that this
       * user disconnected.
       */
      broadcastPresence(
        documentId,
      );
      sendCurrentLocks(
        socket,
        documentId,
);
      sendCurrentSelections(
  socket,
  documentId,
);
    },
  );
};