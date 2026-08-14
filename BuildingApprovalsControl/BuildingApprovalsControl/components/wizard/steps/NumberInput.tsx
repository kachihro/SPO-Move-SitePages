import * as React from "react";
import { Input } from "@fluentui/react-components";

interface NumberInputProps {
  value?: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: number | undefined) => void;
}

/** Digits with at most one decimal point, optionally negative. Partial entries like "1." pass. */
const NUMERIC_TEXT = /^-?\d*\.?\d*$/;

/**
 * Numeric field that keeps the raw text the user typed.
 *
 * Binding `Number(value)` straight to the form state has two failure modes this avoids: typing a
 * letter produced `NaN`, which rendered as the literal text "NaN" in the box, and a trailing "."
 * was swallowed on re-render, making decimals impossible to type ("1." → 1 → "1" → "15").
 * Non-numeric keystrokes are rejected outright; the form state only ever sees a real number or
 * `undefined`.
 */
export const NumberInput: React.FC<NumberInputProps> = ({ value, disabled, className, onChange }) => {
  const [text, setText] = React.useState<string>(value?.toString() ?? "");

  // Adopt external changes (loading a saved record, resetting the wizard) without clobbering an
  // in-progress entry that already means the same number.
  React.useEffect(() => {
    const current = parse(text);
    if (current !== value) {
      setText(value?.toString() ?? "");
    }
    // `text` is deliberately not a dependency — this effect exists to overwrite it.
  }, [value]);

  return (
    <Input
      className={className}
      value={text}
      disabled={disabled}
      inputMode="decimal"
      onChange={(_, d) => {
        if (!NUMERIC_TEXT.test(d.value)) return;
        setText(d.value);
        onChange(parse(d.value));
      }}
    />
  );
};

function parse(text: string): number | undefined {
  if (text === "" || text === "-" || text === "." || text === "-.") return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}
