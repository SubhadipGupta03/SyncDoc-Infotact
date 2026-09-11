import { useState } from "react";
import CodeBlock from "./components/CodeBlock";
import HeadingBlock from "./components/HeadingBlock";
import ParagraphBlock from "./components/ParagraphBlock";
import SectionBlock from "./components/SectionBlock";
import "./App.css";

type Block =
  | { type: "section"; content: string }
  | { type: "heading"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "code"; content: string };

interface DocumentData {
  title: string;
  meta: string;
  blocks: Block[];
}

const documents: DocumentData[] = [
  {
    title: "Untitled Document",
    meta: "Sample document",
    blocks: [
      { type: "section", content: "Introduction" },
      { type: "heading", content: "SyncDoc Editor Foundations" },
      {
        type: "paragraph",
        content: "This is the first paragraph block in SyncDoc.",
      },
      { type: "code", content: 'const document = "SyncDoc";' },
      { type: "section", content: "Document Structure" },
      {
        type: "paragraph",
        content:
          "SyncDoc represents documents as structured blocks that can later be connected to the AST model.",
      },
    ],
  },
  {
    title: "AST Architecture",
    meta: "Structure overview",
    blocks: [
      { type: "section", content: "AST Modeling" },
      { type: "heading", content: "Nested Document Nodes" },
      {
        type: "paragraph",
        content:
          "Documents are represented as nested structural nodes with support for sections, headings, paragraphs, and code blocks.",
      },
      {
        type: "code",
        content:
          'type AstNodeType = "heading" | "paragraph" | "code" | "section";',
      },
    ],
  },
  {
    title: "SyncDoc Notes",
    meta: "Project notes",
    blocks: [
      { type: "section", content: "Project Notes" },
      { type: "heading", content: "Block-Level Rendering" },
      {
        type: "paragraph",
        content:
          "Each document block is rendered through a dedicated React component to keep the editor foundation modular.",
      },
    ],
  },
];

function renderBlock(block: Block) {
  switch (block.type) {
    case "section":
      return <SectionBlock content={block.content} />;
    case "heading":
      return <HeadingBlock content={block.content} />;
    case "paragraph":
      return <ParagraphBlock content={block.content} />;
    case "code":
      return <CodeBlock content={block.content} />;
  }
}

function App() {
  const [selectedDocument, setSelectedDocument] = useState(documents[0]);

  return (
    <div className="syncdoc-app">
      <header className="app-header">
        <div>
          <h1>SyncDoc</h1>
          <p>Collaborative Document Engine</p>
        </div>
      </header>

      <main className="app-layout">
        <aside className="document-sidebar">
          <div className="sidebar-header">
            <h2>Documents</h2>
          </div>

          <div className="document-list">
            {documents.map((document) => (
              <button
                key={document.title}
                type="button"
                className={`document-item ${
                  selectedDocument.title === document.title ? "active" : ""
                }`}
                onClick={() => setSelectedDocument(document)}
              >
                <span className="document-title">{document.title}</span>
                <span className="document-meta">{document.meta}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="document-viewer">
          <div className="document-viewer-header">
            <span className="document-status">Document</span>
          </div>

          <div className="document-content">
            <h2>{selectedDocument.title}</h2>

            {selectedDocument.blocks.map((block, index) => (
              <div key={`${selectedDocument.title}-${block.type}-${index}`}>
                {renderBlock(block)}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
