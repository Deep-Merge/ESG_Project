export default function Progress({ value }: { value: number }) {
  return (
    <div className="bar" aria-hidden>
      <i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
