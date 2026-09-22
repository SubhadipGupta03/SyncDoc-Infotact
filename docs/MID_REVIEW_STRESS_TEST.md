\# SyncDoc — Mid-Review 10-Client Stress Test



\## Purpose



This test verifies that the SyncDoc Yjs/WebSocket synchronization layer can handle concurrent updates from 10 independent clients connected to the same collaborative document.



The test uses the actual SyncDoc WebSocket server and Yjs synchronization protocol.



\## Test Configuration



\- Clients: 10

\- Document ID: `mid-review-stress-test`

\- WebSocket endpoint: `ws://localhost:5000/ws`

\- Shared Yjs structure: `Y.Array<string>`

\- Update pattern: one concurrent update from each client



\## Test Procedure



1\. Start the SyncDoc backend WebSocket server.

2\. Create 10 independent Yjs client instances.

3\. Connect all 10 clients to the same document ID.

4\. Wait until all clients are connected.

5\. Each client adds one unique value to the shared Yjs array.

6\. Allow the WebSocket server to broadcast the Yjs updates.

7\. Verify that every client receives all 10 updates.

8\. Verify that all clients converge to the same final Yjs state.



\## Verification Result



The stress test completed successfully.



```text

PASS: 10/10 clients connected.



PASS: All 10 clients received all 10 concurrent updates.

PASS: All clients converged to the same final Yjs state.

