import * as Y from "yjs";

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

export const deleteYDoc = (documentId: string): void => {
  const document = documents.get(documentId);

  if (!document) {
    return;
  }

  document.destroy();
  documents.delete(documentId);
};
