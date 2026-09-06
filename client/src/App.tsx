import { useState } from "react";
import CodeBlock from "./components/CodeBlock";
import HeadingBlock from "./components/HeadingBlock";
import ParagraphBlock from "./components/ParagraphBlock";
import SectionBlock from "./components/SectionBlock";
import "./App.css";

function App() {
  const [selectedDocument, setSelectedDocument] =
    useState("Untitled Document");

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
            <button
              type="button"
              className={`document-item ${
                selectedDocument === "Untitled Document" ? "active" : ""
              }`}
              onClick={() => setSelectedDocument("Untitled Document")}
            >
              <span className="document-title">Untitled Document</span>
              <span className="document-meta">Sample document</span>
            </button>
          </div>
        </aside>

        <section className="document-viewer">
          <div className="document-viewer-header">
            <span className="document-status">Document</span>
          </div>

          <div className="document-content">
            <h2>{selectedDocument}</h2>

            <SectionBlock content="Introduction" />

            <HeadingBlock content="SyncDoc Editor Foundations" />

            <ParagraphBlock content="This is the first paragraph block in SyncDoc." />

            <CodeBlock content={`const document = "SyncDoc";`} />

            <SectionBlock content="Document Structure" />

            <ParagraphBlock content="SyncDoc represents documents as structured blocks that can later be connected to the AST model." />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;