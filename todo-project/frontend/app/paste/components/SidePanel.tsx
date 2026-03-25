"use client";
import { useEffect, useRef, useState } from "react";
import { GripVertical, Image, FileText, Square, Eye, EyeOff, X, Minus, Plus, BookOpen } from "lucide-react";
import { Block, Theme } from "../types";

interface Props {
  t: Theme;
  blocks: Block[];
  selected: Set<number>;
  onSelect: (id: number) => void;
  onHide: (id: number) => void;
  onRemove: (id: number) => void;
  onReorder: (ids: number[]) => void;
}

function BlockIcon({ block }: { block: Block }) {
  if (block.type === "image") return <Image size={12} />;
  if (block.type === "shape") return <Square size={12} />;
  if (block.type === "pdf") return <BookOpen size={12} />;
  return <FileText size={12} />;
}

function blockLabel(block: Block) {
  if (block.type === "image") return "Image";
  if (block.type === "pdf") return block.pdfName ?? "PDF";
  if (block.type === "shape") return block.shapeType ?? "Shape";
  return block.content.slice(0, 20) || "Empty";
}

export default function SidePanel({ t, blocks, selected, onSelect, onHide, onRemove, onReorder }: Props) {
  const [open, setOpen] = useState(true);
  const [pos, setPos] = useState({ x: 16, y: 140 });
  const [items, setItems] = useState<Block[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const panelDragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);

  // Sync items when blocks change (from outside)
  useEffect(() => {
    setItems([...blocks].sort((a, b) => b.createdAt - a.createdAt));
  }, [blocks]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panelDragRef.current) return;
      setPos({ x: panelDragRef.current.px + e.clientX - panelDragRef.current.ox, y: panelDragRef.current.py + e.clientY - panelDragRef.current.oy });
    };
    const onUp = () => { panelDragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const startPanelDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    panelDragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
  };

  // Item drag-to-reorder
  const handleItemDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleItemDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  };
  const handleItemDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setItems(next);
    onReorder(next.map((b) => b.id));
    setDragIdx(null);
    setOverIdx(null);
  };
  const handleItemDragEnd = () => { setDragIdx(null); setOverIdx(null); };

  return (
    <div
      className="fixed z-40 rounded-2xl shadow-xl overflow-hidden"
      style={{
        left: pos.x,
        top: pos.y,
        width: open ? 210 : "auto",
        background: t.panel,
        border: `1.5px solid ${t.border}`,
        backdropFilter: "blur(12px)",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Header */}
      <div
        onMouseDown={startPanelDrag}
        className="flex items-center justify-between px-3 py-2.5 cursor-grab"
        style={{ borderBottom: open ? `1px solid ${t.border}` : "none" }}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={14} style={{ color: t.subtext }} />
          {open && <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: t.subtext }}>Items · {blocks.length}</span>}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-center w-5 h-5 rounded hover:opacity-60 transition-opacity ml-2"
          style={{ color: t.subtext }}
        >
          {open ? <Minus size={12} /> : <Plus size={12} />}
        </button>
      </div>

      {open && (
        <div className="overflow-y-auto py-1" style={{ maxHeight: "50vh" }}>
          {items.map((block, idx) => (
            <div
              key={block.id}
              draggable
              onDragStart={(e) => handleItemDragStart(e, idx)}
              onDragOver={(e) => handleItemDragOver(e, idx)}
              onDrop={(e) => handleItemDrop(e, idx)}
              onDragEnd={handleItemDragEnd}
              className="group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
              style={{
                opacity: block.hidden ? 0.4 : dragIdx === idx ? 0.4 : 1,
                background: selected.has(block.id) ? t.hover : overIdx === idx && dragIdx !== idx ? t.selBorder + "22" : "transparent",
                borderTop: overIdx === idx && dragIdx !== null && dragIdx !== idx ? `2px solid ${t.selBorder}` : "2px solid transparent",
              }}
              onClick={() => onSelect(block.id)}
              onMouseEnter={(e) => { if (!selected.has(block.id)) e.currentTarget.style.background = t.hover; }}
              onMouseLeave={(e) => { if (!selected.has(block.id)) e.currentTarget.style.background = overIdx === idx ? t.selBorder + "22" : "transparent"; }}
            >
              <GripVertical size={11} className="flex-shrink-0 cursor-grab opacity-30 group-hover:opacity-70" style={{ color: t.subtext }} />
              <span className="flex-shrink-0" style={{ color: t.subtext }}>
                <BlockIcon block={block} />
              </span>
              <span className="flex-1 text-xs truncate" style={{ color: t.subtext }}>{blockLabel(block)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onHide(block.id); }}
                className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded hover:opacity-60 transition-all"
                style={{ color: t.subtext }}
                title={block.hidden ? "Show" : "Hide"}
              >
                {block.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}
                className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded hover:text-red-400 transition-all"
                style={{ color: t.subtext }}
                title="Delete"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {blocks.length === 0 && (
            <p className="text-xs text-center py-4 px-3" style={{ color: t.placeholder }}>Nothing yet</p>
          )}
        </div>
      )}
    </div>
  );
}
