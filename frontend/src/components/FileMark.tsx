export default function FileMark({ kind = "docx", size = 40 }: { kind?: string; size?: number }) {
  const pdf = kind.toLowerCase() === "pdf";
  return (
    <span className={`file-mark${pdf ? " pdf" : ""}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 40 40">
        <rect className="file-mark-tile" width="40" height="40" rx="10" />
        <path className="file-mark-page" d="M13 9.5h11.2L27 13.4V30.5H13z" />
        <path className="file-mark-fold" d="M24.2 9.5v3.9H28" />
        {pdf ? (
          <text x="20" y="25.2" textAnchor="middle">P</text>
        ) : (
          <path
            className="file-mark-letter"
            d="M15.2 26.6 17.3 17h1.85l1.42 6.05L22 17h1.8l2.15 9.6h-1.72l-1.28-6.15-1.5 6.15h-1.62l-1.48-6.15-1.28 6.15z"
          />
        )}
      </svg>
    </span>
  );
}
