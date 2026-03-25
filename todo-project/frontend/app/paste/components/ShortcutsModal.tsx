"use client";
import { X } from "lucide-react";
import { Theme } from "../types";

const SHORTCUTS = [
  ["Ctrl+C / Ctrl+Insert", "Copy selected"],
  ["Ctrl+X", "Cut selected"],
  ["Ctrl+V / Shift+Insert", "Paste"],
  ["Ctrl+Z", "Undo"],
  ["Ctrl+Y", "Redo"],
  ["Ctrl+A", "Select all"],
  ["Ctrl+S", "Save (auto-saves)"],
  ["Ctrl+F", "Find in blocks"],
  ["Ctrl+I", "Italic text"],
  ["Ctrl+U", "Underline text"],
  ["Ctrl+N", "New canvas"],
  ["Ctrl+=", "Zoom in"],
  ["Ctrl+-", "Zoom out"],
  ["Ctrl+0", "Reset zoom & pan"],
  ["V", "Select tool"],
  ["T", "Text tool"],
  ["D", "Draw tool"],
  ["E", "Eraser tool"],
  ["F2", "Rename active file"],
  ["Delete / Backspace", "Delete selected blocks"],
  ["Escape", "Deselect all"],
  ["Scroll wheel", "Zoom in/out"],
  ["Right-drag / Middle-drag", "Pan canvas"],
  ["Click empty canvas", "Create text block"],
  ["Drag on canvas", "Rubber-band select"],
  ["?", "Toggle this panel"],
];

export default function ShortcutsModal({ t, onClose }: { t: Theme; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-5 w-96 max-h-[80vh] overflow-y-auto shadow-2xl"
        style={{ background: t.panel, border: `1px solid ${t.border}`, color: t.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-sm">Keyboard Shortcuts</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded hover:opacity-60 transition-opacity"
            style={{ color: t.subtext }}
          >
            <X size={14} />
          </button>
        </div>
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5 text-xs" style={{ borderBottom: `1px solid ${t.border}` }}>
            <span className="font-mono" style={{ color: t.subtext }}>{k}</span>
            <span style={{ color: t.text }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
