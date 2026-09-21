\# SyncDoc — Architecture and Layout Documentation



\## 1. System Architecture



SyncDoc is a collaborative document engine for structured, block-level document editing and real-time synchronization.



The current implementation is organized into three primary layers:



```text

┌──────────────────────────────────────┐

│            React Client              │

│                                      │

│  Document Browser                    │

│  Block Editor                        │

│  Yjs Client                          │

│  Presence Indicators                 │

│  Block-Level Locking                 │

└──────────────────┬───────────────────┘

&#x20;                  │

&#x20;                  │ WebSocket

&#x20;                  │

┌──────────────────▼───────────────────┐

│          Node.js Server              │

│                                      │

│  Express                             │

│  WebSocket Routing                   │

│  Yjs Document Manager                │

│  Presence Tracking                   │

│  Block Lock Management               │

└──────────────────┬───────────────────┘

&#x20;                  │

&#x20;                  │ Shared CRDT State

&#x20;                  │

┌──────────────────▼───────────────────┐

│             Yjs / CRDT               │

│                                      │

│  Shared Document State               │

│  Collaborative Block Updates         │

└──────────────────────────────────────┘

&#x20;                  │

&#x20;                  │ Document Persistence

&#x20;                  ▼

┌──────────────────────────────────────┐

│        MongoDB / Mongoose            │

│                                      │

│  SyncDocument                        │

│  └── AST Nodes                       │

│      ├── heading                     │

│      ├── paragraph                   │

│      ├── code                         │

│      └── section                     │

└──────────────────────────────────────┘

