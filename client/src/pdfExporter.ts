import jsPDF from "jspdf";

export interface PdfBlock {
  type: "section" | "heading" | "paragraph" | "code";
  content: string;
}

export interface PdfDocument {
  title: string;
  blocks: PdfBlock[];
}

export const exportDocumentToPdf = (
  document: PdfDocument,
): void => {
  const pdf = new jsPDF();

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const marginLeft = 20;
  const marginRight = 20;
  const marginTop = 20;
  const marginBottom = 20;

  const maxWidth =
    pageWidth - marginLeft - marginRight;

  let y = marginTop;

  const addNewPageIfNeeded = (
    requiredHeight: number,
  ): void => {
    if (
      y + requiredHeight >
      pageHeight - marginBottom
    ) {
      pdf.addPage();
      y = marginTop;
    }
  };

  const addText = (
    text: string,
    fontSize: number,
    font: string,
    lineHeight: number,
  ): void => {
    pdf.setFont(font);
    pdf.setFontSize(fontSize);

    const lines = pdf.splitTextToSize(
      text,
      maxWidth,
    );

    for (const line of lines) {
      addNewPageIfNeeded(lineHeight);
      pdf.text(line, marginLeft, y);
      y += lineHeight;
    }

    y += 4;
  };

  pdf.setFont("helvetica");
  pdf.setFontSize(20);

  const titleLines = pdf.splitTextToSize(
    document.title,
    maxWidth,
  );

  for (const line of titleLines) {
    addNewPageIfNeeded(12);
    pdf.text(line, marginLeft, y);
    y += 12;
  }

  y += 8;

  for (const block of document.blocks) {
    if (block.type === "heading") {
      addText(
        block.content,
        15,
        "helvetica",
        9,
      );
    } else if (block.type === "section") {
      addText(
        block.content,
        13,
        "helvetica",
        8,
      );
    } else if (block.type === "code") {
      addText(
        block.content,
        10,
        "courier",
        6,
      );
    } else {
      addText(
        block.content,
        11,
        "helvetica",
        7,
      );
    }
  }

  pdf.save(
    `${document.title || "document"}.pdf`,
  );
};