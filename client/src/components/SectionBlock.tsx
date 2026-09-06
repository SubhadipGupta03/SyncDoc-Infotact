interface SectionBlockProps {
  content: string;
}

function SectionBlock({ content }: SectionBlockProps) {
  return (
    <section className="section-block">
      <h3 className="section-block-title">{content}</h3>
    </section>
  );
}

export default SectionBlock;