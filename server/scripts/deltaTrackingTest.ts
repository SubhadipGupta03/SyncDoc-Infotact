import { WebSocket } from "ws";
import * as Y from "yjs";

const DOCUMENT_ID = "mid-review-delta-test";
const SERVER_URL = `ws://localhost:5000/ws?documentId=${DOCUMENT_ID}`;

const STATE_VECTOR_MESSAGE = 0;
const UPDATE_MESSAGE = 1;

const createMessage = (
  messageType: number,
  payload: Uint8Array,
): Buffer => {
  const message = Buffer.alloc(payload.byteLength + 1);

  message[0] = messageType;
  Buffer.from(payload).copy(message, 1);

  return message;
};

interface DeltaClient {
  name: string;
  document: Y.Doc;
  sharedBlocks: Y.Map<string>;
  socket: WebSocket;
  connected: boolean;
  localUpdatesSent: number;
  remoteUpdatesReceived: number;
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const closeClient = (client: DeltaClient): void => {
  if (
    client.socket.readyState === WebSocket.OPEN ||
    client.socket.readyState === WebSocket.CONNECTING
  ) {
    client.socket.close();
  }

  client.document.destroy();
};

const runDeltaTrackingTest = async (): Promise<void> => {
  console.log("==========================================");
  console.log(" SyncDoc Delta-Tracking Verification");
  console.log("==========================================");
  console.log(`Document: ${DOCUMENT_ID}`);
  console.log("Clients:  2");
  console.log("");

  const clientA: DeltaClient = {
    name: "Client A",
    document: new Y.Doc(),
    sharedBlocks: new Y.Doc().getMap<string>("unused"),
    socket: new WebSocket(SERVER_URL),
    connected: false,
    localUpdatesSent: 0,
    remoteUpdatesReceived: 0,
  };

  clientA.sharedBlocks = clientA.document.getMap<string>("blocks");

  const clientB: DeltaClient = {
    name: "Client B",
    document: new Y.Doc(),
    sharedBlocks: new Y.Doc().getMap<string>("unused"),
    socket: new WebSocket(SERVER_URL),
    connected: false,
    localUpdatesSent: 0,
    remoteUpdatesReceived: 0,
  };

  clientB.sharedBlocks = clientB.document.getMap<string>("blocks");

  const clients = [clientA, clientB];

  for (const client of clients) {
    client.socket.binaryType = "arraybuffer";

    client.socket.addEventListener("open", () => {
      client.connected = true;

      const stateVector = Y.encodeStateVector(client.document);

      client.socket.send(
        createMessage(STATE_VECTOR_MESSAGE, stateVector),
      );
    });

    client.socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        return;
      }

      const message =
        event.data instanceof ArrayBuffer
          ? new Uint8Array(event.data)
          : new Uint8Array(event.data as Buffer);

      if (message.byteLength === 0) {
        return;
      }

      const messageType = message[0];
      const payload = message.slice(1);

      if (messageType === UPDATE_MESSAGE) {
        client.remoteUpdatesReceived += 1;

        Y.applyUpdate(
          client.document,
          payload,
          client.socket,
        );
      }
    });

    client.socket.addEventListener("error", (error) => {
      console.error(`${client.name} WebSocket error:`, error);
    });

    client.document.on(
      "update",
      (update: Uint8Array, origin: unknown) => {
        if (
          origin === client.socket ||
          client.socket.readyState !== WebSocket.OPEN
        ) {
          return;
        }

        client.localUpdatesSent += 1;

        client.socket.send(
          createMessage(UPDATE_MESSAGE, update),
        );
      },
    );
  }

  const connectionTimeout = Date.now() + 10000;

  while (!clients.every((client) => client.connected)) {
    if (Date.now() > connectionTimeout) {
      throw new Error(
        "Timeout: both delta-tracking clients did not connect.",
      );
    }

    await wait(100);
  }

  console.log("PASS: 2/2 clients connected.");

  await wait(500);

  console.log("");
  console.log("Step 1: Creating local state on Client A...");

  clientA.document.transact(
    () => {
      clientA.sharedBlocks.set(
        "local-block",
        "Client A local content",
      );
    },
    "client-a-local",
  );

  await wait(500);

  console.log(
    "PASS: Client A created local content:",
  );
  console.log(
    `      ${clientA.sharedBlocks.get("local-block")}`,
  );

  console.log("");
  console.log("Step 2: Creating local state on Client B...");

  clientB.document.transact(
    () => {
      clientB.sharedBlocks.set(
        "remote-block",
        "Client B remote content",
      );
    },
    "client-b-local",
  );

  await wait(1000);

  console.log(
    "PASS: Client B created remote content:",
  );
  console.log(
    `      ${clientB.sharedBlocks.get("remote-block")}`,
  );

  console.log("");
  console.log(
    "Step 3: Verifying Client A received the incoming delta...",
  );

  const clientAReceivedRemoteContent =
    clientA.sharedBlocks.get("remote-block") ===
    "Client B remote content";

  if (!clientAReceivedRemoteContent) {
    throw new Error(
      "Client A did not receive the remote Yjs delta from Client B.",
    );
  }

  console.log(
    "PASS: Client A received Client B's incoming delta.",
  );

  console.log("");
  console.log(
    "Step 4: Verifying Client A's local content was preserved...",
  );

  const clientALocalContent =
    clientA.sharedBlocks.get("local-block");

  if (clientALocalContent !== "Client A local content") {
    throw new Error(
      "Client A local content was changed or lost after receiving the remote delta.",
    );
  }

  console.log(
    "PASS: Client A local content remained intact.",
  );

  console.log("");
  console.log(
    "Step 5: Verifying both clients contain the combined state...",
  );

  const clientAState = JSON.stringify(
    Array.from(clientA.sharedBlocks.entries()).sort(),
  );

  const clientBState = JSON.stringify(
    Array.from(clientB.sharedBlocks.entries()).sort(),
  );

  if (clientAState !== clientBState) {
    throw new Error(
      `Clients did not converge.\nClient A: ${clientAState}\nClient B: ${clientBState}`,
    );
  }

  console.log(
    "PASS: Both clients converged to the same final state.",
  );

  console.log("");
  console.log("Local updates sent:");

  for (const client of clients) {
    console.log(
      `  ${client.name}: ${client.localUpdatesSent}`,
    );
  }

  console.log("");
  console.log("Incoming updates applied:");

  for (const client of clients) {
    console.log(
      `  ${client.name}: ${client.remoteUpdatesReceived}`,
    );
  }

  console.log("");
  console.log("==========================================");
  console.log(" DELTA-TRACKING TEST PASSED");
  console.log("==========================================");

  for (const client of clients) {
    closeClient(client);
  }
};

runDeltaTrackingTest().catch((error: unknown) => {
  console.error("");
  console.error("==========================================");
  console.error(" DELTA-TRACKING TEST FAILED");
  console.error("==========================================");

  console.error(
    error instanceof Error ? error.message : error,
  );

  process.exitCode = 1;
});