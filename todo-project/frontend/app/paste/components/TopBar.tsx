"use client";
import { useEffect, useRef, useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { CanvasFile, Theme } from "../types";

interface Props {
  t: Theme;
  files: CanvasFile[];
  activeId: string;
  onLoad: (f: CanvasFile) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export default function TopBar({ t, files, activeId, onLoad, onCreate, onDelete, onRename }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pos, setPos] = useState({ x: 16, y: 72 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);

  useEffect(() => { if (editingId) inputRef.current?.focus(); }, [editingId]);

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;
    e.preventDefault();
    dragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({ x: dragRef.current.px + e.clientX - dragRef.current.ox, y: dragRef.current.py + e.clientY - dragRef.current.oy });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const commitRename = () => {
    if (editingId && editName.trim()) onRename(editingId, editName.trim());
    setEditingId(null);
  };

  return (
    <div
      onMouseDown={startDrag}
      className="fixed z-40 flex items-center gap-1 px-3 py-2.5 rounded-2xl shadow-xl"
      style={{
        left: pos.x,
        top: pos.y,
        background: t.panel,
        border: `1.5px solid ${t.border}`,
        cursor: "grab",
        maxWidth: "60vw",
        backdropFilter: "blur(12px)",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <GripVertical size={14} className="mr-1 flex-shrink-0" style={{ color: t.subtext }} />
      <div className="flex items-center gap-1 overflow-x-auto" style={{ maxWidth: 400 }}>
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-0.5 group flex-shrink-0">
            {editingId === f.id ? (
              <input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); }}
                className="px-2 py-0.5 rounded-lg text-sm outline-none"
                style={{ background: t.hover, color: t.text, border: `1px solid ${t.selBorder}`, minWidth: 80, userSelect: "text" }}
              />
            ) : (
              <button
                onClick={() => onLoad(f)}
                onDoubleClick={() => { setEditingId(f.id); setEditName(f.name); }}
                className="px-3 py-1.5 rounded-xl text-sm transition-all"
                style={{
                  background: f.id === activeId ? t.hover : "transparent",
                  color: f.id === activeId ? t.text : t.subtext,
                  fontWeight: f.id === activeId ? 600 : 400,
                  border: f.id === activeId ? `1px solid ${t.border}` : "1px solid transparent",
                }}
                title="Double-click to rename"
              >
                {f.name}
              </button>
            )}
            {files.length > 1 && (
              <button
                onClick={() => onDelete(f.id)}
                className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded hover:text-red-400 transition-all"
                style={{ color: t.subtext }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={onCreate}
        className="flex items-center justify-center w-7 h-7 rounded-xl hover:opacity-70 flex-shrink-0 transition-opacity"
        style={{ color: t.subtext }}
        title="New canvas (Ctrl+N)"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
