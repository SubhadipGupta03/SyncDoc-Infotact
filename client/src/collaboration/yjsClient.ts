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
  const document = new Y.Doc();

  /*
   * Shared document metadata.
   */
  const sharedContent =
    document.getMap<string>("syncdoc");

  /*
   * Each document block has its own Yjs entry.
   *
   * This allows incoming updates to affect
   * only the block that changed.
   */
  const sharedBlocks =
    document.getMap<string>("blocks");

  const presenceListeners =
    new Set<PresenceListener>();

  const blockLockListeners =
    new Set<BlockLockListener>();

  const blockLockDeniedListeners =
    new Set<BlockLockDeniedListener>();

  const activeLocks =
    new Map<string, BlockLock>();

  let currentUser:
    | PresenceUser
    | null = null;

  const socket = new WebSocket(
    `ws://localhost:5000/ws?documentId=${encodeURIComponent(
      documentId,
    )}`,
  );

  socket.binaryType = "arraybuffer";

  /*
   * Notify all listeners of the current
   * block-lock state.
   */
  const notifyBlockLockListeners = (): void => {
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
   * Process JSON messages received from
   * the WebSocket server.
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
     * Initial synchronization response.
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
          `SyncDoc connected as ${currentUser.name}`,
        );
      }

      console.log(
        `SyncDoc Yjs synchronization ready for document: ${documentId}`,
      );

      return;
    }

    /*
     * Presence update.
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
     * Block lock update.
     *
     * This message is broadcast by the server
     * to every connected client in the document.
     */
    if (
      message.type ===
        "block-lock-update" &&
      "lock" in message &&
      isBlockLock(message.lock)
    ) {
      const lock =
        message.lock;

      if (
        "released" in message &&
        message.released === true
      ) {
        activeLocks.delete(
          lock.blockId,
        );

        console.log(
          `SyncDoc block lock released: ${lock.blockId}`,
        );
      } else {
        activeLocks.set(
          lock.blockId,
          lock,
        );

        console.log(
          `SyncDoc block locked: ${lock.blockId} by ${lock.userName}`,
        );
      }

      notifyBlockLockListeners();

      return;
    }

    /*
     * Another user already owns the
     * requested block lock.
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
        `SyncDoc block lock denied: ${message.blockId} is owned by ${message.owner.userName}`,
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

  socket.addEventListener(
    "open",
    () => {
      console.log(
        `SyncDoc WebSocket connected for document: ${documentId}`,
      );

      const stateVector =
        Y.encodeStateVector(document);

      socket.send(
        createYjsMessage(
          STATE_VECTOR_MESSAGE,
          stateVector,
        ),
      );
    },
  );

  socket.addEventListener(
    "message",
    (event) => {
      /*
       * Normal WebSocket text frames are
       * received as strings.
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
            "SyncDoc received invalid JSON WebSocket data.",
          );
        }

        return;
      }

      /*
       * Some browser environments can expose
       * non-binary WebSocket data as a Blob.
       *
       * Handle that case as JSON as well.
       */
      if (
        event.data instanceof Blob
      ) {
        event.data
          .text()
          .then((text) => {
            try {
              const message: unknown =
                JSON.parse(text);

              handleJsonMessage(
                message,
              );
            } catch {
              console.error(
                "SyncDoc received invalid Blob JSON data.",
              );
            }
          })
          .catch(() => {
            console.error(
              "SyncDoc could not read WebSocket Blob data.",
            );
          });

        return;
      }

      /*
       * Binary messages are Yjs updates.
       */
      const message =
        event.data instanceof ArrayBuffer
          ? new Uint8Array(
              event.data,
            )
          : new Uint8Array();

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

  /*
   * Every local Yjs change is sent to
   * the server.
   *
   * Updates received from the server use
   * the WebSocket as their origin, so they
   * are not sent back again.
   */
  document.on(
    "update",
    (
      update: Uint8Array,
      origin: unknown,
    ) => {
      if (
        origin === socket ||
        socket.readyState !==
          WebSocket.OPEN
      ) {
        return;
      }

      socket.send(
        createYjsMessage(
          UPDATE_MESSAGE,
          update,
        ),
      );
    },
  );

  socket.addEventListener(
    "error",
    () => {
      console.error(
        `SyncDoc WebSocket error for document: ${documentId}`,
      );
    },
  );

  socket.addEventListener(
    "close",
    () => {
      console.log(
        `SyncDoc WebSocket closed for document: ${documentId}`,
      );

      currentUser = null;

      activeLocks.clear();

      for (
        const listener of
        presenceListeners
      ) {
        listener([]);
      }

      for (
        const listener of
        blockLockListeners
      ) {
        listener([]);
      }
    },
  );

  const onPresenceChange = (
    listener: PresenceListener,
  ): (() => void) => {
    presenceListeners.add(
      listener,
    );

    /*
     * Immediately provide the current
     * presence state.
     */
    return () => {
      presenceListeners.delete(
        listener,
      );
    };
  };

  const onBlockLockChange = (
    listener: BlockLockListener,
  ): (() => void) => {
    blockLockListeners.add(
      listener,
    );

    /*
     * Immediately provide the current
     * lock state.
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
      `SyncDoc requesting block lock: ${blockId}`,
    );

    socket.send(
      JSON.stringify({
        type: "lock-request",
        blockId,
      }),
    );
  };

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
      `SyncDoc releasing block lock: ${blockId}`,
    );

    socket.send(
      JSON.stringify({
        type: "unlock-request",
        blockId,
      }),
    );
  };

  const disconnect = (): void => {
    document.destroy();

    if (
      socket.readyState ===
        WebSocket.OPEN ||
      socket.readyState ===
        WebSocket.CONNECTING
    ) {
      socket.close();
    }

    presenceListeners.clear();
    blockLockListeners.clear();
    blockLockDeniedListeners.clear();
    activeLocks.clear();

    currentUser = null;
  };

  return {
    document,
    sharedContent,
    sharedBlocks,
    socket,

    /*
     * IMPORTANT:
     *
     * Getter keeps currentUser live.
     * App.tsx therefore receives the latest
     * user assigned by the server.
     */
    get currentUser(): PresenceUser | null {
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