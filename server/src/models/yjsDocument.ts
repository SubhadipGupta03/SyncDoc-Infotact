import { Schema, model } from "mongoose";

interface YjsDocument {
  documentId: string;
  state: Buffer;
  updatedAt?: Date;
}

const yjsDocumentSchema = new Schema<YjsDocument>(
  {
    documentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    state: {
      type: Buffer,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const YjsDocumentModel = model<YjsDocument>(
  "YjsDocument",
  yjsDocumentSchema,
);

export default YjsDocumentModel;