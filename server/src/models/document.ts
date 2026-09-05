import { Schema, model } from "mongoose";

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

interface SyncDocument {
  title: string;
  nodes: AstNode[];
  createdAt?: Date;
  updatedAt?: Date;
}

const nodeSchema = new Schema<AstNode>(
  {
    type: {
      type: String,
      required: true,
      enum: ["heading", "paragraph", "code", "section"],
    },

    content: {
      type: String,
      required: true,
      default: "",
    },
  },
  {
    _id: true,
    versionKey: false,
  },
);

nodeSchema.add({
  children: {
    type: [nodeSchema],
    default: [],
  },
});

const documentSchema = new Schema<SyncDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    nodes: {
      type: [nodeSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const traceBlockRelationships = (
  node: AstNode,
  path: string,
): void => {
  console.log(
    `Tracing AST block: ${path} (${node.type})`,
  );

  if (node.children.length === 0) {
    console.log(`Leaf block reached: ${path}`);
    return;
  }

  for (const [index, child] of node.children.entries()) {
    const childPath = `${path}.children[${index}]`;

    console.log(
      `Relationship: ${path} -> ${childPath}`,
    );

    traceBlockRelationships(child, childPath);
  }
};

documentSchema.pre("save", function () {
  for (const [index, node] of this.nodes.entries()) {
    traceBlockRelationships(
      node,
      `nodes[${index}]`,
    );
  }
});

const SyncDocumentModel = model<SyncDocument>(
  "SyncDocument",
  documentSchema,
);

export default SyncDocumentModel;