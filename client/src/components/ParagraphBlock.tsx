interface ParagraphBlockProps {
  content: string;
}

function ParagraphBlock({ content }: ParagraphBlockProps) {
  return <p className="paragraph-block">{content}</p>;
}

export default ParagraphBlock;