export default function SectionHeading({
  number,
  english,
  title,
  children,
}: {
  number: string;
  english: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">
          <span className="section-number">{number}</span> / {title}
        </p>
        <h2>
          {english}
          <span className="accent">.</span>
        </h2>
      </div>
      {children && <div className="section-aside">{children}</div>}
    </div>
  );
}
