export default function Status({ value }: { value: string }) {
  const label = value.replaceAll("_", " ");
  return <span className={`status ${value}`}>{label}</span>;
}
