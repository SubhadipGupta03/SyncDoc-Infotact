import * as Y from "yjs";

const STATE_VECTOR_MESSAGE = 0;
const UPDATE_MESSAGE = 1;

export interface PresenceUser {
  id: string;
  name: string;
}

export interface BlockLock {
  blockId: string;
  userId: string;
  userName: string;
}

export type PresenceListener = (
  users: PresenceUser[],
) => void;

export type BlockLockListener = (
  locks: BlockLock[],
) => void;

export type BlockLockDeniedListener = (
  blockId: string,
  owner: BlockLock,
) => void;

export interface YjsConnection {
  document: Y.Doc;
  sharedContent: Y.Map<string>;
  sharedBlocks: Y.Map<string>;
  socket: WebSocket;
  currentUser: PresenceUser | null;

  onSyncComplete: (
    listener: () => void,
  ) => () => void;

  onPresenceChange: (
    listener: PresenceListener,
  ) => () => void;

  onBlockLockChange: (
    listener: BlockLockListener,
  ) => () => void;

  onBlockLockDenied: (
    listener: BlockLockDeniedListener,
  ) => () => void;

  requestBlockLock: (
    blockId: string,
  ) => void;

  releaseBlockLock: (
    blockId: string,
  ) => void;

  disconnect: () => void;
}

const createYjsMessage = (
  messageType: number,
  update: Uint8Array,
): ArrayBuffer => {
  const message = new ArrayBuffer(
    update.byteLength + 1,
  );

  const view = new Uint8Array(message);

  view[0] = messageType;
  view.set(update, 1);

  return message;
};

const isPresenceUser = (
  value: unknown,
): value is PresenceUser => {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  if (
    !("id" in value) ||
    !("name" in value)
  ) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
};

const isBlockLock = (
  value: unknown,
): value is BlockLock => {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  if (
    !("blockId" in value) ||
    !("userId" in value) ||
    !("userName" in value)
  ) {
    return false;
  }

  return (
    typeof value.blockId === "string" &&
    typeof value.userId === "string" &&
    typeof value.userName === "string"
  );
};

export const connectToDocument = (
  documentId: string,
): YjsConnection => {
  /*
   * =====================================================
   * YJS DOCUMENT
   * =====================================================
   */

  const document = new Y.Doc();

  /*
   * Shared document metadata.
   */
  const sharedContent =
    document.getMap<string>("syncdoc");

  /*
   * Each block is stored independently.
   *
   * Example:
   *
   * blocks:
   *   untitled-code-1
   *   untitled-heading-1
   *   untitled-paragraph-1
   */

  const sharedBlocks =
    document.getMap<string>("blocks");

  /*
   * =====================================================
   * CLIENT STATE
   * =====================================================
   */

  const presenceListeners =
    new Set<PresenceListener>();

  const blockLockListeners =
    new Set<BlockLockListener>();

  const syncCompleteListeners =
    new Set<() => void>();

  const blockLockDeniedListeners =
    new Set<BlockLockDeniedListener>();

  const activeLocks =
    new Map<string, BlockLock>();

  let currentUser:
    | PresenceUser
    | null = null;

  /*
   * Prevent sync-ready from firing more than once.
   */
  let syncCompleted = false;

  /*
   * =====================================================
   * WEBSOCKET
   * =====================================================
   */

  const socket = new WebSocket(
    `ws://localhost:5000/ws?documentId=${encodeURIComponent(
      documentId,
    )}`,
  );

  socket.binaryType = "arraybuffer";

  /*
   * =====================================================
   * LOCK HELPERS
   * =====================================================
   */

  const notifyBlockLockListeners =
    (): void => {
      const locks =
        Array.from(
          activeLocks.values(),
        );

      for (
        const listener of
        blockLockListeners
      ) {
        listener(locks);
      }
    };

  /*
   * =====================================================
   * JSON MESSAGE HANDLER
   * =====================================================
   */

  const handleJsonMessage = (
    message: unknown,
  ): void => {
    if (
      typeof message !== "object" ||
      message === null ||
      !("type" in message)
    ) {
      return;
    }

    /*
     * ---------------------------------------------------
     * SYNC READY
     * ---------------------------------------------------
     */

    if (
      message.type ===
      "sync-ready"
    ) {
      if (
        "user" in message &&
        isPresenceUser(message.user)
      ) {
        currentUser =
          message.user;

        console.log(
          `[SyncDoc] Connected as ${currentUser.name}`,
        );
      }

      console.log(
        `[SyncDoc] Yjs synchronization ready for document: ${documentId}`,
      );

      /*
       * The server sends sync-ready before the
       * state-vector response.
       *
       * Therefore we do NOT initialize local data here.
       *
       * We only record the user identity.
       */

      return;
    }

    /*
     * ---------------------------------------------------
     * PRESENCE
     * ---------------------------------------------------
     */

    if (
      message.type ===
        "presence-update" &&
      "users" in message &&
      Array.isArray(message.users)
    ) {
      const users =
        message.users.filter(
          isPresenceUser,
        );

      for (
        const listener of
        presenceListeners
      ) {
        listener(users);
      }

      return;
    }

    /*
     * ---------------------------------------------------
     * BLOCK LOCK UPDATE
     * ---------------------------------------------------
     */

    if (
      message.type ===
        "block-lock-update" &&
      "lock" in message &&
      isBlockLock(message.lock)
    ) {
      const lock =
        message.lock;

      /*
       * Lock released.
       */

      if (
        "released" in message &&
        message.released === true
      ) {
        activeLocks.delete(
          lock.blockId,
        );

        console.log(
          `[SyncDoc] Block lock released: ${lock.blockId}`,
        );
      } else {
        /*
         * Lock acquired.
         */

        activeLocks.set(
          lock.blockId,
          lock,
        );

        console.log(
          `[SyncDoc] Block locked: ${lock.blockId} by ${lock.userName}`,
        );
      }

      notifyBlockLockListeners();

      return;
    }

    /*
     * ---------------------------------------------------
     * LOCK DENIED
     * ---------------------------------------------------
     */

    if (
      message.type ===
        "block-lock-denied" &&
      "blockId" in message &&
      "owner" in message &&
      typeof message.blockId ===
        "string" &&
      isBlockLock(message.owner)
    ) {
      console.log(
        `[SyncDoc] Block lock denied: ${message.blockId} is owned by ${message.owner.userName}`,
      );

      for (
        const listener of
        blockLockDeniedListeners
      ) {
        listener(
          message.blockId,
          message.owner,
        );
      }

      return;
    }
  };

  /*
   * =====================================================
   * WEBSOCKET OPEN
   * =====================================================
   */

  socket.addEventListener(
    "open",
    () => {
      console.log(
        `[SyncDoc] WebSocket connected for document: ${documentId}`,
      );

      /*
       * Ask the server for the Yjs state
       * that this browser does not have.
       *
       * IMPORTANT:
       *
       * This must happen BEFORE App.tsx initializes
       * the local hard-coded blocks.
       */

      const stateVector =
        Y.encodeStateVector(
          document,
        );

      socket.send(
        createYjsMessage(
          STATE_VECTOR_MESSAGE,
          stateVector,
        ),
      );

      console.log(
        `[SyncDoc] State vector sent: ${stateVector.byteLength} bytes`,
      );
    },
  );

  /*
   * =====================================================
   * WEBSOCKET MESSAGE
   * =====================================================
   */

  socket.addEventListener(
    "message",
    (event) => {
      /*
       * --------------------------------------------------
       * JSON MESSAGE
       * --------------------------------------------------
       */

      if (
        typeof event.data ===
        "string"
      ) {
        try {
          const message: unknown =
            JSON.parse(event.data);

          handleJsonMessage(
            message,
          );
        } catch {
          console.error(
            "[SyncDoc] Invalid JSON WebSocket data.",
          );
        }

        return;
      }

      /*
       * --------------------------------------------------
       * BLOB
       * --------------------------------------------------
       *
       * Normally Yjs data should arrive as ArrayBuffer
       * because binaryType is arraybuffer.
       *
       * Blob support is kept for browser compatibility.
       */

      if (
        event.data instanceof Blob
      ) {
        event.data
          .arrayBuffer()
          .then((buffer) => {
            handleBinaryMessage(
              new Uint8Array(buffer),
            );
          })
          .catch(() => {
            console.error(
              "[SyncDoc] Could not read WebSocket Blob data.",
            );
          });

        return;
      }

      /*
       * --------------------------------------------------
       * ARRAYBUFFER
       * --------------------------------------------------
       */

      if (
        event.data instanceof
        ArrayBuffer
      ) {
        handleBinaryMessage(
          new Uint8Array(
            event.data,
          ),
        );

        return;
      }

      /*
       * --------------------------------------------------
       * UINT8ARRAY
       * --------------------------------------------------
       */

      if (
        event.data instanceof
        Uint8Array
      ) {
        handleBinaryMessage(
          event.data,
        );

        return;
      }

      console.warn(
        "[SyncDoc] Unknown WebSocket message type.",
      );
    },
  );

  /*
   * =====================================================
   * BINARY YJS MESSAGE HANDLER
   * =====================================================
   */

  const handleBinaryMessage = (
    message: Uint8Array,
  ): void => {
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
     * YJS UPDATE
     * --------------------------------------------------
     */

    if (
      messageType ===
      UPDATE_MESSAGE
    ) {
      console.log(
        "[SyncDoc] ===== INCOMING YJS UPDATE =====",
      );

      console.log(
        "[SyncDoc] Incoming bytes:",
        payload.byteLength,
      );

      /*
       * Apply the update to the local Y.Doc.
       *
       * IMPORTANT:
       *
       * The origin is "remote-server".
       *
       * The document update listener below
       * uses this origin to avoid sending
       * the same update back to the server.
       */

      Y.applyUpdate(
        document,
        payload,
        "remote-server",
      );

      console.log(
        "[SyncDoc] Yjs update applied.",
      );

      console.log(
        "[SyncDoc] Shared block count:",
        sharedBlocks.size,
      );

      console.log(
        "[SyncDoc] ALL BLOCKS:",
        Array.from(
          sharedBlocks.entries(),
        ),
      );

      console.log(
        "[SyncDoc] =============================",
      );

      /*
       * The FIRST UPDATE received after the
       * state-vector request represents the
       * server's current state.
       *
       * Only after this state has been applied
       * should App.tsx decide whether it needs
       * to initialize the document.
       */

      if (!syncCompleted) {
        syncCompleted = true;

        console.log(
          "[SyncDoc] Initial Yjs state received.",
        );

        for (
          const listener of
          syncCompleteListeners
        ) {
          listener();
        }
      }

      return;
    }

    console.warn(
      `[SyncDoc] Unknown binary message type: ${messageType}`,
    );
  };

  /*
   * =====================================================
   * LOCAL YJS UPDATE → SERVER
   * =====================================================
   */

  document.on(
    "update",
    (
      update: Uint8Array,
      origin: unknown,
    ) => {
      /*
       * Ignore updates that came from the server.
       *
       * Server updates are applied using:
       *
       * Y.applyUpdate(
       *   document,
       *   payload,
       *   "remote-server"
       * )
       */

      if (
        origin ===
        "remote-server"
      ) {
        return;
      }

      /*
       * Ignore updates while WebSocket
       * is not connected.
       */

      if (
        socket.readyState !==
        WebSocket.OPEN
      ) {
        return;
      }

      console.log(
        `[SyncDoc] Sending local Yjs update, bytes: ${update.byteLength}`,
      );

      socket.send(
        createYjsMessage(
          UPDATE_MESSAGE,
          update,
        ),
      );
    },
  );

  /*
   * =====================================================
   * WEBSOCKET ERROR
   * =====================================================
   */

  socket.addEventListener(
    "error",
    () => {
      console.error(
        `[SyncDoc] WebSocket error for document: ${documentId}`,
      );
    },
  );

  /*
   * =====================================================
   * WEBSOCKET CLOSE
   * =====================================================
   */

  socket.addEventListener(
    "close",
    () => {
      console.log(
        `[SyncDoc] WebSocket closed for document: ${documentId}`,
      );

      currentUser = null;

      activeLocks.clear();

      syncCompleted = false;

      /*
       * Notify React that everyone is offline.
       */

      for (
        const listener of
        presenceListeners
      ) {
        listener([]);
      }

      /*
       * Notify React that all locks
       * are gone.
       */

      for (
        const listener of
        blockLockListeners
      ) {
        listener([]);
      }
    },
  );

  /*
   * =====================================================
   * PRESENCE API
   * =====================================================
   */

  const onPresenceChange = (
    listener: PresenceListener,
  ): (() => void) => {
    presenceListeners.add(
      listener,
    );

    return () => {
      presenceListeners.delete(
        listener,
      );
    };
  };

  /*
   * =====================================================
   * BLOCK LOCK API
   * =====================================================
   */

  const onBlockLockChange = (
    listener: BlockLockListener,
  ): (() => void) => {
    blockLockListeners.add(
      listener,
    );

    /*
     * Immediately provide current locks.
     */

    listener(
      Array.from(
        activeLocks.values(),
      ),
    );

    return () => {
      blockLockListeners.delete(
        listener,
      );
    };
  };

  const onBlockLockDenied = (
    listener: BlockLockDeniedListener,
  ): (() => void) => {
    blockLockDeniedListeners.add(
      listener,
    );

    return () => {
      blockLockDeniedListeners.delete(
        listener,
      );
    };
  };

  /*
   * =====================================================
   * INITIAL SYNC API
   * =====================================================
   */

  const onSyncComplete = (
    listener: () => void,
  ): (() => void) => {
    syncCompleteListeners.add(
      listener,
    );

    /*
     * If synchronization already completed
     * before App.tsx registered the listener,
     * immediately notify the listener.
     */

    if (syncCompleted) {
      listener();
    }

    return () => {
      syncCompleteListeners.delete(
        listener,
      );
    };
  };

  /*
   * =====================================================
   * REQUEST BLOCK LOCK
   * =====================================================
   */

  const requestBlockLock = (
    blockId: string,
  ): void => {
    if (
      !blockId ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      return;
    }

    console.log(
      `[SyncDoc] Requesting block lock: ${blockId}`,
    );

    socket.send(
      JSON.stringify({
        type: "lock-request",
        blockId,
      }),
    );
  };

  /*
   * =====================================================
   * RELEASE BLOCK LOCK
   * =====================================================
   */

  const releaseBlockLock = (
    blockId: string,
  ): void => {
    if (
      !blockId ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      return;
    }

    console.log(
      `[SyncDoc] Releasing block lock: ${blockId}`,
    );

    socket.send(
      JSON.stringify({
        type: "unlock-request",
        blockId,
      }),
    );
  };

  /*
   * =====================================================
   * DISCONNECT
   * =====================================================
   */

  const disconnect = (): void => {
    /*
     * Destroy the local Yjs document.
     */

    document.destroy();

    /*
     * Close WebSocket.
     */

    if (
      socket.readyState ===
        WebSocket.OPEN ||
      socket.readyState ===
        WebSocket.CONNECTING
    ) {
      socket.close();
    }

    /*
     * Clear local listeners/state.
     */

    presenceListeners.clear();

    blockLockListeners.clear();

    blockLockDeniedListeners.clear();

    syncCompleteListeners.clear();

    activeLocks.clear();

    currentUser = null;

    syncCompleted = false;
  };

  /*
   * =====================================================
   * RETURN CONNECTION
   * =====================================================
   */

  return {
    document,

    sharedContent,

    sharedBlocks,

    socket,

    onSyncComplete,

    /*
     * Getter keeps currentUser live.
     */

    get currentUser():
      PresenceUser | null {
      return currentUser;
    },

    onPresenceChange,

    onBlockLockChange,

    onBlockLockDenied,

    requestBlockLock,

    releaseBlockLock,

    disconnect,
  };
};