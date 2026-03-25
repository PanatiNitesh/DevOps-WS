"use client";
import React, { useEffect, useRef } from "react";
import { Theme } from "../types";

export interface ContextMenuItem {
  label?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  t: Theme;
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, t, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - items.length * 36 - 16);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", handler);
    window.addEventListener("keydown", keyHandler);
    return () => { window.removeEventListener("mousedown", handler); window.removeEventListener("keydown", keyHandler); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[100] py-1.5 rounded-2xl shadow-2xl min-w-[200px]"
      style={{
        left,
        top,
        background: t.panel,
        border: `1.5px solid ${t.border}`,
        backdropFilter: "blur(16px)",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.divider) return <div key={i} className="my-1 mx-3" style={{ height: 1, background: t.border }} />;
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => { if (!item.disabled) { item.onClick?.(); onClose(); } }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-left"
            style={{
              color: item.danger ? "#ef4444" : item.disabled ? t.placeholder : t.text,
              opacity: item.disabled ? 0.4 : 1,
              cursor: item.disabled ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = t.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {item.icon && (
              <span className="w-4 flex items-center justify-center flex-shrink-0">
                {item.icon}
              </span>
            )}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="text-xs font-mono flex-shrink-0" style={{ color: t.subtext }}>{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
