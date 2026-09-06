interface HeadingBlockProps {
  content: string;
}

function HeadingBlock({ content }: HeadingBlockProps) {
  return <h3 className="heading-block">{content}</h3>;
}

export default HeadingBlock;