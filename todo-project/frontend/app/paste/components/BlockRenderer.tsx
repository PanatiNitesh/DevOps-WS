"use client";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Eye, EyeOff, X, GripVertical } from "lucide-react";
import { Block, Theme } from "../types";

function ShapeBlock({ block, t }: { block: Block; t: Theme }) {
  const fill = block.fill ?? "transparent";
  const stroke = block.stroke ?? t.selBorder;
  const w = block.width, h = block.height ?? block.width;
  switch (block.shapeType) {
    case "circle": return <svg width={w} height={h} style={{ display: "block" }}><ellipse cx={w/2} cy={h/2} rx={w/2-2} ry={h/2-2} fill={fill} stroke={stroke} strokeWidth={2}/></svg>;
    case "triangle": return <svg width={w} height={h} style={{ display: "block" }}><polygon points={`${w/2},2 ${w-2},${h-2} 2,${h-2}`} fill={fill} stroke={stroke} strokeWidth={2}/></svg>;
    case "line": return <svg width={w} height={h} style={{ display: "block" }}><line x1={2} y1={h/2} x2={w-2} y2={h/2} stroke={stroke} strokeWidth={2}/></svg>;
    case "arrow": return (
      <svg width={w} height={h} style={{ display: "block" }}>
        <defs><marker id={`ah-${block.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={stroke}/></marker></defs>
        <line x1={4} y1={h/2} x2={w-12} y2={h/2} stroke={stroke} strokeWidth={2} markerEnd={`url(#ah-${block.id})`}/>
      </svg>
    );
    default: return <svg width={w} height={h} style={{ display: "block" }}><rect x={1} y={1} width={w-2} height={h-2} rx={8} fill={fill} stroke={stroke} strokeWidth={2}/></svg>;
  }
}

interface Props {
  block: Block;
  t: Theme;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onStartResize: (e: React.MouseEvent) => void;
  onHide: () => void;
  onRemove: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onContentChange: (content: string) => void;
  onBlur: (content: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export default function BlockRenderer({ block, t, selected, onMouseDown, onStartResize, onHide, onRemove, onPaste, onContentChange, onBlur, onContextMenu }: Props) {
  const editRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  // Track content locally to avoid restore loop
  const localContentRef = useRef(block.content);

  // Set initial content once on mount
  useEffect(() => {
    if (editRef.current && block.type === "text") {
      editRef.current.innerText = block.content;
      localContentRef.current = block.content;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When switching to edit mode, restore text only if DOM is empty
  useEffect(() => {
    if (focused && editRef.current && block.type === "text") {
      // Only set if the div is empty (just mounted)
      if (editRef.current.innerText !== localContentRef.current) {
        editRef.current.innerText = localContentRef.current;
      }
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      editRef.current.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const selStyle: React.CSSProperties = selected
    ? { outline: `2px solid ${t.selBorder}`, borderRadius: 12, boxShadow: `0 0 0 4px ${t.selBorder}22` }
    : { outline: "2px solid transparent", borderRadius: 12 };

  return (
    <div
      data-block
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      className="absolute group"
      style={{ left: block.x, top: block.y, width: block.width, cursor: "grab", ...selStyle, userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Hover toolbar */}
      <div
        className="absolute -top-9 left-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl px-2 py-1 shadow-md z-10 pointer-events-auto"
        style={{ background: t.toolbar, border: `1px solid ${t.border}`, whiteSpace: "nowrap", userSelect: "none", WebkitUserSelect: "none" }}
      >
        <GripVertical size={12} className="cursor-grab flex-shrink-0" style={{ color: t.subtext }} />
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onHide}
          className="flex items-center justify-center w-6 h-6 rounded hover:opacity-60 transition-opacity"
          style={{ color: t.subtext }}
          title={block.hidden ? "Show" : "Hide"}
        >
          {block.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="flex items-center justify-center w-6 h-6 rounded hover:text-red-400 transition-colors"
          style={{ color: t.subtext }}
          title="Delete"
        >
          <X size={13} />
        </button>
      </div>

      {block.type === "image" && (
        <div className="relative" style={{ width: block.width, height: block.height }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.content} alt="pasted" draggable={false}
            className="rounded-xl shadow-md"
            style={{ width: "100%", height: "100%", objectFit: "contain", border: `1px solid ${t.border}`, display: "block", userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties} />
          <ResizeHandle onMouseDown={onStartResize} />
        </div>
      )}

      {block.type === "shape" && (
        <div className="relative" style={{ width: block.width, height: block.height ?? block.width }}>
          <ShapeBlock block={block} t={t} />
          <ResizeHandle onMouseDown={onStartResize} />
        </div>
      )}

      {block.type === "text" && (
        <>
          {focused ? (
            <div
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onMouseDown={(e) => e.stopPropagation()}
              onPaste={onPaste}
              onInput={(e) => {
                const text = (e.target as HTMLElement).innerText;
                localContentRef.current = text;
                onContentChange(text);
              }}
              onBlur={(e) => {
                const content = (e.target as HTMLElement).innerText;
                localContentRef.current = content;
                onBlur(content);
                setFocused(false);
              }}
              className="min-h-[1.5em] w-full bg-transparent leading-relaxed outline-none caret-[#ff8c94] break-words"
              style={{
                cursor: "text",
                color: block.color ?? t.text,
                fontSize: block.fontSize ?? 16,
                fontStyle: block.italic ? "italic" : "normal",
                textDecoration: block.underline ? "underline" : "none",
                whiteSpace: "pre-wrap",
                userSelect: "text",
                WebkitUserSelect: "text",
                "--ph": t.placeholder,
              } as React.CSSProperties}
              data-placeholder="Type here..."
            />
          ) : (
            <div
              onDoubleClick={(e) => { e.stopPropagation(); setFocused(true); }}
              onClick={(e) => { e.stopPropagation(); setFocused(true); }}
              className="min-h-[1.5em] w-full leading-relaxed break-words cursor-text"
              style={{
                color: block.color ?? t.text,
                fontSize: block.fontSize ?? 16,
                fontStyle: block.italic ? "italic" : "normal",
                textDecoration: block.underline ? "underline" : "none",
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
            >
              {block.content ? (
                <div className="prose prose-sm max-w-none" style={{ color: block.color ?? t.text }}>
                  <ReactMarkdown>{block.content}</ReactMarkdown>
                </div>
              ) : (
                <span style={{ color: t.placeholder }}>Type here...</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      data-resize
      onMouseDown={onMouseDown}
      className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-br-xl"
      style={{ background: "radial-gradient(circle at bottom right,#ff8c94 50%,transparent 75%)", userSelect: "none", WebkitUserSelect: "none" }}
    />
  );
}
