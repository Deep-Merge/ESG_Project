import { statusLabel } from "../lib/format";

export default function Status({ value }: { value: string }) {
  return <span className={`status ${value}`}><i />{statusLabel(value)}</span>;
}
