import { Upload } from "lucide-react";
import { useRef, useState } from "react";

type FileFieldProps = {
  accept?: string;
  disabled?: boolean;
  onChange: (file: File | undefined) => void;
};

export default function FileField({ accept, disabled, onChange }: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");

  return (
    <div className="file-field">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          setName(file?.name || "");
          onChange(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="btn ghost"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={15} strokeWidth={1.6} />
        Choose file
      </button>
      <span className={name ? "file-name" : "file-name empty"}>{name || "No file chosen"}</span>
    </div>
  );
}
