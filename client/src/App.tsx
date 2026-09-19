import {
  useEffect,
  useRef,
  useState,
} from "react";
import CodeBlock from "./components/CodeBlock";
import HeadingBlock from "./components/HeadingBlock";
import ParagraphBlock from "./components/ParagraphBlock";
import SectionBlock from "./components/SectionBlock";
import {
  connectToDocument,
  type BlockLock,
  type PresenceUser,
} from "./collaboration/yjsClient";
import "./App.css";

type BlockType =
  | "section"
  | "heading"
  | "paragraph"
  | "code";

type Block = {
  id: string;
  type: BlockType;
  content: string;
};

interface DocumentData {
  title: string;
  meta: string;
  blocks: Block[];
}

const createBlock = (
  id: string,
  type: BlockType,
  content: string,
): Block => ({
  id,
  type,
  content,
});

const documents: DocumentData[] = [
  {
    title: "Untitled Document",
    meta: "Sample document",
    blocks: [
      createBlock(
        "untitled-section-1",
        "section",
        "Introduction",
      ),
      createBlock(
        "untitled-heading-1",
        "heading",
        "SyncDoc Editor Foundations",
      ),
      createBlock(
        "untitled-paragraph-1",
        "paragraph",
        "This is the first paragraph block in SyncDoc.",
      ),
      createBlock(
        "untitled-code-1",
        "code",
        'const document = "SyncDoc";',
      ),
      createBlock(
        "untitled-section-2",
        "section",
        "Document Structure",
      ),
      createBlock(
        "untitled-paragraph-2",
        "paragraph",
        "SyncDoc represents documents as structured blocks that can later be connected to the AST model.",
      ),
    ],
  },
  {
    title: "AST Architecture",
    meta: "Structure overview",
    blocks: [
      createBlock(
        "ast-section-1",
        "section",
        "AST Modeling",
      ),
      createBlock(
        "ast-heading-1",
        "heading",
        "Nested Document Nodes",
      ),
      createBlock(
        "ast-paragraph-1",
        "paragraph",
        "Documents are represented as nested structural nodes with support for sections, headings, paragraphs, and code blocks.",
      ),
      createBlock(
        "ast-code-1",
        "code",
        'type AstNodeType = "heading" | "paragraph" | "code" | "section";',
      ),
    ],
  },
  {
    title: "SyncDoc Notes",
    meta: "Project notes",
    blocks: [
      createBlock(
        "notes-section-1",
        "section",
        "Project Notes",
      ),
      createBlock(
        "notes-heading-1",
        "heading",
        "Block-Level Rendering",
      ),
      createBlock(
        "notes-paragraph-1",
        "paragraph",
        "Each document block is rendered through a dedicated React component to keep the editor foundation modular.",
      ),
    ],
  },
];

const isDocumentData = (
  value: unknown,
): value is DocumentData => {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  if (
    !("title" in value) ||
    !("meta" in value) ||
    !("blocks" in value)
  ) {
    return false;
  }

  if (
    typeof value.title !== "string" ||
    typeof value.meta !== "string" ||
    !Array.isArray(value.blocks)
  ) {
    return false;
  }

  return value.blocks.every(
    (block) =>
      typeof block === "object" &&
      block !== null &&
      "id" in block &&
      "type" in block &&
      "content" in block &&
      typeof block.id === "string" &&
      typeof block.type === "string" &&
      typeof block.content === "string",
  );
};

const parseBlock = (
  value: string,
): Block | null => {
  try {
    const parsed: unknown =
      JSON.parse(value);

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      return null;
    }

    if (
      !("id" in parsed) ||
      !("type" in parsed) ||
      !("content" in parsed)
    ) {
      return null;
    }

    if (
      typeof parsed.id !== "string" ||
      typeof parsed.type !== "string" ||
      typeof parsed.content !== "string"
    ) {
      return null;
    }

    if (
      parsed.type !== "section" &&
      parsed.type !== "heading" &&
      parsed.type !== "paragraph" &&
      parsed.type !== "code"
    ) {
      return null;
    }

    return {
      id: parsed.id,
      type: parsed.type,
      content: parsed.content,
    };
  } catch {
    return null;
  }
};

function App() {
  const [selectedDocument, setSelectedDocument] =
    useState<DocumentData>(
      documents[0],
    );

  const [presenceUsers, setPresenceUsers] =
    useState<PresenceUser[]>([]);

  const [blockLocks, setBlockLocks] =
    useState<BlockLock[]>([]);

  const [editingBlockId, setEditingBlockId] =
    useState<string | null>(null);

  const [localDrafts, setLocalDrafts] =
    useState<Record<string, string>>({});

  const [lockMessage, setLockMessage] =
    useState<string | null>(null);

  const collaborationRef =
    useRef<
      ReturnType<typeof connectToDocument> | null
    >(null);

  const localDraftsRef =
    useRef<Record<string, string>>({});

  const editingBlockIdRef =
    useRef<string | null>(null);

  useEffect(() => {
    localDraftsRef.current =
      localDrafts;
  }, [localDrafts]);

  useEffect(() => {
    editingBlockIdRef.current =
      editingBlockId;
  }, [editingBlockId]);

  useEffect(() => {
    const collaboration =
      connectToDocument(
        selectedDocument.title,
      );

    collaborationRef.current =
      collaboration;

    const sharedContent =
      collaboration.sharedContent;

    const sharedBlocks =
      collaboration.sharedBlocks;

    const unsubscribePresence =
      collaboration.onPresenceChange(
        (users) => {
          setPresenceUsers(users);
        },
      );

    const unsubscribeLocks =
      collaboration.onBlockLockChange(
        (locks) => {
          setBlockLocks(locks);
        },
      );

    const unsubscribeLockDenied =
      collaboration.onBlockLockDenied(
        (blockId, owner) => {
          if (
            editingBlockIdRef.current ===
            blockId
          ) {
            setEditingBlockId(null);

            editingBlockIdRef.current =
              null;
          }

          setLockMessage(
            `${owner.userName} is currently editing this block.`,
          );
        },
      );

    /*
     * Keep the original document-level
     * shared content for compatibility.
     */
    const storedDocument =
      sharedContent.get("document");

    if (!storedDocument) {
      sharedContent.set(
        "document",
        JSON.stringify(
          selectedDocument,
        ),
      );
    }

    /*
     * Initialize individual Yjs block entries.
     *
     * Every block is stored independently,
     * allowing incoming network deltas to affect
     * only the block that actually changed.
     */
    if (sharedBlocks.size === 0) {
      for (
        const block of selectedDocument.blocks
      ) {
        sharedBlocks.set(
          block.id,
          JSON.stringify(block),
        );
      }
    }

    /*
     * Read any blocks already present in the
     * collaborative Yjs document.
     */
    const loadSharedBlocks = (): void => {
      const remoteBlocks: Block[] = [];

      for (
        const block of selectedDocument.blocks
      ) {
        const sharedBlock =
          sharedBlocks.get(block.id);

        if (!sharedBlock) {
          remoteBlocks.push(block);
          continue;
        }

        const parsedBlock =
          parseBlock(sharedBlock);

        if (parsedBlock) {
          remoteBlocks.push(
            parsedBlock,
          );
        } else {
          remoteBlocks.push(block);
        }
      }

      setSelectedDocument(
        (currentDocument) => ({
          ...currentDocument,
          blocks: remoteBlocks,
        }),
      );
    };

    loadSharedBlocks();

    const handleSharedBlockChange =
      (): void => {
        /*
         * Do not replace the block currently
         * being edited from an incoming network
         * delta. The local draft remains visible.
         */
        const activeBlockId =
          editingBlockIdRef.current;

        setSelectedDocument(
          (currentDocument) => {
            const updatedBlocks =
              currentDocument.blocks.map(
                (block) => {
                  if (
                    block.id ===
                    activeBlockId
                  ) {
                    return block;
                  }

                  const sharedBlock =
                    sharedBlocks.get(
                      block.id,
                    );

                  if (!sharedBlock) {
                    return block;
                  }

                  const parsedBlock =
                    parseBlock(
                      sharedBlock,
                    );

                  return (
                    parsedBlock ??
                    block
                  );
                },
              );

            return {
              ...currentDocument,
              blocks: updatedBlocks,
            };
          },
        );
      };

    sharedBlocks.observe(
      handleSharedBlockChange,
    );

    const handleSharedContentChange =
      (): void => {
        const updatedDocument =
          sharedContent.get(
            "document",
          );

        if (!updatedDocument) {
          return;
        }

        try {
          const parsedDocument: unknown =
            JSON.parse(
              updatedDocument,
            );

          if (
            isDocumentData(
              parsedDocument,
            )
          ) {
            setSelectedDocument(
              (currentDocument) => ({
                ...currentDocument,
                title:
                  parsedDocument.title,
                meta:
                  parsedDocument.meta,
              }),
            );
          }
        } catch {
          console.error(
            "SyncDoc received invalid shared document data.",
          );
        }
      };

    sharedContent.observe(
      handleSharedContentChange,
    );

    return () => {
      unsubscribePresence();
      unsubscribeLocks();
      unsubscribeLockDenied();

      sharedBlocks.unobserve(
        handleSharedBlockChange,
      );

      sharedContent.unobserve(
        handleSharedContentChange,
      );

      collaboration.disconnect();

      collaborationRef.current =
        null;

      setBlockLocks([]);
      setEditingBlockId(null);
      setLocalDrafts({});
      setLockMessage(null);
    };
  }, [selectedDocument.title]);

  const getBlockLock = (
    blockId: string,
  ): BlockLock | undefined => {
    return blockLocks.find(
      (lock) =>
        lock.blockId === blockId,
    );
  };

  const isOwnLock = (
    blockId: string,
  ): boolean => {
    const lock =
      getBlockLock(blockId);

    const currentUser =
      collaborationRef.current
        ?.currentUser;

    return Boolean(
      lock &&
        currentUser &&
        lock.userId ===
          currentUser.id,
    );
  };

  const startEditing = (
    block: Block,
  ): void => {
    const existingLock =
      getBlockLock(block.id);

    const currentUser =
      collaborationRef.current
        ?.currentUser;

    if (
      existingLock &&
      (!currentUser ||
        existingLock.userId !==
          currentUser.id)
    ) {
      setLockMessage(
        `${existingLock.userName} is currently editing this block.`,
      );

      return;
    }

    setLockMessage(null);

    setLocalDrafts(
      (currentDrafts) => ({
        ...currentDrafts,
        [block.id]: block.content,
      }),
    );

    localDraftsRef.current = {
      ...localDraftsRef.current,
      [block.id]: block.content,
    };

    setEditingBlockId(block.id);

    editingBlockIdRef.current =
      block.id;

    collaborationRef.current?.requestBlockLock(
      block.id,
    );
  };

  const updateLocalDraft = (
    blockId: string,
    content: string,
  ): void => {
    if (
      !isOwnLock(blockId)
    ) {
      return;
    }

    setLocalDrafts(
      (currentDrafts) => {
        const updatedDrafts = {
          ...currentDrafts,
          [blockId]: content,
        };

        localDraftsRef.current =
          updatedDrafts;

        return updatedDrafts;
      },
    );

    setSelectedDocument(
      (currentDocument) => ({
        ...currentDocument,
        blocks:
          currentDocument.blocks.map(
            (block) =>
              block.id === blockId
                ? {
                    ...block,
                    content,
                  }
                : block,
          ),
      }),
    );

    /*
     * Send only this block through Yjs.
     * Other blocks remain untouched.
     */
    const sharedBlocks =
      collaborationRef.current
        ?.sharedBlocks;

    if (!sharedBlocks) {
      return;
    }

    const currentBlock =
      selectedDocument.blocks.find(
        (block) =>
          block.id === blockId,
      );

    if (!currentBlock) {
      return;
    }

    const updatedBlock: Block = {
      ...currentBlock,
      content,
    };

    sharedBlocks.set(
      blockId,
      JSON.stringify(
        updatedBlock,
      ),
    );
  };

  const finishEditing = (
    blockId: string,
  ): void => {
    if (
      !isOwnLock(blockId)
    ) {
      return;
    }

    const sharedBlocks =
      collaborationRef.current
        ?.sharedBlocks;

    const draft =
      localDraftsRef.current[
        blockId
      ];

    const currentBlock =
      selectedDocument.blocks.find(
        (block) =>
          block.id === blockId,
      );

    /*
     * Commit the final local value before
     * releasing the block lock.
     */
    if (
      sharedBlocks &&
      currentBlock &&
      typeof draft === "string"
    ) {
      const updatedBlock: Block = {
        ...currentBlock,
        content: draft,
      };

      sharedBlocks.set(
        blockId,
        JSON.stringify(
          updatedBlock,
        ),
      );
    }

    collaborationRef.current?.releaseBlockLock(
      blockId,
    );

    setEditingBlockId(null);

    editingBlockIdRef.current =
      null;

    setLocalDrafts(
      (currentDrafts) => {
        const nextDrafts = {
          ...currentDrafts,
        };

        delete nextDrafts[
          blockId
        ];

        localDraftsRef.current =
          nextDrafts;

        return nextDrafts;
      },
    );
  };

  const renderBlock = (
    block: Block,
  ) => {
    const lock =
      getBlockLock(block.id);

    const currentUser =
      collaborationRef.current
        ?.currentUser;

    const lockedByOther =
      Boolean(
        lock &&
          (!currentUser ||
            lock.userId !==
              currentUser.id),
      );

    const currentlyEditing =
      editingBlockId === block.id;

    const displayContent =
      currentlyEditing &&
      block.id in localDrafts
        ? localDrafts[block.id]
        : block.content;

    const beginEditing = (): void => {
      startEditing(block);
    };

    const handleInput = (
      event: React.ChangeEvent<
        HTMLTextAreaElement
      >,
    ): void => {
      updateLocalDraft(
        block.id,
        event.target.value,
      );
    };

    return (
      <div
        style={{
          position: "relative",
          marginBottom: "14px",
          borderRadius: "8px",
          border: currentlyEditing
            ? "1px solid #2563eb"
            : lockedByOther
              ? "1px solid #f59e0b"
              : "1px solid transparent",
          padding: currentlyEditing
            ? "8px"
            : "4px",
          transition:
            "border-color 0.15s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "8px",
            marginBottom:
              lockedByOther ||
              currentlyEditing
                ? "6px"
                : "0",
            minHeight:
              lockedByOther ||
              currentlyEditing
                ? "20px"
                : "0",
          }}
        >
          {lockedByOther && (
            <span
              style={{
                fontSize: "11px",
                color: "#92400e",
                fontWeight: 600,
              }}
            >
              🔒 {lock?.userName} is
              editing
            </span>
          )}

          {currentlyEditing && (
            <span
              style={{
                fontSize: "11px",
                color: "#1d4ed8",
                fontWeight: 600,
              }}
            >
              🔓 You are editing
            </span>
          )}
        </div>

        {currentlyEditing ? (
          <>
            <textarea
              value={displayContent}
              onChange={handleInput}
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Escape"
                ) {
                  event.preventDefault();
                  finishEditing(
                    block.id,
                  );
                }
              }}
              autoFocus
              rows={
                block.type === "code"
                  ? 5
                  : 2
              }
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                resize: "vertical",
                border:
                  "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "10px",
                fontFamily:
                  block.type === "code"
                    ? "monospace"
                    : "inherit",
                fontSize:
                  block.type === "code"
                    ? "13px"
                    : "15px",
                lineHeight: 1.5,
                outline: "none",
                background:
                  block.type === "code"
                    ? "#f8fafc"
                    : "white",
              }}
              aria-label={`Edit ${block.type} block`}
            />

            <button
              type="button"
              onMouseDown={(
                event,
              ) => {
                /*
                 * Keep the textarea from
                 * losing focus before the
                 * click handler releases
                 * the lock.
                 */
                event.preventDefault();
              }}
              onClick={() => {
                finishEditing(
                  block.id,
                );
              }}
              style={{
                marginTop: "8px",
                padding: "6px 10px",
                border:
                  "1px solid #cbd5e1",
                borderRadius: "6px",
                background: "#f8fafc",
                color: "#334155",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Finish editing
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={
              lockedByOther
                ? undefined
                : beginEditing
            }
            disabled={
              lockedByOther
            }
            style={{
              display: "block",
              width: "100%",
              padding: "0",
              margin: "0",
              border: "none",
              background:
                "transparent",
              textAlign: "left",
              cursor: lockedByOther
                ? "not-allowed"
                : "text",
              opacity:
                lockedByOther
                  ? 0.75
                  : 1,
            }}
            aria-label={
              lockedByOther
                ? `${block.type} block locked by ${lock?.userName}`
                : `Edit ${block.type} block`
            }
          >
            {block.type ===
              "section" && (
              <SectionBlock
                content={
                  displayContent
                }
              />
            )}

            {block.type ===
              "heading" && (
              <HeadingBlock
                content={
                  displayContent
                }
              />
            )}

            {block.type ===
              "paragraph" && (
              <ParagraphBlock
                content={
                  displayContent
                }
              />
            )}

            {block.type === "code" && (
              <CodeBlock
                content={
                  displayContent
                }
              />
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="syncdoc-app">
      <header className="app-header">
        <div>
          <h1>SyncDoc</h1>
          <p>
            Collaborative Document Engine
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            justifyContent:
              "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              color: "#166534",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius:
                  "50%",
                backgroundColor:
                  "#22c55e",
              }}
            />

            {presenceUsers.length}{" "}
            online
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            aria-label="Connected users"
          >
            {presenceUsers
              .slice(0, 5)
              .map((user) => (
                <span
                  key={user.id}
                  title={user.name}
                  style={{
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    width: "28px",
                    height: "28px",
                    borderRadius:
                      "50%",
                    backgroundColor:
                      "#dbeafe",
                    color:
                      "#1e40af",
                    fontSize: "11px",
                    fontWeight: 700,
                    border:
                      "2px solid white",
                  }}
                >
                  {user.name
                    .replace(
                      "User ",
                      "",
                    )
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              ))}

            {presenceUsers.length >
              5 && (
              <span
                style={{
                  fontSize:
                    "12px",
                  color:
                    "#64748b",
                  marginLeft:
                    "4px",
                }}
              >
                +
                {presenceUsers.length -
                  5}
              </span>
            )}
          </div>

          {lockMessage && (
            <span
              style={{
                fontSize: "12px",
                color: "#92400e",
                fontWeight: 600,
              }}
            >
              {lockMessage}
            </span>
          )}
        </div>
      </header>

      <main className="app-layout">
        <aside className="document-sidebar">
          <div className="sidebar-header">
            <h2>Documents</h2>
          </div>

          <div className="document-list">
            {documents.map(
              (document) => (
                <button
                  key={
                    document.title
                  }
                  type="button"
                  className={`document-item ${
                    selectedDocument.title ===
                    document.title
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setEditingBlockId(
                      null,
                    );
                    setLocalDrafts(
                      {},
                    );
                    setLockMessage(
                      null,
                    );
                    setSelectedDocument(
                      document,
                    );
                  }}
                >
                  <span className="document-title">
                    {
                      document.title
                    }
                  </span>

                  <span className="document-meta">
                    {
                      document.meta
                    }
                  </span>
                </button>
              ),
            )}
          </div>
        </aside>

        <section className="document-viewer">
          <div className="document-viewer-header">
            <span className="document-status">
              Document
            </span>

            <span
              style={{
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              {blockLocks.length}{" "}
              block
              {blockLocks.length ===
              1
                ? ""
                : "s"}{" "}
              locked
            </span>
          </div>

          <div className="document-content">
            <h2>
              {selectedDocument.title}
            </h2>

            {selectedDocument.blocks.map(
              (block) => (
                <div
                  key={block.id}
                >
                  {renderBlock(
                    block,
                  )}
                </div>
              ),
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;