import PDFDocument from "pdfkit";
import type { Response } from "express";

type AstNodeType =
  | "heading"
  | "paragraph"
  | "code"
  | "section";

export interface AstNode {
  type: AstNodeType;
  content: string;
  children: AstNode[];
}

export interface PdfDocumentInput {
  title: string;
  nodes: AstNode[];
}

const writeNode = (
  pdf: PDFKit.PDFDocument,
  node: AstNode,
): void => {
  switch (node.type) {
    case "heading":
      pdf
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(node.content, {
          paragraphGap: 8,
        });
      break;

    case "section":
      pdf
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(node.content, {
          paragraphGap: 6,
        });
      break;

    case "paragraph":
      pdf
        .font("Helvetica")
        .fontSize(11)
        .text(node.content, {
          paragraphGap: 6,
        });
      break;

    case "code":
      pdf
        .font("Courier")
        .fontSize(9)
        .text(node.content, {
          paragraphGap: 8,
        });
      break;
  }

  for (const child of node.children) {
    writeNode(pdf, child);
  }
};

export const transformAstToPdf = (
  document: PdfDocumentInput,
  response: Response,
): void => {
  const pdf = new PDFDocument({
    size: "A4",
    margin: 50,
    bufferPages: true,
  });

  response.setHeader(
    "Content-Type",
    "application/pdf",
  );

  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${document.title || "document"}.pdf"`,
  );

  pdf.pipe(response);

  pdf
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(document.title || "Untitled Document", {
      paragraphGap: 16,
    });

  for (const node of document.nodes) {
    writeNode(pdf, node);
  }

  pdf.end();
};