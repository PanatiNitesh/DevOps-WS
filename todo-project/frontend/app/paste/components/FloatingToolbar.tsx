"use client";
import { useEffect, useRef, useState } from "react";
import {
  MousePointer2, Type, Pencil, Eraser, Undo2, Redo2,
  Italic, Underline, ImagePlus, Square, Circle, Triangle,
  Minus, ArrowRight, Trash2, Sun, Moon, HelpCircle,
  ChevronDown, GripVertical,
} from "lucide-react";
import { Theme } from "../types";

export type ToolMode = "select" | "text" | "draw" | "eraser";

interface Props {
  t: Theme;
  dark: boolean;
  selectedColor: string;
  toolMode: ToolMode;
  onToolMode: (m: ToolMode) => void;
  onItalic: () => void;
  onUnderline: () => void;
  onFontSize: (size: number) => void;
  onColor: (color: string) => void;
  onAddShape: (shape: "rect" | "circle" | "triangle" | "line" | "arrow") => void;
  onAddText: () => void;
  onAddImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectAll: () => void;
  onDelete: () => void;
  onToggleDark: () => void;
  onShowShortcuts: () => void;
  placingShape: "rect" | "circle" | "triangle" | "line" | "arrow" | null | undefined;
}

const SHAPES: { id: "rect" | "circle" | "triangle" | "line" | "arrow"; Icon: React.FC<{ size?: number }>; title: string }[] = [
  { id: "rect", Icon: Square, title: "Rectangle" },
  { id: "circle", Icon: Circle, title: "Circle" },
  { id: "triangle", Icon: Triangle, title: "Triangle" },
  { id: "line", Icon: Minus, title: "Line" },
  { id: "arrow", Icon: ArrowRight, title: "Arrow" },
];
const FONT_SIZES = [12, 14, 16, 18, 24, 32, 48];
const COLORS = ["#111111", "#e74c3c", "#27ae60", "#2980b9", "#f39c12", "#8e44ad", "#fd79a8", "#ffffff"];

export default function FloatingToolbar({
  t, dark, selectedColor, toolMode, onToolMode,
  onItalic, onUnderline, onFontSize, onColor,
  onAddShape, onAddImage, onUndo, onRedo,
  onSelectAll, onDelete, onToggleDark, onShowShortcuts, placingShape,
}: Props) {
  const [showShapes, setShowShapes] = useState(false);
  const [showFonts, setShowFonts] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 16 });
  const [centered, setCentered] = useState(true);
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (barRef.current) {
      setPos({ x: window.innerWidth / 2 - barRef.current.offsetWidth / 2, y: 16 });
      setCentered(false);
    }
  }, []);

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

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("[data-dropdown]")) return;
    e.preventDefault();
    dragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
  };

  const closeAll = () => { setShowShapes(false); setShowFonts(false); setShowColors(false); };

  const toolBtn = (Icon: React.FC<{ size?: number }>, mode: ToolMode, title: string) => {
    const active = toolMode === mode;
    return (
      <button
        key={mode}
        title={title}
        onClick={() => onToolMode(mode)}
        className="flex items-center justify-center w-9 h-9 rounded-lg transition-all flex-shrink-0"
        style={{
          background: active ? t.selBorder : "transparent",
          color: active ? "#fff" : t.text,
          boxShadow: active ? `0 0 0 2px ${t.selBorder}44` : "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <Icon size={16} />
      </button>
    );
  };

  const btn = (Icon: React.FC<{ size?: number }>, onClick: () => void, title?: string, active = false) => (
    <button
      key={title}
      title={title}
      onClick={onClick}
      className="flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:opacity-70 active:scale-95 flex-shrink-0"
      style={{
        background: active ? t.selBorder : "transparent",
        color: active ? "#fff" : t.text,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <Icon size={16} />
    </button>
  );

  const sep = () => <div className="w-px h-5 mx-0.5 flex-shrink-0" style={{ background: t.border }} />;

  const ActiveShapeIcon = placingShape ? SHAPES.find((s) => s.id === placingShape)?.Icon ?? Square : Square;

  return (
    <div
      ref={barRef}
      onMouseDown={startDrag}
      className="fixed z-50 flex items-center gap-0.5 px-3 py-2 rounded-2xl shadow-2xl"
      style={{
        left: centered ? "50%" : pos.x,
        top: pos.y,
        transform: centered ? "translateX(-50%)" : "none",
        background: t.panel,
        border: `1.5px solid ${t.border}`,
        backdropFilter: "blur(16px)",
        cursor: "grab",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <GripVertical size={14} className="mr-1 flex-shrink-0" style={{ color: t.subtext }} />
      {sep()}

      {toolBtn(MousePointer2, "select", "Select / Move (V)")}
      {toolBtn(Type, "text", "Text tool (T)")}
      {toolBtn(Pencil, "draw", "Draw / Pencil (D)")}
      {toolBtn(Eraser, "eraser", "Eraser (E)")}
      {sep()}

      {btn(Undo2, onUndo, "Undo (Ctrl+Z)")}
      {btn(Redo2, onRedo, "Redo (Ctrl+Y)")}
      {sep()}

      {btn(Italic, onItalic, "Italic")}
      {btn(Underline, onUnderline, "Underline")}
      {sep()}

      {/* Font size */}
      <div className="relative flex-shrink-0" data-dropdown>
        <button
          onClick={() => { setShowFonts((s) => !s); setShowShapes(false); setShowColors(false); }}
          className="flex items-center gap-1 px-2 h-9 rounded-lg text-xs hover:opacity-70 transition-opacity"
          style={{ color: t.text, border: `1px solid ${t.border}`, userSelect: "none", WebkitUserSelect: "none" }}
        >
          Aa <ChevronDown size={12} />
        </button>
        {showFonts && (
          <div className="absolute top-11 left-0 rounded-xl shadow-xl py-1 z-50 min-w-[80px]" style={{ background: t.panel, border: `1px solid ${t.border}` }}>
            {FONT_SIZES.map((s) => (
              <button key={s} onClick={() => { onFontSize(s); closeAll(); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:opacity-70" style={{ color: t.text }}>{s}px</button>
            ))}
          </div>
        )}
      </div>

      {/* Color — clicking activates draw mode */}
      <div className="relative flex-shrink-0" data-dropdown>
        <button
          onClick={() => { setShowColors((s) => !s); setShowShapes(false); setShowFonts(false); }}
          className="w-9 h-9 rounded-lg border-2 hover:scale-110 transition-transform flex-shrink-0 relative"
          style={{ background: selectedColor, borderColor: toolMode === "draw" ? t.selBorder : t.border }}
          title="Color (activates draw mode)"
        >
          {toolMode === "draw" && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#ff8c94] border border-white" />
          )}
        </button>
        {showColors && (
          <div className="absolute top-11 left-0 rounded-xl shadow-xl p-2 z-50 flex flex-wrap gap-1.5 w-28" style={{ background: t.panel, border: `1px solid ${t.border}` }}>
            {COLORS.map((c) => (
              <button key={c}
                onClick={() => { onColor(c); onToolMode("draw"); closeAll(); }}
                className="w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform"
                style={{ background: c, borderColor: c === selectedColor ? t.selBorder : t.border }}
              />
            ))}
          </div>
        )}
      </div>
      {sep()}

      {btn(ImagePlus, onAddImage, "Upload image")}

      {/* Shapes */}
      <div className="relative flex-shrink-0" data-dropdown>
        <button
          onClick={() => { setShowShapes((s) => !s); setShowFonts(false); setShowColors(false); }}
          className="flex items-center gap-1 px-2 h-9 rounded-lg text-xs hover:opacity-70 transition-opacity"
          style={{
            color: placingShape ? t.selBorder : t.text,
            border: `1px solid ${placingShape ? t.selBorder : t.border}`,
            fontWeight: placingShape ? 700 : 400,
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          <ActiveShapeIcon size={14} />
          {placingShape ? " click" : <ChevronDown size={12} />}
        </button>
        {showShapes && (
          <div className="absolute top-11 left-0 rounded-xl shadow-xl py-1 z-50 min-w-[140px]" style={{ background: t.panel, border: `1px solid ${t.border}` }}>
            {SHAPES.map((s) => (
              <button key={s.id} onClick={() => { onAddShape(s.id); closeAll(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:opacity-70"
                style={{ color: t.text }}>
                <s.Icon size={14} />{s.title}
              </button>
            ))}
          </div>
        )}
      </div>
      {sep()}

      {btn(Trash2, onDelete, "Delete selected")}
      {sep()}

      {btn(dark ? Sun : Moon, onToggleDark, "Toggle theme")}
      {btn(HelpCircle, onShowShortcuts, "Shortcuts")}
    </div>
  );
}
