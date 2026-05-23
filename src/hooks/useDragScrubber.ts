import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number, start: number) => void;
  sensitivity?: number;
  min?: number;
  max?: number;
}

export function useDragScrubber({
  value,
  onChange,
  onCommit,
  sensitivity = 1,
  min = 0,
  max = Infinity,
}: Options) {
  const [isDragging, setIsDragging] = useState(false);

  // Use a ref so the mousemove handler always sees latest values
  const ref = useRef({
    startX: 0,
    startValue: value,
    lastValue: value,
    onChange,
    onCommit,
    sensitivity,
    min,
    max,
  });
  ref.current.onChange = onChange;
  ref.current.onCommit = onCommit;
  ref.current.sensitivity = sensitivity;
  ref.current.min = min;
  ref.current.max = max;

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      ref.current.startX = e.clientX;
      ref.current.startValue = value;
      ref.current.lastValue = value;
      setIsDragging(true);
    },
    [value],
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const {
        startX,
        startValue,
        sensitivity: sens,
        min: lo,
        max: hi,
        onChange: cb,
      } = ref.current;
      const raw = startValue + (e.clientX - startX) * sens;
      const clamped = Math.round(Math.max(lo, Math.min(hi, raw)) * 10) / 10;
      ref.current.lastValue = clamped;
      cb(clamped);
    };

    const onUp = () => {
      setIsDragging(false);
      ref.current.onCommit?.(ref.current.lastValue, ref.current.startValue);
    };

    // Prevent text selection and suppress CSS transitions while dragging
    document.body.style.userSelect = "none";
    document.body.classList.add("is-dragging");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.style.userSelect = "";
      document.body.classList.remove("is-dragging");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  return { onMouseDown, isDragging };
}
