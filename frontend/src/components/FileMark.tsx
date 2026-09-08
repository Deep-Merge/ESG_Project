export default function FileMark({ kind = "docx", size = 36 }: { kind?: string; size?: number }) {
  const pdf = kind.toLowerCase() === "pdf";
  return (
    <span className={`file-mark${pdf ? " pdf" : ""}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" />
        {pdf ? (
          <text x="16" y="21" textAnchor="middle">P</text>
        ) : (
          <path d="M7.8 9h3.2l2.05 8.7L15.2 9h1.7l2.15 8.7L21.1 9h3.1l-3.85 14h-3.05L16 14.2 13.75 23H10.7L7.8 9z" />
        )}
      </svg>
    </span>
  );
}
