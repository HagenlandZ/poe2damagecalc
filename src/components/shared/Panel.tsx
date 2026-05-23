import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, children, className }: PanelProps) {
  return (
    <div className={`panel ${className ?? ""}`}>
      <div className="panel__header">{title}</div>
      <div className="panel__body">{children}</div>
    </div>
  );
}
