"use client";
import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, X, EyeOff, Eye } from "lucide-react";
import { Block, Theme } from "../types";

interface Props {
  block: Block;
  t: Theme;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onStartResize: (e: React.MouseEvent) => void;
  onHide: () => void;
  onRemove: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPageChange: (id: number, page: number) => void;
}

export default function PDFBlock({ block, t, selected, onMouseDown, onStartResize, onHide, onRemove, onContextMenu, onPageChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentPage = block.pdfPage ?? 1;
  const totalPages = block.pdfTotalPages ?? 1;

  useEffect(() => {
    if (!block.content || !canvasRef.current) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderTask: any = null;

    const render = async () => {
      setLoading(true);
      setError("");
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // Use local worker served from /public
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        // Decode base64 data URL
        const base64 = block.content.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;

        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // pdfjs v5: canvas is primary, canvasContext is optional
        renderTask = page.render({ canvas, viewport });
        await renderTask.promise;

        if (!cancelled) setLoading(false);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.toLowerCase().includes("cancel")) {
            console.error("PDF render error:", e);
            setError("Failed to render PDF");
          }
          setLoading(false);
        }
      }
    };

    render();
    return () => {
      cancelled = true;
      try { renderTask?.cancel(); } catch { /* ignore */ }
    };
  }, [block.content, currentPage]);

  const selStyle: React.CSSProperties = selected
    ? { outline: `2px solid ${t.selBorder}`, borderRadius: 12, boxShadow: `0 0 0 4px ${t.selBorder}22` }
    : { outline: "2px solid transparent", borderRadius: 12 };

  return (
    <div
      data-block
      onContextMenu={onContextMenu}
      className="absolute group"
      style={{ left: block.x, top: block.y, width: block.width, ...selStyle, userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Hover toolbar */}
      <div
        className="absolute -top-9 left-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl px-2 py-1 shadow-md z-10 pointer-events-auto"
        style={{ background: t.toolbar, border: `1px solid ${t.border}`, whiteSpace: "nowrap" }}
      >
        <GripVertical size={12} className="cursor-grab flex-shrink-0" style={{ color: t.subtext }} />
        <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: t.subtext }}>{block.pdfName ?? "PDF"}</span>
        <button onMouseDown={(e) => e.stopPropagation()} onClick={onHide} className="flex items-center justify-center w-6 h-6 rounded hover:opacity-60" style={{ color: t.subtext }}>
          {block.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button onMouseDown={(e) => e.stopPropagation()} onClick={onRemove} className="flex items-center justify-center w-6 h-6 rounded hover:text-red-400" style={{ color: t.subtext }}>
          <X size={13} />
        </button>
      </div>

      {/* PDF viewer */}
      <div
        className="rounded-xl overflow-hidden shadow-md"
        style={{ border: `1px solid ${t.border}`, background: t.panel, width: block.width, height: block.height ?? 500 }}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header — this is the drag handle for the block */}
        <div
          className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
          onMouseDown={onMouseDown}
          style={{ borderBottom: `1px solid ${t.border}`, background: t.toolbar, cursor: "grab" }}
        >
          <span className="text-xs font-medium truncate max-w-[160px]" style={{ color: t.text }}>{block.pdfName ?? "PDF"}</span>
          <div className="flex items-center gap-1">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onPageChange(block.id, Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="flex items-center justify-center w-6 h-6 rounded hover:opacity-70 disabled:opacity-30"
              style={{ color: t.text }}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs tabular-nums" style={{ color: t.subtext }}>{currentPage} / {totalPages}</span>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onPageChange(block.id, Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="flex items-center justify-center w-6 h-6 rounded hover:opacity-70 disabled:opacity-30"
              style={{ color: t.text }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Canvas area — scroll independently; mousedown here must not start a block drag */}
        <div
          className="overflow-auto"
          style={{ height: (block.height ?? 500) - 36 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {loading && (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs" style={{ color: t.subtext }}>Rendering...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full px-4 text-center">
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            style={{ display: loading || error ? "none" : "block", width: "100%", height: "auto" }}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        data-resize
        onMouseDown={onStartResize}
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-br-xl"
        style={{ background: "radial-gradient(circle at bottom right,#ff8c94 50%,transparent 75%)" }}
      />
    </div>
  );
}