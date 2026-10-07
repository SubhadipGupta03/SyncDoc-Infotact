const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "/api"
).replace(/\/$/, "");

export type AstNodeType =
  | "section"
  | "heading"
  | "paragraph"
  | "code";

export interface ApiAstNode {
  type: AstNodeType;
  content: string;
  children: ApiAstNode[];
}

export interface ApiDocument {
  _id: string;
  title: string;
  nodes: ApiAstNode[];
  createdAt?: string;
  updatedAt?: string;
}

const isAstNode = (
  value: unknown,
): value is ApiAstNode => {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  if (
    !("type" in value) ||
    !("content" in value) ||
    !("children" in value)
  ) {
    return false;
  }

  if (
    value.type !== "section" &&
    value.type !== "heading" &&
    value.type !== "paragraph" &&
    value.type !== "code"
  ) {
    return false;
  }

  if (
    typeof value.content !== "string" ||
    !Array.isArray(value.children)
  ) {
    return false;
  }

  return value.children.every(
    (child) => isAstNode(child),
  );
};

const isApiDocument = (
  value: unknown,
): value is ApiDocument => {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  if (
    !("_id" in value) ||
    !("title" in value) ||
    !("nodes" in value)
  ) {
    return false;
  }

  if (
    typeof value._id !== "string" ||
    typeof value.title !== "string" ||
    !Array.isArray(value.nodes)
  ) {
    return false;
  }

  return value.nodes.every(
    (node) => isAstNode(node),
  );
};

export const fetchDocuments =
  async (): Promise<ApiDocument[]> => {
    const response = await fetch(
      `${API_BASE_URL}/documents`,
    );
    

    if (!response.ok) {
      throw new Error(
        `Failed to load documents: ${response.status}`,
      );
    }

    const data: unknown =
      await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        "Invalid documents API response.",
      );
    }

    if (
      !data.every(
        (document) =>
          isApiDocument(document),
      )
    ) {
      throw new Error(
        "Invalid document structure received from API.",
      );
    }

    return data;
  };

export const createDocument = async (
  title: string,
): Promise<ApiDocument> => {
  const response = await fetch(
    `${API_BASE_URL}/documents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        nodes: [
  {
    type: "paragraph",
    content:
      "This document demonstrates collaborative block editing.",
  },
  {
    type: "paragraph",
    content:
      "AST conflict resolution preserves structural changes.",
  },
  {
    type: "paragraph",
    content:
      "Real-time synchronization uses Yjs.",
  },
],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to create document: ${response.status}`,
    );
  }

  const data: unknown = await response.json();

  if (!isApiDocument(data)) {
    throw new Error(
      "Invalid document structure received from API.",
    );
  }

  return data;
};
  export interface EditorBlock {
  id: string;
  type: AstNodeType;
  content: string;
}

const flattenAstNodes = (
  nodes: ApiAstNode[],
  path = "node",
): EditorBlock[] => {
  const blocks: EditorBlock[] = [];

  nodes.forEach((node, index) => {
    const currentPath =
      `${path}-${index}`;

    blocks.push({
      id: currentPath,
      type: node.type,
      content: node.content,
    });

    if (node.children.length > 0) {
      blocks.push(
        ...flattenAstNodes(
          node.children,
          currentPath,
        ),
      );
    }
  });

  return blocks;
};

export const deleteDocument = async (
  id: string,
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/documents/${id}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to delete document: ${response.status}`,
    );
  }
};


export const adaptApiDocument = (
  document: ApiDocument,
): {
  title: string;
  meta: string;
  blocks: EditorBlock[];
} => ({
  title: document.title,
  meta: document.updatedAt
    ? `Updated ${new Date(
        document.updatedAt,
      ).toLocaleString()}`
    : "MongoDB document",
  blocks: flattenAstNodes(
    document.nodes,
  ),
});