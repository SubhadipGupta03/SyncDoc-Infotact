 # SyncDoc — Delta Tracking Test

# What this test checks

This test checks whether SyncDoc can receive a change from another client
without removing or changing content that was already created locally.

The test was run using the actual SyncDoc WebSocket server with Yjs.

# Test setup

- Document ID: `mid-review-delta-test`
- Clients: 2
- Client A: creates the local content
- Client B: creates the remote content
- Connection: WebSocket
- Sync layer: Yjs

# Test steps

 1. Connect both clients

Client A and Client B were connected to the same document through the
SyncDoc WebSocket server.

 2. Add content from Client A

Client A created the following content:

```text
Client A local content