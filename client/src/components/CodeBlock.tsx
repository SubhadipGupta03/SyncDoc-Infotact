interface CodeBlockProps {
  content: string;
}

function CodeBlock({ content }: CodeBlockProps) {
  return (
    <pre className="code-block">
      <code>{content}</code>
    </pre>
  );
}

export default CodeBlock;