import { sanitizeHtml } from "../security/sanitize";

type AstNodeType =
  | "heading"
  | "paragraph"
  | "code"
  | "section";

export interface HtmlAstNode {
  type: AstNodeType;
  content: string;
  children: HtmlAstNode[];
}

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const transformNode = (node: HtmlAstNode): string => {
  const content = escapeHtml(node.content);

  let html = "";

  switch (node.type) {
    case "heading":
      html = `<h2>${content}</h2>`;
      break;

    case "section":
      html = `<section><h3>${content}</h3>`;
      for (const child of node.children) {
        html += transformNode(child);
      }
      html += "</section>";
      return html;

    case "paragraph":
      html = `<p>${content}</p>`;
      break;

    case "code":
      html = `<pre><code>${content}</code></pre>`;
      break;
  }

  for (const child of node.children) {
    html += transformNode(child);
  }

  return html;
};

export const transformAstToHtml = (
  nodes: HtmlAstNode[],
): string => {
  const html = nodes
    .map((node) => transformNode(node))
    .join("");

  return sanitizeHtml(html);
};

