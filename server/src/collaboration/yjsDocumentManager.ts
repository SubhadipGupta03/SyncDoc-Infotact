import * as Y from "yjs";
import YjsDocumentModel from "../models/yjsDocument.js";

const documents = new Map<string, Y.Doc>();

export const getYDoc = (documentId: string): Y.Doc => {
  const existingDocument = documents.get(documentId);

  if (existingDocument) {
    return existingDocument;
  }

  const document = new Y.Doc();

  documents.set(documentId, document);

  return document;
};

export const loadYDocFromDatabase = async (
  documentId: string,
  document: Y.Doc,
): Promise<void> => {
  const savedDocument =
    await YjsDocumentModel.findOne({
      documentId,
    });

  if (!savedDocument?.state) {
    console.log(
      `[SyncDoc] No persisted Yjs state found for document: ${documentId}`,
    );
    return;
  }

const stateBytes = new Uint8Array(
  savedDocument.state,
);



  Y.applyUpdate(
    document,
    new Uint8Array(savedDocument.state),
    "mongo-load",
  );

  console.log(
    `[SyncDoc] Loaded persisted Yjs state for document: ${documentId}`,
  );
};

export const deleteYDoc = (documentId: string): void => {
  const document = documents.get(documentId);

  if (!document) {
    return;
  }

  document.destroy();
  documents.delete(documentId);
};