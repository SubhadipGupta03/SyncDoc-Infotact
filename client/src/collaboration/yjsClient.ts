import * as Y from "yjs";

const STATE_VECTOR_MESSAGE = 0;
const UPDATE_MESSAGE = 1;

export interface YjsConnection {
  document: Y.Doc;
  sharedContent: Y.Map<string>;
  socket: WebSocket;
  disconnect: () => void;
}

const createYjsMessage = (
  messageType: number,
  update: Uint8Array,
): ArrayBuffer => {
  const message = new ArrayBuffer(update.byteLength + 1);
  const view = new Uint8Array(message);

  view[0] = messageType;
  view.set(update, 1);

  return message;
};

export const connectToDocument = (
  documentId: string,
): YjsConnection => {
  const document = new Y.Doc();

  const sharedContent = document.getMap<string>("syncdoc");

  const socket = new WebSocket(
    `ws://localhost:5000/ws?documentId=${encodeURIComponent(documentId)}`,
  );

  socket.binaryType = "arraybuffer";

  socket.addEventListener("open", () => {
    console.log(
      `SyncDoc WebSocket connected for document: ${documentId}`,
    );

    const stateVector = Y.encodeStateVector(document);

    socket.send(
      createYjsMessage(STATE_VECTOR_MESSAGE, stateVector),
    );
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      try {
        const message: unknown = JSON.parse(event.data);

        if (
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "sync-ready"
        ) {
          console.log(
            `SyncDoc Yjs synchronization ready for document: ${documentId}`,
          );
        }
      } catch {
        console.error(
          "SyncDoc received an invalid WebSocket message.",
        );
      }

      return;
    }

    const message =
      event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : new Uint8Array();

    if (message.byteLength === 0) {
      return;
    }

    const messageType = message[0];
    const payload = message.slice(1);

    if (messageType === UPDATE_MESSAGE) {
      Y.applyUpdate(document, payload, socket);
    }
  });

  document.on("update", (update: Uint8Array, origin: unknown) => {
    if (
      origin === socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    socket.send(
      createYjsMessage(UPDATE_MESSAGE, update),
    );
  });

  socket.addEventListener("error", () => {
    console.error(
      `SyncDoc WebSocket error for document: ${documentId}`,
    );
  });

  socket.addEventListener("close", () => {
    console.log(
      `SyncDoc WebSocket closed for document: ${documentId}`,
    );
  });

  const disconnect = (): void => {
    document.destroy();

    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close();
    }
  };

  return {
    document,
    sharedContent,
    socket,
    disconnect,
  };
};