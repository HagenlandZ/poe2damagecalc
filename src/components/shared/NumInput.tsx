interface NumInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  note?: string;
  className?: string;
}

export function NumInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  note,
  className,
}: NumInputProps) {
  return (
    <div className={`field ${className ?? ""}`}>
      <span className="field__label">
        {label}
        {note && <span className="field__note"> {note}</span>}
      </span>
      <input
        className="num-input"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
      {suffix && <span className="field__suffix">{suffix}</span>}
    </div>
  );
}
