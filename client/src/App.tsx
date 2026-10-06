import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import {
  ArrowRight,
  ChevronDown,
  Download,
  FileText,
  Menu,
  Sun,
  Users,
  X,
} from "lucide-react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";
import {
  adaptApiDocument,
  createDocument,
  deleteDocument,
  fetchDocuments,
  type ApiDocument,
  type EditorBlock,
} from "./api/documents";
import { exportDocumentToPdf } from "./pdfExporter";
import {
  connectToDocument,
  type BlockLock,
  type BlockSelection,
  type PresenceUser,
  type YjsConnection,
} from "./collaboration/yjsClient";
import "./App.css";

const navigation = [
  { label: "Home", to: "/" },
  { label: "Documents", to: "/documents" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

type Tile = {
  id: number;
  src: string;
  alt: string;
};

const tiles: Tile[] = [
  { id: 1, src: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=85", alt: "Code editor with colorful syntax" },
  { id: 2, src: "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=600&q=85", alt: "Team collaborating around a table" },
  { id: 3, src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=85", alt: "Analytics dashboard on a laptop" },
  { id: 4, src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=85", alt: "Developer working on a laptop" },
  { id: 5, src: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=85", alt: "Close-up of a circuit board" },
  { id: 6, src: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=85", alt: "Server infrastructure lights" },
  { id: 7, src: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?auto=format&fit=crop&w=600&q=85", alt: "Abstract blue and violet digital shape" },
  { id: 8, src: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=600&q=85", alt: "Product team in a meeting" },
  { id: 9, src: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=600&q=85", alt: "People reviewing work together" },
  { id: 10, src: "https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&w=600&q=85", alt: "Interface design on a screen" },
  { id: 11, src: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=85", alt: "Glowing technology infrastructure" },
  { id: 12, src: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=85", alt: "Open office collaboration space" },
  { id: 13, src: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=600&q=85", alt: "Programming code on a monitor" },
  { id: 14, src: "https://images.unsplash.com/photo-1523726491678-bf852e717f6a?auto=format&fit=crop&w=600&q=85", alt: "Design workspace with documents" },
  { id: 15, src: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=600&q=85", alt: "Modern workspace for a team" },
  { id: 16, src: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=85", alt: "Abstract structured digital diagram" },
];

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightMode, setLightMode] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`site-header${lightMode ? " light-mode" : ""}`}>
      <div className="header-inner">
        <Link className="logo" to="/" onClick={closeMenu} aria-label="SyncDoc home">
          SyncDoc
          <ChevronDown className="logo-chevron" size={15} strokeWidth={2} aria-hidden="true" />
        </Link>

        <nav className={`desktop-nav${menuOpen ? " mobile-nav-open" : ""}`} aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              key={item.to}
              to={item.to}
              onClick={closeMenu}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          <Link className="login-link" to="/login" onClick={closeMenu}>
            Login
          </Link>
          <Link className="get-started" to="/documents" onClick={closeMenu}>
            Get Started
            <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </Link>
          <button
            className="theme-button"
            type="button"
            aria-label={lightMode ? "Use dark theme" : "Use light theme"}
            onClick={() => setLightMode((current) => !current)}
          >
            <Sun size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            className="menu-button"
            type="button"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function DocumentsPage() {
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [locks, setLocks] = useState<BlockLock[]>([]);
  const [selections, setSelections] = useState<BlockSelection[]>([]);
  useEffect(() => {
  console.log("[SyncDoc] Active selections:", selections);
}, [selections]);

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [autoEditNewDocument, setAutoEditNewDocument] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<YjsConnection | null>(null);

  useEffect(() => {
    let active = true;
    fetchDocuments()
      .then((loaded) => {
        if (!active) return;
        setDocuments(loaded);
        if (loaded[0]) setSelectedId(loaded[0]._id);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Unable to load documents.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = documents.find((document) => document._id === selectedId);
  const adapted = useMemo(
    () => (selected ? adaptApiDocument(selected) : null),
    [selected],
  );

  useEffect(() => {
    if (!selected || !adapted) return;

    const connection = connectToDocument(selected._id);
    connectionRef.current = connection;
    setBlocks(adapted.blocks);
    setEditingBlockId(null);
    setDrafts({});
    setLockMessage(null);

    const readSharedBlocks = () => {
      const nextBlocks = adapted.blocks.map((block) => {
        const shared = connection.sharedBlocks.get(block.id);
        if (!shared) return block;

        try {
          const parsed: unknown = JSON.parse(shared);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "id" in parsed &&
            "type" in parsed &&
            "content" in parsed &&
            typeof parsed.id === "string" &&
            typeof parsed.type === "string" &&
            typeof parsed.content === "string"
          ) {
            return { ...block, content: parsed.content };
          }
        } catch {
          console.error(`[SyncDoc] Invalid shared block: ${block.id}`);
        }
        return block;
      });
      setBlocks(nextBlocks);
    };

    const initializeSharedDocument = () => {
      if (connection.sharedBlocks.size === 0) {
        for (const block of adapted.blocks) {
          connection.sharedBlocks.set(block.id, JSON.stringify(block));
        }
      }
      readSharedBlocks();
    };

    const unsubscribePresence = connection.onPresenceChange(setPresence);
    const unsubscribeSelections =
  connection.onBlockSelectionChange(setSelections);
    const unsubscribeLocks = connection.onBlockLockChange((nextLocks) => {
  console.log("[SyncDoc] Locks received:", nextLocks);
  setLocks(nextLocks);
});
    const unsubscribeDenied = connection.onBlockLockDenied((blockId, owner) => {
      setEditingBlockId((current) => (current === blockId ? null : current));
      setLockMessage(`${owner.userName} is currently editing this block.`);
    });
    const unsubscribeSync = connection.onSyncComplete(initializeSharedDocument);
    const unsubscribeAutoEdit =
  connection.onSyncComplete(() => {
    if (!autoEditNewDocument) return;

    const firstBlock = adapted.blocks[0];

    if (firstBlock) {
      startEditing(firstBlock.id);
      setAutoEditNewDocument(false);
    }
  });
    

const handleSharedBlocks = (
  event: Y.YMapEvent<string>,
) => {
  const changedBlockIds = Array.from(
    event.keysChanged,
  );

  setBlocks((current) =>
    current.map((block) => {
      if (!changedBlockIds.includes(block.id)) {
        return block;
      }

      const shared = connection.sharedBlocks.get(block.id);

      if (!shared) {
        return block;
      }

      try {
        const parsed: unknown = JSON.parse(shared);

        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "content" in parsed &&
          typeof parsed.content === "string"
        ) {
          return {
            ...block,
            content: parsed.content,
          };
        }
      } catch {
        console.error(
          `[SyncDoc] Invalid shared block: ${block.id}`,
        );
      }

      return block;
    }),
  );
};

connection.sharedBlocks.observe(handleSharedBlocks);

return () => {
  unsubscribePresence();
  unsubscribeSelections();
  unsubscribeLocks();
  unsubscribeDenied();
  unsubscribeSync();
  unsubscribeAutoEdit();
  connection.sharedBlocks.unobserve(handleSharedBlocks);
  connection.disconnect();
  connectionRef.current = null;
};
    
  }, [documents, selectedId, selected, adapted]);

  

  const startEditing = (blockId: string) => {
  const connection = connectionRef.current;

  console.log("[SyncDoc] EDIT CHECK:", {
    currentUserId: connection?.currentUser?.id,
    currentUserName: connection?.currentUser?.name,
    blockId,
    lockOwner: locks.find((lock) => lock.blockId === blockId),
  });

  if (!connection?.currentUser) return;

    const owner = locks.find((lock) => lock.blockId === blockId);

    if (owner && owner.userId !== connection.currentUser?.id) {
      setLockMessage(`${owner.userName} is currently editing this block.`);
      return;
    }
    if (owner?.userId === connection.currentUser.id) {
    const block = blocks.find((item) => item.id === blockId);
    const sharedValue = connection.sharedBlocks.get(blockId);
console.log(
  "[SyncDoc] CONTENT BEFORE EDIT:",
  {
    blockId,
    localBlockContent: block?.content,
    sharedContent: sharedValue,
  },
);
    let latestContent = block?.content ?? "";

  if (sharedValue) {
    try {
      const parsed: unknown = JSON.parse(sharedValue);

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "content" in parsed &&
        typeof parsed.content === "string"
      ) {
        latestContent = parsed.content;
      }
    } catch {
      console.error(`[SyncDoc] Invalid shared block: ${blockId}`);
    }
  }

  setDrafts((current) => ({
    ...current,
    [blockId]: latestContent,
  }));

  setBlocks((current) =>
    current.map((item) =>
      item.id === blockId
        ? { ...item, content: latestContent }
        : item,
    ),
  );

  setLockMessage(null);
  setEditingBlockId(blockId);
  return;
}

  setLockMessage("Requesting edit access...");
  connection.requestBlockLock(blockId);
};
    
const commitBlock = (blockId: string) => {
  const draft = drafts[blockId];
  const block = blocks.find((item) => item.id === blockId);
  const connection = connectionRef.current;

  if (!block || typeof draft !== "string" || !connection) return;

  const updated = { ...block, content: draft };

  connection.sharedBlocks.set(
    blockId,
    JSON.stringify(updated),
  );

  setBlocks((current) =>
    current.map((item) =>
      item.id === blockId ? updated : item,
    ),
  );

  connection.releaseBlockLock(blockId);

  setEditingBlockId(null);

  setDrafts((current) => {
    const next = { ...current };
    delete next[blockId];
    return next;
  });

  setLockMessage(null);
};
  
const handleCreateDocument = async () => {
  const title = window.prompt("Enter document name:");

  if (!title?.trim()) {
    return;
  }

  try {
    const newDocument = await createDocument(title.trim());

    setDocuments((current) => [
      newDocument,
      ...current,
    ]);

    setSelectedId(newDocument._id);
    setAutoEditNewDocument(true);
  } catch (error: unknown) {
    setError(
      error instanceof Error
        ? error.message
        : "Unable to create document.",
    );
  }
};

const handleDeleteDocument = async (documentId: string) => {
  const documentToDelete = documents.find(
    (document) => document._id === documentId,
  );

  if (!documentToDelete) {
    return;
  }

  const confirmed = window.confirm(
    `Delete "${documentToDelete.title}"?`,
  );

  if (!confirmed) {
    return;
  }

  try {
    await deleteDocument(documentId);

    setDocuments((current) =>
      current.filter(
        (document) => document._id !== documentId,
      ),
    );

    if (selectedId === documentId) {
      setSelectedId(null);
    }
  } catch (error: unknown) {
    setError(
      error instanceof Error
        ? error.message
        : "Unable to delete document.",
    );
  }
};


  const exportCurrentDocument = () => {
    if (adapted) exportDocumentToPdf({ title: adapted.title, blocks: adapted.blocks });
  };

  if (loading) {
  return (
    <main className="documents-page">
      <div className="documents-state">Loading your documents...</div>
    </main>
  );
}
  if (error) {
    return (
      <div className="documents-state documents-error">
        <FileText size={28} />
        <strong>Couldn�t load your documents</strong>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <main className="documents-page">
      <div className="documents-topbar">
        <div>
          <p className="documents-kicker">WORKSPACE</p>
          <h1>Your documents</h1>
          <p className="documents-subtitle">Structured, collaborative documents from your SyncDoc engine.</p>
        </div>
        <button className="export-button" type="button" onClick={exportCurrentDocument}>
          <Download size={15} /> Export PDF
        </button>
      </div>
      <div className="documents-workspace">
        <aside className="documents-sidebar">
          <div className="sidebar-heading">
  <span>Documents</span>

  <button
    className="new-document-button"
    type="button"
    onClick={handleCreateDocument}
  >
    + New
  </button>
</div>
          {documents.length === 0 ? (
            <p className="empty-documents">No documents found.</p>
          ) : (
            documents.map((document) => (
  <div
    className="document-card-row"
    key={document._id}
  >
    <button
      className={`document-card${document._id === selectedId ? " selected" : ""}`}
      type="button"
      onClick={() => setSelectedId(document._id)}
    >
      <FileText size={16} />
      <span>
        <strong>{document.title}</strong>
        <small>
          {document.updatedAt
            ? new Date(document.updatedAt).toLocaleDateString()
            : "Recently updated"}
        </small>
      </span>
    </button>

    <button
      className="delete-document-button"
      type="button"
      onClick={() => handleDeleteDocument(document._id)}
      aria-label={`Delete ${document.title}`}
      title="Delete document"
    >
      ×
    </button>
  </div>
))
          )}
        </aside>
        <section className="document-editor" aria-label="Selected document">
          <div className="editor-toolbar">
            <span>{adapted?.meta}</span>
            <span className="presence">
              <Users size={14} />
              {presence.length } online
              {presence.length > 0 && (
    <span className="presence-users">
      {presence.map((user) => user.name).join(", ")}
    </span>
              )}
            </span>
          </div>
          {lockMessage && <div className="lock-message">{lockMessage}</div>}
          <article className="document-content">
            <h2>{adapted?.title || "Untitled document"}</h2>
            
             {blocks.map((block) => {
  const isEditing = editingBlockId === block.id;
  const lockOwner = locks.find((lock) => lock.blockId === block.id);
  const isLockedByOther = Boolean(
    lockOwner &&
    lockOwner.userId !== connectionRef.current?.currentUser?.id,
  );
  const remoteSelection = selections.find(
  (selection) =>
    selection.blockId === block.id &&
    selection.userId !== connectionRef.current?.currentUser?.id,
);
const sendSelectionUpdate = (
    event: React.SyntheticEvent<HTMLTextAreaElement>,
  ) => {
    const textarea = event.currentTarget;
    const connection = connectionRef.current;

    if (!connection) return;

    connection.sendBlockSelection({
      blockId: block.id,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
      cursorPosition: textarea.selectionStart,
    });
  };

  const editor = (
    <div className="editing-block-wrapper">
      <textarea
        autoFocus
        className={`block-editor block-editor-${block.type}`}
        style={{
    borderColor: remoteSelection ? "#e59a3a" : undefined,
  }}
        value={drafts[block.id] ?? block.content}
        readOnly={
  locks.some(
    (lock) =>
      lock.blockId === block.id &&
      lock.userId !== connectionRef.current?.currentUser?.id,
  )
}
        onChange={(event) => {
        const value = event.target.value;

          setDrafts((current) => ({
            ...current,
            [block.id]: value,
          }));
        
        const connection = connectionRef.current;
        if (connection) {
    const updated = {
      ...block,
      content: value,
    };

    connection.sharedBlocks.set(
      block.id,
      JSON.stringify(updated),
    );
  }
}}
onSelect={sendSelectionUpdate}
onClick={sendSelectionUpdate}
onKeyUp={sendSelectionUpdate}

        onKeyDown={(event) => {
          if (event.key === "Escape") {
            connectionRef.current?.releaseBlockLock(block.id);
            setEditingBlockId(null);

            setDrafts((current) => {
              const next = { ...current };
              delete next[block.id];
              return next;
            });

            setLockMessage(null);
          }
        }}
      />

      <div className="editing-controls">
        <button
          type="button"
          onClick={() => commitBlock(block.id)}
        >
          Finish Editing
        </button>
      </div>
    </div>
  );

  if (block.type === "section") {
    return isEditing ? (
      <div key={block.id}>{editor}</div>
    ) : (
      <h3
        className={`document-section editable-block${isLockedByOther ? " block-locked" : ""}`}
        onDoubleClick={() => startEditing(block.id)}
        key={block.id}
      >
        {block.content}
      </h3>
    );
  }

  if (block.type === "heading") {
    return isEditing ? (
      <div key={block.id}>{editor}</div>
    ) : (
      <h4
        className={`document-heading editable-block${isLockedByOther ? " block-locked" : ""}`}
        onDoubleClick={() => startEditing(block.id)}
        key={block.id}
      >
        {block.content}
      </h4>
    );
  }

  if (block.type === "code") {
    return isEditing ? (
      <div key={block.id}>{editor}</div>
    ) : (
      <pre
        className={`document-code editable-block${isLockedByOther ? " block-locked" : ""}`}
        onDoubleClick={() => startEditing(block.id)}
        key={block.id}
      >
        <code>{block.content}</code>
      </pre>
    );
  }

  return isEditing ? (
    <div key={block.id}>{editor}</div>
  ) : (
    <p
      className={`document-paragraph editable-block${isLockedByOther ? " block-locked" : ""}${remoteSelection ? " remote-selected" : ""}`}
      onDoubleClick={() => startEditing(block.id)}
      key={block.id}
    >
      {block.content}
    </p>
  );
})}
          </article>
        </section>
      </div>
    </main>
  );
}

function HomePage() {
  const [order, setOrder] = useState(tiles);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setOrder((current) => {
        const next = [...current];
        const first = next.shift();
        if (first) next.push(first);
        return next;
      });
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <main className="hero">
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-inner">
        <section className="hero-copy" aria-labelledby="hero-title">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            REAL-TIME COLLABORATIVE DOCUMENTS
          </div>
          <h1 id="hero-title">
            Write together.
            <br />
            <em>Sync instantly.</em>
          </h1>
          <p className="hero-description">
            SyncDoc is a collaborative document engine built for real-time
            structured editing, conflict-free synchronization, and seamless
            teamwork.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/documents">
              Start Writing <span aria-hidden="true">?</span>
            </Link>
            <Link className="button button-secondary" to="/about">
              Explore SyncDoc <span aria-hidden="true">?</span>
            </Link>
          </div>
          <div className="hero-note">
            <span className="live-dot" />
            <span>Built for teams that move in sync</span>
          </div>
        </section>
        <section className="visual-wrap" aria-label="SyncDoc collaboration preview">
          <div className="visual-heading">
            <span>SYNC / 01</span>
            <span className="visual-line" />
            <span>16 NODES</span>
          </div>
          <div className="tile-grid">
            {order.map((tile) => (
              <div className="tile" key={tile.id}>
                <img src={tile.src} alt={tile.alt} loading="lazy" />
                <span className="tile-shine" aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="visual-caption">
            <span>EVERY CHANGE, EVERYWHERE</span>
            <span className="caption-arrow">?</span>
          </div>
        </section>
      </div>
    </main>
  );
}

function AppRoutes() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;

