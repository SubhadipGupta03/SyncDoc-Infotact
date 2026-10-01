# SyncDoc — Week 3 Transformation Design

## AST to PDF Transformation

SyncDoc currently represents documents using an AST structure.

Supported node types:

- heading
- paragraph
- code
- section

Each AST node contains:

- type
- content
- children

The Week 3 Transformation Engine will traverse the AST and convert
each node into a structure suitable for PDF export.

## Node Mapping

| AST Node | PDF Representation |
|----------|--------------------|
| heading | PDF heading/title |
| paragraph | PDF paragraph/text |
| code | PDF code block/text |
| section | PDF section containing child nodes |

## Transformation Flow

AST
→ Traverse nodes
→ Identify node type
→ Transform node content
→ Process child nodes recursively
→ Build PDF output structure

## Important Requirement

The transformation must preserve the order and hierarchy of the
original AST.

## Current Status

Week 3 Day 1 — Design stage.