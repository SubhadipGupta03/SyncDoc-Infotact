import { WebSocket } from "ws";
import * as Y from "yjs";

const CLIENT_COUNT = 10;
const DOCUMENT_ID = "mid-review-stress-test";
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

interface StressClient {
  id: number;
  document: Y.Doc;
  sharedArray: Y.Array<string>;
  socket: WebSocket;
  connected: boolean;
  updateCount: number;
}

const clients: StressClient[] = [];

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const waitForConnections = async (): Promise<void> => {
  const timeout = Date.now() + 10000;

  while (clients.filter((client) => client.connected).length < CLIENT_COUNT) {
    if (Date.now() > timeout) {
      throw new Error(
        `Timeout: only ${clients.filter((client) => client.connected).length}/${CLIENT_COUNT} clients connected.`,
      );
    }

    await wait(100);
  }
};

const waitForUpdates = async (): Promise<void> => {
  const timeout = Date.now() + 10000;

  while (clients.some((client) => client.sharedArray.length < CLIENT_COUNT)) {
    if (Date.now() > timeout) {
      throw new Error(
        "Timeout: not all clients received the complete synchronized state.",
      );
    }

    await wait(100);
  }
};

const closeClients = (): void => {
  for (const client of clients) {
    if (
      client.socket.readyState === WebSocket.OPEN ||
      client.socket.readyState === WebSocket.CONNECTING
    ) {
      client.socket.close();
    }

    client.document.destroy();
  }
};

const runStressTest = async (): Promise<void> => {
  console.log("==========================================");
  console.log(" SyncDoc 10-Client Stress Test");
  console.log("==========================================");
  console.log(`Document: ${DOCUMENT_ID}`);
  console.log(`Clients:  ${CLIENT_COUNT}`);
  console.log("");

  for (let index = 0; index < CLIENT_COUNT; index += 1) {
    const document = new Y.Doc();
    const sharedArray = document.getArray<string>("stress-test");

    const client: StressClient = {
      id: index + 1,
      document,
      sharedArray,
      socket: new WebSocket(SERVER_URL),
      connected: false,
      updateCount: 0,
    };

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
        Y.applyUpdate(client.document, payload, client.socket);
      }
    });

    client.socket.addEventListener("error", (error) => {
      console.error(`Client ${client.id} WebSocket error:`, error);
    });

    document.on(
      "update",
      (update: Uint8Array, origin: unknown) => {
        if (
          origin === client.socket ||
          client.socket.readyState !== WebSocket.OPEN
        ) {
          return;
        }

        client.updateCount += 1;

        client.socket.send(
          createMessage(UPDATE_MESSAGE, update),
        );
      },
    );

    clients.push(client);
  }

  await waitForConnections();

  console.log(`PASS: ${CLIENT_COUNT}/${CLIENT_COUNT} clients connected.`);

  await wait(1000);

  console.log("");
  console.log("Sending concurrent Yjs updates...");

  for (const client of clients) {
    client.document.transact(
      () => {
        client.sharedArray.push([
          `client-${client.id}-update`,
        ]);
      },
      "stress-test-local",
    );
  }

  await waitForUpdates();

  const expectedValues = Array.from(
    { length: CLIENT_COUNT },
    (_, index) => `client-${index + 1}-update`,
  ).sort();

  for (const client of clients) {
    const actualValues = client.sharedArray
      .toArray()
      .sort();

    const expected = JSON.stringify(expectedValues);
    const actual = JSON.stringify(actualValues);

    if (actual !== expected) {
      throw new Error(
        `Client ${client.id} did not converge. Expected ${expected}, received ${actual}.`,
      );
    }
  }

  const firstState = JSON.stringify(
    clients[0].sharedArray.toArray(),
  );

  const allClientsConverged = clients.every(
    (client) =>
      JSON.stringify(client.sharedArray.toArray()) === firstState,
  );

  if (!allClientsConverged) {
    throw new Error(
      "Clients contain different final Yjs states.",
    );
  }

  console.log(
    `PASS: All ${CLIENT_COUNT} clients received all ${CLIENT_COUNT} concurrent updates.`,
  );

  console.log(
    "PASS: All clients converged to the same final Yjs state.",
  );

  console.log("");
  console.log("Update counts sent by clients:");

  for (const client of clients) {
    console.log(
      `  Client ${client.id}: ${client.updateCount}`,
    );
  }

  console.log("");
  console.log("==========================================");
  console.log(" STRESS TEST PASSED");
  console.log("==========================================");
};

runStressTest()
  .catch((error: unknown) => {
    console.error("");
    console.error("==========================================");
    console.error(" STRESS TEST FAILED");
    console.error("==========================================");
    console.error(
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => {
      closeClients();
    }, 500);
  });

