# SyncDoc

SyncDoc is a collaborative document engine for structured, block-level
document editing and real-time synchronization.

The project uses React and TypeScript for the client, Node.js and Express for
the backend, MongoDB and Mongoose for document data, and Yjs with WebSockets
for real-time collaboration.

## Project Overview

SyncDoc represents a document as a structured collection of blocks instead of
treating the entire document as a single piece of text.

The current document structure supports the following node types:

- Heading
- Paragraph
- Code
- Section

This structure provides the base for block-level editing, synchronization,
and conflict handling.

The current implementation covers:

- AST and document structure
- Editor foundations
- Real-time collaborative synchronization
- User presence
- Block-level locking

## Current Status

### Week 1 — AST Modeling and Editor Foundations

Completed:

- Structured document node modeling
- Recursive AST relationship tracing
- Document browsing UI
- Block-level rendering
- Heading, paragraph, code, and section blocks
- Mongoose validation for document structures

### Week 2 — CRDT Integration and Synchronization

Completed:

- Yjs integration
- WebSocket server
- Server-side Yjs document management
- React client connected to the Yjs WebSocket server
- Collaborative document state synchronization
- User presence indicators
- Localized  operational block-level locking
- Lock ownership and release handling
- Lock denial handling

### Mid-Project Review

completed :

- Markdown to JSON architecture/layout diagram
- Stress testing with 10 concurrent clients
- Formal delta-tracking verification

Validation results:

- 10 concurrent Yjs clients connected successfully.
- All 10 clients received all concurrent updates.
- All clients converged to the same final state.
- Incoming network deltas were applied without overwriting existing local content.

## Architecture

The current collaboration flow is:

```text
┌────────────────────────┐
│      React Client      │
│                        │
│  Document Browser      │
│  Block Editor          │
│  Yjs Client            │
│  Presence UI           │
│  Block Lock UI         │
└───────────┬────────────┘
            │
            │ WebSocket
            │
┌───────────▼────────────┐
│     Node.js Server     │
│                        │
│  Express               │
│  WebSocket Routing     │
│  Presence Tracking     │
│  Block Locking         │
│  Yjs Document Manager  │
└───────────┬────────────┘
            │
            │
┌───────────▼────────────┐
│       Yjs / CRDT       │
│                        │
│  Shared Document       │
│  Shared Blocks         │
└────────────────────────┘