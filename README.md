# SyncDoc

## Collaborative Document Engine with AST Conflict Resolution

SyncDoc is a real-time collaborative document engine designed for structured, block-level document editing.

Unlike traditional text editors that treat a document as one large text string, SyncDoc represents documents as structured **Abstract Syntax Tree (AST)** nodes made up of independent blocks. This allows collaborators to work on different parts of the same document while preserving structural changes and reducing destructive overwrites.

The system combines:

- React + TypeScript for the frontend
- Node.js + Express + TypeScript for the backend
- MongoDB + Mongoose for persistence
- Yjs for CRDT-based synchronization
- Native WebSockets (`ws`) for real-time communication
- JWT + bcryptjs for authentication
- DOMPurify + jsdom for XSS protection
- AST-based HTML transformation
- PDF document export
- Block-level locking
- Real-time user presence
- Remote selection synchronization

---

# Project Overview

SyncDoc addresses a common problem in collaborative document editors:

> Multiple users editing the same structured document can overwrite each other's changes or create inconsistent document states.

Traditional text-based conflict handling becomes difficult when documents contain different structural elements such as headings, paragraphs, sections, and code blocks.

SyncDoc addresses this by representing documents as structured AST nodes and synchronizing their collaborative state through Yjs CRDTs and native WebSockets.

The system also uses localized block locking to prevent two users from simultaneously editing the exact same block.

## Supported Document Node Types

SyncDoc currently supports:

- `heading`
- `paragraph`
- `code`
- `section`

Each node can contain nested child nodes.

Example:

```text
Document
│
├── Section
│   ├── Heading
│   ├── Paragraph
│   └── Code
│
└── Section
    ├── Heading
    └── Paragraph
```

This hierarchical structure provides the foundation for block-level synchronization, validation, transformation, and collaborative editing.

---

# Key Features

## 1. Structured AST Document Model

Documents are stored as structured AST nodes instead of a single text field.

A document node contains information such as:

```text
type
content
children
```

This allows SyncDoc to represent hierarchical document structures and maintain relationships between parent and child nodes.

---

## 2. Recursive AST Relationship Validation

SyncDoc uses Mongoose schema validation together with recursive AST relationship tracing.

Nested document structures are examined before persistence, including their child nodes.

This helps prevent structurally invalid document data from being stored.

---

## 3. Block-Based Document Editor

The React frontend renders documents as independent editable blocks.

Supported blocks include:

- Headings
- Paragraphs
- Code blocks
- Sections

Users interact with individual blocks rather than one large document textarea.

This localized editing model provides the foundation for block-level collaboration and locking.

---

## 4. Real-Time Collaboration

SyncDoc provides real-time multi-user document synchronization using Yjs and native WebSockets.

The simplified architecture is:

```text
React Client
     │
     │ WebSocket
     ▼
Node.js Server
     │
     ▼
Yjs Shared State
     │
     ▼
Connected Clients
```

Changes made by one connected user are propagated to other clients without requiring a complete page reload.

---

## 5. Yjs CRDT Synchronization

SyncDoc uses **Yjs**, a CRDT-based synchronization framework, for collaborative document state.

Yjs shared structures are used to synchronize block-level document changes between connected clients.

CRDT-based synchronization allows concurrent state changes to converge across clients without relying on a traditional full-document merge operation.

The application combines this synchronization mechanism with block-level editing controls to provide localized collaborative editing.

---

## 6. Native WebSocket Communication

SyncDoc intentionally uses the native WebSocket protocol rather than Socket.IO.

The WebSocket layer handles:

- Client connections
- Document routing
- Authentication
- Yjs synchronization
- Presence updates
- Block lock requests
- Lock ownership
- Lock release
- Lock denial
- Remote selection updates

The backend uses the `ws` WebSocket implementation.

---

## 7. User Presence

SyncDoc provides real-time presence information for collaborators working on a document.

Connected authenticated users are displayed through the collaboration interface.

Example:

```text
2 online

Deep
Rahul
```

Presence identity comes from the authenticated JWT rather than randomly generated anonymous identities.

---

## 8. Block-Level Locking

SyncDoc implements localized block-level editing locks.

When a user begins editing a block, the server can assign ownership of that block to the user.

For example:

```text
User A → Editing Block 1
User B → Editing Block 2
```

This allows users to work on different blocks simultaneously.

If another user attempts to edit a block that is currently locked, the request is denied.

The interface displays the lock state and identifies the current editor.

Example:

```text
🔒 Deep is editing this block
```

This prevents simultaneous editing of the same block and provides a clear collaboration state.

---

## 9. Lock Ownership and Release

Each active block lock contains information about its owner.

The system supports:

- Lock request
- Lock ownership
- Lock denial
- Lock release
- Active lock tracking
- Remote lock visualization
- Lock-owner messaging

When the editing user finishes the operation, the block lock is released so another collaborator can edit the block.

---

## 10. Real-Time Remote Selection

SyncDoc synchronizes block selection information between collaborators.

Selection state contains information such as:

```text
blockId
selectionStart
selectionEnd
cursorPosition
userId
userName
```

This allows the application to represent another user's active selection or cursor state.

Remote selections are visually distinguished from the local user's editing state.

---

# Authentication and Security

Authentication was added as an extension to the core Week 1–4 SyncDoc implementation.

The original SyncDoc project scope focuses primarily on AST modeling, collaboration, transformation, security, and multi-user editing. Authentication provides an additional verified identity layer for the final application.

## JWT Authentication

SyncDoc provides user authentication using JSON Web Tokens.

Users can:

- Create an account
- Log in
- Receive an authentication token
- Access the document workspace after authentication

The authenticated identity is also used by the collaboration WebSocket layer.

The application stores the authentication session on the client and sends the JWT when establishing the WebSocket connection.

---

## Password Hashing

User passwords are never stored directly as plain text.

SyncDoc uses:

```text
bcryptjs
```

to hash passwords before storing them in MongoDB.

Only password hashes are stored by the application.

---

## WebSocket Authentication

WebSocket connections require a valid authentication token.

The server verifies the JWT before accepting the collaboration connection.

The authenticated identity is taken from the verified token rather than trusting user-supplied identity information from the browser.

This prevents a client from simply claiming another user's identity through WebSocket parameters.

---

## XSS Protection

SyncDoc includes server-side HTML sanitization using:

- DOMPurify
- jsdom

User-generated document content is sanitized for applicable non-code document blocks.

The application distinguishes code blocks from normal document content so code examples can retain their intended code representation without being interpreted as executable HTML.

Example malicious input:

```html
<script>
  alert("XSS");
</script>
```

is neutralized when processed as normal document content.

The XSS behavior was also validated through an actual runtime test.

---

# AST Transformation

SyncDoc contains an AST transformation pipeline that converts structured document nodes into HTML.

The transformation process follows:

```text
AST Document
     │
     ▼
AST Traversal
     │
     ▼
HTML Transformation
     │
     ▼
Safe HTML Output
```

The transformation layer supports:

- Headings
- Paragraphs
- Code blocks
- Sections

Unsafe HTML/script fragments are escaped or sanitized according to the document content path.

---

# PDF Export

SyncDoc includes PDF export functionality for structured document content.

The general workflow is:

```text
Document AST
     │
     ▼
Rendered Document
     │
     ▼
PDF Export
```

PDF export was runtime tested during development.

The final browser workflow also successfully produced a PDF from the document workspace.

---

# Collaboration Architecture

The overall collaboration architecture is:

```text
┌──────────────────────────────────────────┐
│              React Client                │
│                                          │
│  Document Browser                        │
│  Block Editor                            │
│  Authentication UI                       │
│  Presence UI                             │
│  Block Lock UI                           │
│  Remote Selection UI                     │
│  Yjs Client                              │
└────────────────────┬─────────────────────┘
                     │
                     │ Native WebSocket
                     ▼
┌──────────────────────────────────────────┐
│             Node.js Backend              │
│                                          │
│  Express API                             │
│  Authentication                          │
│  JWT Verification                        │
│  WebSocket Routing                       │
│  Presence Tracking                       │
│  Block Lock Management                   │
│  Yjs Document Manager                    │
│  AST Validation                          │
│  HTML Transformation                     │
│  Security / Sanitization                 │
└───────────────┬──────────────────────────┘
                │
                ├───────────────────┐
                │                   │
                ▼                   ▼
        ┌───────────────┐   ┌───────────────┐
        │      Yjs      │   │    MongoDB    │
        │     CRDT      │   │               │
        │               │   │  Documents    │
        │ Shared State  │   │  Users        │
        └───────────────┘   └───────────────┘
```

---

# Document Data Architecture

A simplified SyncDoc document can be represented as:

```text
SyncDocument
│
├── title
│
├── nodes[]
│   │
│   ├── type
│   ├── content
│   └── children[]
│       │
│       ├── type
│       ├── content
│       └── children[]
│
├── createdAt
└── updatedAt
```

This nested structure allows SyncDoc to support hierarchical documents rather than flat text.

---

# Collaboration Flow

A typical collaborative editing operation follows:

```text
User starts editing a block
          │
          ▼
Client requests block lock
          │
          ▼
WebSocket Server validates request
          │
          ▼
Lock assigned to user
          │
          ▼
Other clients receive lock state
          │
          ▼
User edits block
          │
          ▼
Yjs synchronizes collaborative state
          │
          ▼
Other clients receive update
          │
          ▼
User finishes editing
          │
          ▼
Block lock released
```

---

# Project Timeline

## Week 1 — AST Modeling and Editor Foundations

### Completed

- Structured document node modeling
- Nested MongoDB/Mongoose AST schema
- Recursive AST relationship tracing
- Mongoose document validation
- Document browsing UI
- React block rendering
- Heading blocks
- Paragraph blocks
- Code blocks
- Section blocks
- Initial collaborative editor foundation

---

# Week 2 — CRDT Integration and Synchronization

### Completed

- Yjs integration
- Native WebSocket server
- WebSocket document routing
- Server-side Yjs document management
- React Yjs client integration
- Collaborative document state synchronization
- User presence
- Localized block-level locking
- Lock ownership
- Lock release
- Lock denial handling

---

# Mid-Project Review

### Completed

- Markdown-to-JSON architecture/layout representation
- 10-client collaboration stress testing
- Delta-tracking validation

## 10-Client Stress Test

The collaboration engine was tested using 10 concurrent Yjs clients.

The validation flow was:

```text
10 clients connected
        │
        ▼
Concurrent updates generated
        │
        ▼
Updates propagated
        │
        ▼
All clients received updates
        │
        ▼
Clients converged
        │
        ▼
Same final document state
```

### Result

**PASS**

The tested clients successfully received collaborative updates and converged to the same final document state.

Delta-tracking validation also confirmed that incoming network updates did not incorrectly overwrite local document input during the tested scenario.

---

# Week 3 — Transformation and Document Export

### Completed

- AST-to-HTML transformation
- Structured document transformation
- AST traversal for rendering
- HTML output generation
- PDF export functionality
- Backend transformation runtime testing
- Frontend PDF export runtime testing
- Context-aware document transformation

---

# Week 4 — Security and Advanced Collaboration

### Completed

- DOMPurify integration
- jsdom integration
- XSS sanitization
- AST security validation
- Code-block safety handling
- Visual block locking indicators
- Lock ownership indicators
- Real-time remote selection synchronization
- Selection cleanup handling
- Multi-user structural editing
- Runtime XSS validation
- Authentication extension
- JWT-based user identity
- Password hashing using bcryptjs
- Authenticated WebSocket connections

---

# Final Collaboration Demonstration

The final demonstration document uses multiple independent blocks:

```text
SyncDoc Final Demo

Block 1
"This document demonstrates collaborative block editing."

Block 2
"AST conflict resolution preserves structural changes."

Block 3
"Real-time synchronization uses Yjs."
```

Two authenticated users can work on different blocks simultaneously.

Example:

```text
Browser 1 — Deep
        │
        └── Editing Block 1

Browser 2 — Rahul
        │
        └── Editing Block 2
```

The application displays both connected collaborators:

```text
2 online

Deep
Rahul
```

If Deep edits a block, Rahul receives the update in real time.

If Rahul edits another block, Deep receives the update in real time.

If one user attempts to edit a block currently locked by another user, the interface displays the lock owner and prevents conflicting editing.

Example:

```text
🔒 Deep is editing this block
```

and in the reverse direction:

```text
🔒 Rahul is editing this block
```

The final two-browser runtime demonstration verified both directions of collaborative editing.

---

# Security Testing

SyncDoc includes runtime security validation for document content.

## XSS Runtime Test

A malicious document value such as:

```html
<script>alert("XSS")</script>
```

was tested against the document sanitization pipeline.

For normal document content:

```text
Malicious script
       │
       ▼
DOMPurify
       │
       ▼
Unsafe markup removed
       │
       ▼
Safe document content
```

### Result

**PASS**

The runtime test confirmed that malicious script content was removed from normal paragraph content.

Code blocks retain code as code content rather than executing it as HTML.

---

# PDF Runtime Test

The AST-to-PDF workflow was tested using structured document content.

### Result

**PASS**

Structured document content was successfully transformed and exported as PDF.

The browser-based PDF export button was also verified during the final application test.

---

# Multi-Browser Runtime Test

The final collaboration workflow was tested with two authenticated browser sessions.

### Users

```text
Browser 1 → Deep
Browser 2 → Rahul
```

### Verified

- Both users successfully authenticated
- Both users entered the document workspace
- Presence displayed both users
- Presence displayed `2 online`
- Deep could edit a block
- Rahul received Deep's update
- Rahul saw Deep's block lock
- Rahul could not edit Deep's locked block
- Rahul could edit another block
- Deep received Rahul's update
- Deep saw Rahul's block lock
- Locks were released after editing
- Refresh/reconnection preserved the authenticated collaboration workflow
- PDF export worked

---

# Testing and Validation

SyncDoc was validated through both build-time and runtime testing.

## Backend Runtime

The backend successfully started with:

```text
MongoDB connected successfully
SyncDoc server running on http://localhost:5000
SyncDoc WebSocket server running on ws://localhost:5000/ws
```

## Backend Build

Command:

```powershell
cd E:\syncdoc\server
npm run build
```

Result:

```text
tsc
```

The backend TypeScript build completed successfully without compilation errors.

## Frontend Build

Command:

```powershell
cd E:\syncdoc\client
npm run build
```

The Vite production build completed successfully.

The build may report a bundle-size warning for large JavaScript chunks. This is a build optimization warning rather than a build failure.

---

# 10-Client Stress Test

The collaboration engine was tested using 10 concurrent Yjs clients.

The test verified:

```text
10 clients
    │
    ▼
Concurrent updates
    │
    ▼
WebSocket propagation
    │
    ▼
Yjs CRDT synchronization
    │
    ▼
Clients converge
```

### Result

**PASS**

The tested clients successfully received collaborative updates and converged to the same final document state.

The test also included validation of incoming network deltas to ensure local document state was not incorrectly corrupted by collaborative updates.

---

# XSS Runtime Test

The sanitization pipeline was tested with malicious HTML/script content.

### Result

**PASS**

Unsafe script content was removed from normal document content.

Code content remained represented as code rather than executable HTML.

---

# PDF Runtime Test

The AST-to-PDF workflow was tested on structured document content.

### Result

**PASS**

Structured document content was successfully transformed and exported as PDF.

---

# Collaboration Demo Scenario

The recommended final demonstration flow is:

## Step 1

Open the SyncDoc landing page.

## Step 2

Navigate to the document workspace.

If the user is not authenticated, SyncDoc displays the authentication page.

## Step 3

Log in as Deep in Browser 1.

## Step 4

Log in as Rahul in Browser 2.

## Step 5

Open:

```text
SyncDoc Final Demo
```

## Step 6

Verify:

```text
2 online

Deep
Rahul
```

## Step 7

Deep edits Block 1.

Show that Rahul receives the change without refreshing.

## Step 8

Show Rahul's locked-block state:

```text
🔒 Deep is editing this block
```

## Step 9

Rahul edits Block 2.

Show that Deep receives Rahul's change.

## Step 10

Show the reverse lock state:

```text
🔒 Rahul is editing this block
```

## Step 11

Release the locks and demonstrate that the other user can edit the previously locked block.

## Step 12

Export the document to PDF.

## Step 13

Show the XSS protection test if requested.

This demonstration covers the primary SyncDoc collaboration workflow.

---

# Technology Stack

## Frontend

| Technology | Purpose |
|---|---|
| React | User interface |
| TypeScript | Type safety |
| Vite | Frontend development and build tooling |
| React Router | Application routing |
| Yjs | Client-side CRDT synchronization |
| Native WebSocket | Real-time communication |
| Lucide React | UI icons |
| DOMPurify | Client-side sanitization where applicable |

## Backend

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express | REST API |
| TypeScript | Backend type safety |
| MongoDB | Persistent document and user storage |
| Mongoose | MongoDB modeling and validation |
| Yjs | CRDT synchronization |
| `ws` | Native WebSocket server |
| bcryptjs | Password hashing |
| jsonwebtoken | JWT authentication |
| DOMPurify | Server-side HTML sanitization |
| jsdom | Server-side DOM environment |

---

# Project Structure

```text
SyncDoc/
│
├── client/
│   │
│   ├── src/
│   │   ├── api/
│   │   │   ├── auth.ts
│   │   │   └── documents.ts
│   │   │
│   │   ├── collaboration/
│   │   │   └── yjsClient.ts
│   │   │
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── pdfExporter.ts
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── server/
│   │
│   ├── src/
│   │   ├── auth/
│   │   │   └── auth.ts
│   │   │
│   │   ├── collaboration/
│   │   │   ├── websocketSync.ts
│   │   │   └── yjsDocumentManager.ts
│   │   │
│   │   ├── models/
│   │   │   ├── document.ts
│   │   │   ├── user.ts
│   │   │   └── yjsDocument.ts
│   │   │
│   │   ├── security/
│   │   │   └── sanitize.ts
│   │   │
│   │   ├── transformation/
│   │   │   └── astToHtml.ts
│   │   │
│   │   └── server.ts
│   │
│   └── package.json
│
├── docs/
│   └── WEEK1_CHECKLIST.md
│
├── .gitignore
├── README.md
└── prd.md
```

---

# Installation

## Prerequisites

Install:

- Node.js
- npm
- MongoDB
- Git

Verify Node.js:

```bash
node --version
```

Verify npm:

```bash
npm --version
```

---

# Backend Setup

Open a terminal:

```powershell
cd E:\syncdoc\server
npm install
```

Configure the required environment variables.

Example:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
```

> **Security:** Never commit real database connection strings, JWT secrets, passwords, API keys, or other credentials to GitHub. Store them in environment variables or a local `.env` file that is excluded by `.gitignore`.

Start the backend:

```powershell
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

The WebSocket server runs on:

```text
ws://localhost:5000/ws
```

---

# Frontend Setup

Open another terminal:

```powershell
cd E:\syncdoc\client
npm install
```

Start the frontend:

```powershell
npm run dev
```

The frontend is available at:

```text
http://localhost:5173
```

---

# Production Build

## Backend

```powershell
cd E:\syncdoc\server
npm run build
```

## Frontend

```powershell
cd E:\syncdoc\client
npm run build
```

The production frontend output is generated inside:

```text
client/dist/
```

---

# Authentication Flow

The authentication architecture follows:

```text
User
 │
 ├── Sign Up
 │      │
 │      ▼
 │  Password Hash
 │      │
 │      ▼
 │   MongoDB
 │      │
 │      ▼
 │   JWT Token
 │
 └── Login
        │
        ▼
 Credential Verification
        │
        ▼
     JWT Token
        │
        ▼
 Authenticated Workspace
        │
        ▼
Authenticated WebSocket
```

Authenticated users can enter the collaborative document workspace.

The WebSocket collaboration layer validates the JWT before establishing a collaboration session.

---

# API Overview

## Authentication

### Sign Up

```http
POST /auth/signup
```

Request:

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "example-password"
}
```

The server validates the request, hashes the password, creates the user, and returns an authentication token.

### Login

```http
POST /auth/login
```

Request:

```json
{
  "email": "user@example.com",
  "password": "example-password"
}
```

The server verifies the credentials and returns an authentication token.

> The example credentials above are placeholders only. Never place real credentials in source code, documentation, or GitHub.

---

## Documents

### Get Documents

```http
GET /documents
```

Returns available documents.

### Create Document

```http
POST /documents
```

Example:

```json
{
  "title": "SyncDoc Final Demo",
  "nodes": [
    {
      "type": "paragraph",
      "content": "This document demonstrates collaborative block editing."
    },
    {
      "type": "paragraph",
      "content": "AST conflict resolution preserves structural changes."
    },
    {
      "type": "paragraph",
      "content": "Real-time synchronization uses Yjs."
    }
  ]
}
```

### Delete Document

```http
DELETE /documents/:id
```

Deletes the specified document.

---

# WebSocket Collaboration

The collaboration server uses native WebSockets to establish real-time document sessions.

A simplified connection flow is:

```text
Client
 │
 │ documentId + JWT
 ▼
WebSocket Server
 │
 ├── Verify JWT
 │
 ├── Identify authenticated user
 │
 ├── Join document session
 │
 ├── Register presence
 │
 └── Synchronize Yjs state
```

The server manages collaborative state per document.

The client does not control the authenticated identity used for presence. The server derives the collaboration identity from the verified JWT.

---

# Design Principles

SyncDoc follows several architectural principles.

## Structured Over Flat Text

Documents are represented as structured AST nodes rather than one large text string.

## Localized Collaboration

Editing and locking are handled at the block level wherever possible.

## Real-Time Synchronization

Yjs and native WebSockets provide continuous collaborative state synchronization.

## Server-Verified Identity

WebSocket clients cannot arbitrarily claim another user's identity.

## Secure Document Handling

User-generated content is sanitized before unsafe HTML can become executable document content.

## Runtime Validation

Important functionality is verified through actual runtime tests rather than only static code checks.

---

# Current Project Status

The SyncDoc implementation is complete across the planned **Week 1–4 development scope**.

The completed implementation covers AST modeling, real-time CRDT collaboration, block-level synchronization, transformation, PDF export, security hardening, presence, locking, selection synchronization, and multi-user runtime validation.

Authentication was added as an additional application feature, providing JWT-based identity, password hashing, protected workspace access, and authenticated WebSocket collaboration.

## Completed

- [x] Nested AST document model
- [x] Mongoose schema validation
- [x] Recursive AST relationship tracing
- [x] React document browser
- [x] Block-based editor
- [x] Heading blocks
- [x] Paragraph blocks
- [x] Code blocks
- [x] Section blocks
- [x] Yjs CRDT synchronization
- [x] Native WebSocket collaboration
- [x] Server-side Yjs document management
- [x] User presence
- [x] Block-level locking
- [x] Lock ownership
- [x] Lock denial
- [x] Lock release
- [x] 10-client stress testing
- [x] Delta-tracking validation
- [x] AST-to-HTML transformation
- [x] PDF export
- [x] DOMPurify XSS protection
- [x] Runtime XSS testing
- [x] Remote selection synchronization
- [x] Authentication
- [x] JWT-based identity
- [x] Password hashing
- [x] Authenticated WebSocket connections
- [x] Final multi-browser collaboration demonstration
- [x] Frontend production build
- [x] Backend production build

---

# Future Improvements

Possible future improvements include:

- More advanced AST conflict-resolution strategies
- Fine-grained cursor synchronization
- Version history
- Document snapshots
- Collaborative undo/redo
- Offline-first editing
- More advanced document permissions
- Role-based access control
- Invitation-based collaboration
- Document sharing
- Search across documents
- Document version comparison
- Collaboration analytics
- Horizontal scaling of the WebSocket layer
- Redis-backed presence and collaboration state
- Automated integration testing
- Improved frontend code splitting and bundle optimization

These features are outside the current core implementation and can be added as the system evolves.

---

# Project Objective

The primary objective of SyncDoc is to demonstrate how a modern collaborative editor can combine:

```text
Structured AST
      +
CRDT Synchronization
      +
WebSockets
     