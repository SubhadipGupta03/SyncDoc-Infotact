import { useState } from "react";
import ParagraphBlock from "./components/ParagraphBlock";
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
              <span className="document-meta">No content yet</span>
            </button>
          </div>
        </aside>

        <section className="document-viewer">
          <div className="document-viewer-header">
            <span className="document-status">Document</span>
          </div>

          <div className="document-content">
            <h2>{selectedDocument}</h2>

            <ParagraphBlock content="This is the first paragraph block in SyncDoc." />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;