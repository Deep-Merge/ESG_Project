import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

type FoldProps = {
  id: string;
  title: string;
  extra?: ReactNode;
  children: ReactNode;
  open?: boolean;
};

export default function Fold({ id, title, extra, children, open = true }: FoldProps) {
  const [on, setOn] = useState(() => {
    const saved = localStorage.getItem(`esg-fold-${id}`);
    return saved == null ? open : saved === "1";
  });

  return (
    <section className={`fold${on ? "" : " off"}`}>
      <div className="fold-head">
        <button
          type="button"
          className="fold-toggle"
          aria-expanded={on}
          onClick={() => {
            const next = !on;
            setOn(next);
            localStorage.setItem(`esg-fold-${id}`, next ? "1" : "0");
          }}
        >
          <ChevronDown size={16} strokeWidth={1.6} />
          <h2>{title}</h2>
        </button>
        {extra}
      </div>
      <div className="fold-body">
        <div>{children}</div>
      </div>
    </section>
  );
}
