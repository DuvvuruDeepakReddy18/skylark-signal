"use client";

import { ArrowUp, Command, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ComposerProps {
  onSubmit: (message: string) => void;
  disabled: boolean;
  compact?: boolean;
}

export function Composer({ onSubmit, disabled, compact = false }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const submit = () => {
    const message = value.trim();
    if (!message || disabled) return;
    onSubmit(message);
    setValue("");
  };

  return (
    <div className={`composer ${compact ? "compact" : ""}`}>
      <div className="composer-icon"><Sparkles size={17} /></div>
      <textarea
        ref={textareaRef}
        rows={compact ? 1 : 2}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Ask a founder-level business question…"
        aria-label="Ask a business question"
        disabled={disabled}
      />
      {!compact && <span className="composer-shortcut"><Command size={12} /> K</span>}
      <button onClick={submit} disabled={disabled || !value.trim()} aria-label="Run analysis"><ArrowUp size={19} /></button>
    </div>
  );
}
