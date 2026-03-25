"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Type, ImagePlus, Square, Circle, MousePointer2,
  Undo2, Redo2, Trash2, Pencil, Eraser,
} from "lucide-react";
import { Block, CanvasFile, DARK, LIGHT } from "./types";
import FloatingToolbar, { ToolMode } from "./components/FloatingToolbar";
import TopBar from "./components/TopBar";
import SidePanel from "./components/SidePanel";
import BlockRenderer from "./components/BlockRenderer";
import PDFBlock from "./components/PDFBlock";
import ShortcutsModal from "./components/ShortcutsModal";
import ContextMenu, { ContextMenuItem } from "./components/ContextMenu";

const MIN_ZOOM = 0.1, MAX_ZOOM = 5;
let nextId = Date.now(); // Use timestamp base to avoid collisions on hot reload
const LS_KEY = "paste_canvas_files";
const LS_ACTIVE = "paste_canvas_active";

function loadFiles(): CanvasFile[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveFiles(files: CanvasFile[]) { localStorage.setItem(LS_KEY, JSON.stringify(files)); }
function naturalSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => res({ w: 400, h: 300 });
    img.src = src;
  });
}

// Distance from point to SVG path (approximate via bounding box of points)
function pointNearPath(px: number, py: number, pathD: string, threshold = 20): boolean {
  const nums = pathD.match(/[\d.]+/g);
  if (!nums || nums.length < 4) return false;
  const coords: [number, number][] = [];
  for (let i = 0; i < nums.length - 1; i += 2) coords.push([parseFloat(nums[i]), parseFloat(nums[i + 1])]);
  return coords.some(([cx, cy]) => Math.hypot(cx - px, cy - py) < threshold);
}

export default function PastePage() {
  const [files, setFiles] = useState<CanvasFile[]>([]);
  const [activeId, setActiveId] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("paste_theme") === "dark";
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [showFind, setShowFind] = useState(false);
  const [placingShape, setPlacingShape] = useState<Block["shapeType"] | null>(null);
  const [selectedColor, setSelectedColor] = useState("#e74c3c");
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; blockId: number | null } | null>(null);

  const historyRef = useRef<Block[][]>([]);
  const futureRef = useRef<Block[][]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef<{ id: number; points: [number, number][] } | null>(null);
  const dragging = useRef<{ starts: { id: number; ox: number; oy: number }[] } | null>(null);
  const resizing = useRef<{ id: number; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const panning = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const selStart = useRef<{ x: number; y: number } | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const blocksRef = useRef(blocks);
  const selectedRef = useRef(selected);
  const toolRef = useRef(toolMode);
  const colorRef = useRef(selectedColor);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { toolRef.current = toolMode; }, [toolMode]);
  useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);

  const pushHistory = (b: Block[]) => {
    historyRef.current = [...historyRef.current.slice(-40), b];
    futureRef.current = [];
  };
  const setBlocksH = useCallback((updater: (prev: Block[]) => Block[]) => {
    setBlocks((prev) => { pushHistory(prev); return updater(prev); });
  }, []);

  // ── localStorage ──
  useEffect(() => {
    const saved = loadFiles();
    const activeKey = localStorage.getItem(LS_ACTIVE);
    if (saved.length > 0) { setFiles(saved); loadFile(saved.find((f) => f.id === activeKey) ?? saved[0]); }
    else createNewFile(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setFiles((prev) => { const u = prev.map((f) => f.id === activeId ? { ...f, blocks, zoom, pan, updatedAt: Date.now() } : f); saveFiles(u); return u; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, zoom, pan]);

  function loadFile(file: CanvasFile) {
    const maxId = file.blocks.reduce((m, b) => Math.max(m, b.id), 0);
    nextId = Math.max(nextId, maxId + 1);
    setBlocks(file.blocks); setZoom(file.zoom); setPan(file.pan);
    setActiveId(file.id); setSelected(new Set());
    historyRef.current = []; futureRef.current = [];
    localStorage.setItem(LS_ACTIVE, file.id);
  }
  function createNewFile(skipSave = false) {
    const id = crypto.randomUUID();
    const file: CanvasFile = { id, name: `Canvas ${Date.now().toString().slice(-4)}`, blocks: [], zoom: 1, pan: { x: 0, y: 0 }, updatedAt: Date.now() };
    setFiles((prev) => { const u = [...prev, file]; if (!skipSave) saveFiles(u); return u; });
    loadFile(file);
  }
  function renameFile(id: string, name: string) {
    setFiles((prev) => { const u = prev.map((f) => f.id === id ? { ...f, name } : f); saveFiles(u); return u; });
  }
  function deleteFile(id: string) {
    setFiles((prev) => { const u = prev.filter((f) => f.id !== id); saveFiles(u); if (activeId === id) { if (u.length > 0) loadFile(u[0]); else createNewFile(false); } return u; });
  }

  // ── Block helpers ──
  const addImageBlock = async (dataUrl: string, x: number, y: number) => {
    const { w, h } = await naturalSize(dataUrl);
    const scale = w > 900 ? 900 / w : 1;
    setBlocksH((prev) => [...prev, { id: nextId++, type: "image", content: dataUrl, x, y, width: Math.round(w * scale), height: Math.round(h * scale), hidden: false, createdAt: Date.now() }]);
  };

  const pasteData = (cd: DataTransfer, x: number, y: number) => {
    const imgItem = Array.from(cd.items).find((i) => i.type.startsWith("image/"));
    if (imgItem) { const file = imgItem.getAsFile(); if (file) { const r = new FileReader(); r.onload = (ev) => addImageBlock(ev.target?.result as string, x, y); r.readAsDataURL(file); } return; }
    const text = cd.getData("text/plain");
    if (text) setBlocksH((prev) => [...prev, { id: nextId++, type: "text", content: text, x, y, width: 320, hidden: false, createdAt: Date.now() }]);
  };

  const removeBlock = (id: number) => setBlocksH((prev) => prev.filter((b) => b.id !== id));
  const toggleHide = (id: number) => setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, hidden: !b.hidden } : b));
  const updateContent = (id: number, content: string) => setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, content } : b));

  const deleteSelected = useCallback(() => {
    if (selectedRef.current.size === 0) return;
    setBlocksH((prev) => prev.filter((b) => !selectedRef.current.has(b.id)));
    setSelected(new Set());
  }, [setBlocksH]);

  const applyToSelected = (patch: Partial<Block>) => {
    if (selectedRef.current.size === 0) return;
    setBlocksH((prev) => prev.map((b) => selectedRef.current.has(b.id) ? { ...b, ...patch } : b));
  };

  const addTextBlock = (x?: number, y?: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = x ?? (rect.width / 2 - panRef.current.x) / zoomRef.current - 100;
    const cy = y ?? (rect.height / 2 - panRef.current.y) / zoomRef.current - 20;
    setBlocksH((prev) => [...prev, { id: nextId++, type: "text", content: "", x: cx, y: cy, width: 320, hidden: false, createdAt: Date.now() }]);
  };

  const addPDFBlock = async (file: File, x: number, y: number) => {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader(); r.onload = (e) => res(e.target?.result as string); r.onerror = rej; r.readAsDataURL(file);
    });
    // Get page count
    let totalPages = 1;
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const binary = atob(dataUrl.split(",")[1]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      totalPages = pdf.numPages;
    } catch { /* use 1 */ }
    setBlocksH((prev) => [...prev, {
      id: nextId++, type: "pdf", content: dataUrl,
      x, y, width: 420, height: 540,
      hidden: false, createdAt: Date.now(),
      pdfName: file.name, pdfPage: 1, pdfTotalPages: totalPages,
    }]);
  };

  const updatePDFPage = (id: number, page: number) => {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, pdfPage: page } : b));
  };

  const undo = useCallback(() => {
    const h = historyRef.current; if (h.length === 0) return;
    futureRef.current = [blocksRef.current, ...futureRef.current];
    historyRef.current = h.slice(0, -1); setBlocks(h[h.length - 1]);
  }, []);
  const redo = useCallback(() => {
    const f = futureRef.current; if (f.length === 0) return;
    historyRef.current = [...historyRef.current, blocksRef.current];
    futureRef.current = f.slice(1); setBlocks(f[0]);
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const inEditable = !!(document.activeElement?.getAttribute("contenteditable"));
      if ((e.key === "Delete" || e.key === "Backspace") && !inEditable) { e.preventDefault(); deleteSelected(); }
      if (ctrl && e.key === "z") { e.preventDefault(); undo(); }
      if (ctrl && e.key === "y") { e.preventDefault(); redo(); }
      if (ctrl && e.key === "a") { e.preventDefault(); setSelected(new Set(blocksRef.current.map((b) => b.id))); }
      if (ctrl && e.key === "n") { e.preventDefault(); createNewFile(); }
      if (ctrl && e.key === "f") { e.preventDefault(); setShowFind((s) => !s); }
      if (ctrl && e.key === "=") { e.preventDefault(); setZoom((z) => Math.min(MAX_ZOOM, z * 1.2)); }
      if (ctrl && e.key === "-") { e.preventDefault(); setZoom((z) => Math.max(MIN_ZOOM, z * 0.8)); }
      if (ctrl && e.key === "0") { e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }); }
      if (e.key === "v" && !inEditable && !ctrl) setToolMode("select");
      if (e.key === "t" && !inEditable && !ctrl) setToolMode("text");
      if (e.key === "d" && !inEditable && !ctrl) setToolMode("draw");
      if (e.key === "e" && !inEditable && !ctrl) setToolMode("eraser");
      if (e.key === "F2") { const f = files.find((fi) => fi.id === activeId); if (f) { const name = prompt("Rename:", f.name); if (name) renameFile(activeId, name); } }
      if (e.key === "Escape") { setSelected(new Set()); setShowFind(false); setPlacingShape(null); setCtxMenu(null); }
      if (e.key === "?") setShowShortcuts((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteSelected, undo, redo, files, activeId]);

  // ── Canvas events ──
  const canvasCoords = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (e.clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement) !== canvasRef.current) return;
    const { x, y } = canvasCoords(e);
    if (placingShape) {
      setBlocksH((prev) => [...prev, { id: nextId++, type: "shape", shapeType: placingShape, content: "", x, y, width: 120, height: 80, hidden: false, createdAt: Date.now(), fill: "transparent", stroke: colorRef.current }]);
      setPlacingShape(null);
      return;
    }
    if (toolRef.current === "text") { setSelected(new Set()); addTextBlock(x, y); return; }
    if (toolRef.current === "select") { setSelected(new Set()); }
  };

  const handleContextMenu = (e: React.MouseEvent, blockId: number | null) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, blockId });
  };

  const handleCanvasPaste = useCallback((e: React.ClipboardEvent) => {
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    pasteData(e.clipboardData, (rect.width / 2 - panRef.current.x) / zoomRef.current - 140, (rect.height / 2 - panRef.current.y) / zoomRef.current - 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBlockPaste = (e: React.ClipboardEvent, id: number) => {
    // stopPropagation prevents the event from bubbling to handleCanvasPaste,
    // which would create a second duplicate block with the same content.
    e.stopPropagation();
    const imgItem = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (imgItem) {
      e.preventDefault();
      const file = imgItem.getAsFile();
      if (file) { const block = blocksRef.current.find((b) => b.id === id)!; const r = new FileReader(); r.onload = (ev) => addImageBlock(ev.target?.result as string, block.x + 20, block.y + 20); r.readAsDataURL(file); }
      return;
    }
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const sel = window.getSelection();
    if (sel?.rangeCount) { const range = sel.getRangeAt(0); range.deleteContents(); range.insertNode(document.createTextNode(text)); range.collapse(false); }
  };

  const handleTextBlur = (id: number, content: string) => {
    if (!content.trim()) setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const { x, y } = canvasCoords(e);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type === "application/pdf") {
        await addPDFBlock(file, x, y);
      } else if (file.type.startsWith("image/")) {
        const r = new FileReader();
        r.onload = (ev) => addImageBlock(ev.target?.result as string, x, y);
        r.readAsDataURL(file);
      } else if (file.type.startsWith("text/") || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
        const text = await file.text();
        setBlocksH((prev) => [...prev, { id: nextId++, type: "text", content: text, x, y, width: 400, hidden: false, createdAt: Date.now() }]);
      }
    }
    // Also handle dragged text/uri
    if (files.length === 0) {
      const text = e.dataTransfer.getData("text/plain");
      if (text) setBlocksH((prev) => [...prev, { id: nextId++, type: "text", content: text, x, y, width: 320, hidden: false, createdAt: Date.now() }]);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * delta));
    const scale = newZoom / zoomRef.current;
    setPan((p) => ({ x: mx - scale * (mx - p.x), y: my - scale * (my - p.y) }));
    setZoom(newZoom);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) { e.preventDefault(); panning.current = { ox: e.clientX, oy: e.clientY, px: panRef.current.x, py: panRef.current.y }; return; }
    if ((e.target as HTMLElement) !== canvasRef.current) return;
    if (placingShape) return;

    if (toolRef.current === "draw") {
      e.preventDefault();
      const { x, y } = canvasCoords(e);
      const id = nextId++;
      drawingRef.current = { id, points: [[x, y]] };
      setBlocksH((prev) => [...prev, { id, type: "shape", shapeType: "line", content: "__draw__", x: 0, y: 0, width: 1, height: 1, hidden: false, createdAt: Date.now(), stroke: colorRef.current, fill: "none" }]);
      return;
    }

    if (toolRef.current === "eraser") {
      e.preventDefault();
      return;
    }

    if (toolRef.current === "select" || toolRef.current === "text") {
      const rect = canvasRef.current!.getBoundingClientRect();
      selStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setSelBox(null);
      if (!e.shiftKey) setSelected(new Set());
    }
  };

  const startBlockDrag = (e: React.MouseEvent, id: number) => {
    if (toolRef.current === "draw") return;
    if (toolRef.current === "eraser") return;
    if ((e.target as HTMLElement).closest("[contenteditable]")) return;
    if ((e.target as HTMLElement).closest("[data-resize]")) return;
    e.preventDefault(); e.stopPropagation();
    const ids = selectedRef.current.has(id) ? [...selectedRef.current] : [id];
    if (!selectedRef.current.has(id)) setSelected(new Set([id]));
    dragging.current = { starts: ids.map((bid) => { const b = blocksRef.current.find((bl) => bl.id === bid)!; return { id: bid, ox: e.clientX - b.x * zoomRef.current, oy: e.clientY - b.y * zoomRef.current }; }) };
  };

  const startResize = (e: React.MouseEvent, id: number) => {
    e.preventDefault(); e.stopPropagation();
    const b = blocksRef.current.find((bl) => bl.id === id)!;
    resizing.current = { id, startX: e.clientX, startY: e.clientY, startW: b.width, startH: b.height ?? 200 };
  };

  const pointsToPath = (pts: [number, number][]) => {
    if (pts.length < 2) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (panning.current) { setPan({ x: panning.current.px + e.clientX - panning.current.ox, y: panning.current.py + e.clientY - panning.current.oy }); return; }
      if (drawingRef.current) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
        const y = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
        drawingRef.current.points.push([x, y]);
        const path = pointsToPath(drawingRef.current.points);
        const id = drawingRef.current.id;
        setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, content: path } : b));
        return;
      }
      // Eraser — erase draw strokes near cursor
      if (toolRef.current === "eraser" && e.buttons === 1) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
        const y = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
        setBlocks((prev) => {
          const toRemove = prev.filter((b) => b.type === "shape" && b.content.startsWith("M") && pointNearPath(x, y, b.content, 18 / zoomRef.current));
          if (toRemove.length === 0) return prev;
          pushHistory(prev);
          return prev.filter((b) => !toRemove.some((r) => r.id === b.id));
        });
        return;
      }
      if (dragging.current) {
        setBlocks((prev) => prev.map((b) => { const s = dragging.current!.starts.find((st) => st.id === b.id); return s ? { ...b, x: (e.clientX - s.ox) / zoomRef.current, y: (e.clientY - s.oy) / zoomRef.current } : b; }));
        return;
      }
      if (resizing.current) {
        const { id, startX, startY, startW, startH } = resizing.current;
        setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, width: Math.max(80, startW + (e.clientX - startX) / zoomRef.current), height: Math.max(60, startH + (e.clientY - startY) / zoomRef.current) } : b));
        return;
      }
      if (selStart.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        const box = { x: Math.min(selStart.current.x, cx), y: Math.min(selStart.current.y, cy), w: Math.abs(cx - selStart.current.x), h: Math.abs(cy - selStart.current.y) };
        setSelBox(box);
        const hits = new Set<number>();
        blocksRef.current.forEach((b) => {
          const bx = b.x * zoomRef.current + panRef.current.x, by = b.y * zoomRef.current + panRef.current.y;
          if (bx < box.x + box.w && bx + b.width * zoomRef.current > box.x && by < box.y + box.h && by + (b.height ?? 60) * zoomRef.current > box.y) hits.add(b.id);
        });
        setSelected(hits);
      }
    };
    const onUp = () => { drawingRef.current = null; dragging.current = null; resizing.current = null; panning.current = null; selStart.current = null; setSelBox(null); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // ── Context menu items (lucide icons) ──
  const buildContextMenu = (): ContextMenuItem[] => {
    const bid = ctxMenu?.blockId ?? null;
    const block = bid != null ? blocksRef.current.find((b) => b.id === bid) : null;
    const hasSelected = selectedRef.current.size > 0;

    if (block) {
      return [
        { icon: <Pencil size={13} />, label: "Edit", onClick: () => { if (block.type === "text") document.getElementById(`block-${block.id}`)?.focus(); } },
        { icon: block.hidden ? <MousePointer2 size={13} /> : <Eraser size={13} />, label: block.hidden ? "Show" : "Hide", onClick: () => toggleHide(block.id) },
        { divider: true },
        { icon: <MousePointer2 size={13} />, label: "Select All", shortcut: "Ctrl+A", onClick: () => setSelected(new Set(blocksRef.current.map((b) => b.id))) },
        { icon: <Square size={13} />, label: "Duplicate", onClick: () => { const b = blocksRef.current.find((bl) => bl.id === bid)!; setBlocksH((prev) => [...prev, { ...b, id: nextId++, x: b.x + 20, y: b.y + 20, createdAt: Date.now() }]); } },
        { divider: true },
        { icon: <Trash2 size={13} />, label: "Delete", shortcut: "Del", danger: true, onClick: () => removeBlock(block.id) },
      ];
    }

    return [
      { icon: <Type size={13} />, label: "Add Text", shortcut: "T", onClick: () => { const { x, y } = canvasCoords({ clientX: ctxMenu!.x, clientY: ctxMenu!.y }); addTextBlock(x, y); } },
      { icon: <ImagePlus size={13} />, label: "Upload Image", onClick: () => fileInputRef.current?.click() },
      { icon: <Square size={13} />, label: "Add Rectangle", onClick: () => { const { x, y } = canvasCoords({ clientX: ctxMenu!.x, clientY: ctxMenu!.y }); setBlocksH((prev) => [...prev, { id: nextId++, type: "shape", shapeType: "rect", content: "", x, y, width: 120, height: 80, hidden: false, createdAt: Date.now(), fill: "transparent", stroke: selectedColor }]); } },
      { icon: <Circle size={13} />, label: "Add Circle", onClick: () => { const { x, y } = canvasCoords({ clientX: ctxMenu!.x, clientY: ctxMenu!.y }); setBlocksH((prev) => [...prev, { id: nextId++, type: "shape", shapeType: "circle", content: "", x, y, width: 100, height: 100, hidden: false, createdAt: Date.now(), fill: "transparent", stroke: selectedColor }]); } },
      { divider: true },
      { icon: <MousePointer2 size={13} />, label: "Select All", shortcut: "Ctrl+A", onClick: () => setSelected(new Set(blocksRef.current.map((b) => b.id))) },
      { icon: <Undo2 size={13} />, label: "Undo", shortcut: "Ctrl+Z", disabled: historyRef.current.length === 0, onClick: undo },
      { icon: <Redo2 size={13} />, label: "Redo", shortcut: "Ctrl+Y", disabled: futureRef.current.length === 0, onClick: redo },
      { divider: true },
      { icon: <Trash2 size={13} />, label: "Delete Selected", shortcut: "Del", danger: true, disabled: !hasSelected, onClick: deleteSelected },
    ];
  };

  const t = dark ? DARK : LIGHT;
  const visibleBlocks = blocks.filter((b) => !b.hidden);
  const findMatches = findQuery ? blocks.filter((b) => b.type === "text" && b.content.toLowerCase().includes(findQuery.toLowerCase())).map((b) => b.id) : [];

  const canvasCursor = placingShape ? "crosshair"
    : toolMode === "draw" ? "crosshair"
    : toolMode === "eraser" ? "cell"
    : toolMode === "text" ? "text"
    : "default";

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: t.bg, color: t.text, userSelect: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => handleContextMenu(e, null)}
    >
      <FloatingToolbar
        t={t} dark={dark} selectedColor={selectedColor} toolMode={toolMode} placingShape={placingShape}
        onToolMode={(m) => { setToolMode(m); setPlacingShape(null); }}
        onItalic={() => applyToSelected({ italic: true })}
        onUnderline={() => applyToSelected({ underline: true })}
        onFontSize={(size) => applyToSelected({ fontSize: size })}
        onColor={(c) => { setSelectedColor(c); setToolMode("draw"); applyToSelected({ color: c }); }}
        onAddShape={(s) => { setPlacingShape(s); setToolMode("select"); }}
        onAddText={() => addTextBlock()}
        onAddImage={() => fileInputRef.current?.click()}
        onUndo={undo} onRedo={redo}
        onSelectAll={() => setSelected(new Set(blocks.map((b) => b.id)))}
        onDelete={deleteSelected}
        onToggleDark={() => setDark((d) => { localStorage.setItem("paste_theme", d ? "light" : "dark"); return !d; })}
        onShowShortcuts={() => setShowShortcuts((s) => !s)}
      />

      <TopBar t={t} files={files} activeId={activeId} onLoad={loadFile} onCreate={() => createNewFile()} onDelete={deleteFile} onRename={renameFile} />
      <SidePanel t={t} blocks={blocks} selected={selected} onSelect={(id) => setSelected(new Set([id]))} onHide={toggleHide} onRemove={removeBlock}
        onReorder={(ids) => setBlocks((prev) => {
          const map = new Map(prev.map((b) => [b.id, b]));
          return ids.map((id) => map.get(id)!).filter(Boolean);
        })}
      />

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0]; if (!file) return;
        const r = new FileReader(); r.onload = (ev) => { const rect = canvasRef.current!.getBoundingClientRect(); addImageBlock(ev.target?.result as string, (rect.width / 2 - panRef.current.x) / zoomRef.current - 150, (rect.height / 2 - panRef.current.y) / zoomRef.current - 100); }; r.readAsDataURL(file);
        e.target.value = "";
      }} />

      {/* Canvas */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        onPaste={handleCanvasPaste}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onContextMenu={(e) => handleContextMenu(e, null)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="absolute inset-0"
        style={{ cursor: canvasCursor }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: dark ? 0.12 : 0.22 }}>
          <defs>
            <pattern id="dots" x={pan.x % (24 * zoom)} y={pan.y % (24 * zoom)} width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1} fill={t.dot} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {selBox && (
          <div className="absolute pointer-events-none rounded" style={{ left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h, border: `1.5px dashed ${t.selBorder}`, background: "rgba(255,140,148,0.06)", zIndex: 50 }} />
        )}

        {blocks.length === 0 && !placingShape && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm tracking-widest uppercase" style={{ color: t.placeholder }}>
              {toolMode === "draw" ? "Draw anywhere · right-click for menu"
                : toolMode === "eraser" ? "Click and drag to erase strokes"
                : toolMode === "text" ? "Click to place text · right-click for menu"
                : "Click to type · Paste · Scroll to zoom · Right-click for menu"}
            </p>
          </div>
        )}

        {placingShape && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm tracking-widest uppercase" style={{ color: t.selBorder }}>Click to place shape · Esc to cancel</p>
          </div>
        )}

        <div style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }}>
          {/* PDF blocks rendered first (bottom layer) */}
          {visibleBlocks.filter((b) => b.type === "pdf").map((block) => (
            <PDFBlock
              key={block.id}
              block={block}
              t={t}
              selected={selected.has(block.id)}
              onMouseDown={(e) => startBlockDrag(e, block.id)}
              onStartResize={(e) => startResize(e, block.id)}
              onHide={() => toggleHide(block.id)}
              onRemove={() => removeBlock(block.id)}
              onContextMenu={(e) => handleContextMenu(e, block.id)}
              onPageChange={updatePDFPage}
            />
          ))}

          {/* Non-draw, non-pdf blocks */}
          {visibleBlocks.filter((b) => b.type !== "pdf" && !(b.type === "shape" && b.content.startsWith("M"))).map((block) => (
            <BlockRenderer
              key={block.id}
              block={block}
              t={t}
              selected={selected.has(block.id) || findMatches.includes(block.id)}
              onMouseDown={(e) => startBlockDrag(e, block.id)}
              onStartResize={(e) => startResize(e, block.id)}
              onHide={() => toggleHide(block.id)}
              onRemove={() => removeBlock(block.id)}
              onPaste={(e) => handleBlockPaste(e, block.id)}
              onContentChange={(content) => updateContent(block.id, content)}
              onBlur={(content) => handleTextBlur(block.id, content)}
              onContextMenu={(e) => handleContextMenu(e, block.id)}
            />
          ))}

          {/* Draw strokes on top */}
          {visibleBlocks.filter((b) => b.type === "shape" && b.content.startsWith("M")).map((b) => (
            <svg key={b.id} className="absolute pointer-events-none" style={{ left: 0, top: 0, overflow: "visible", width: 1, height: 1 }}>
              <path d={b.content} stroke={b.stroke ?? selectedColor} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ))}
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-5 right-5 z-20 px-3 py-1.5 rounded-xl shadow-sm text-xs select-none" style={{ background: t.panel, border: `1px solid ${t.border}`, color: t.subtext }}>
          {Math.round(zoom * 100)}%
        </div>

        {showFind && (
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg" style={{ background: t.panel, border: `1px solid ${t.border}` }}>
            <input autoFocus value={findQuery} onChange={(e) => setFindQuery(e.target.value)} placeholder="Find in blocks..." className="outline-none bg-transparent text-sm w-44" style={{ color: t.text, userSelect: "text" }} />
            <span className="text-xs" style={{ color: t.subtext }}>{findMatches.length}</span>
            <button onClick={() => { setShowFind(false); setFindQuery(""); }} style={{ color: t.subtext }}><Trash2 size={13} /></button>
          </div>
        )}
      </div>

      {showShortcuts && <ShortcutsModal t={t} onClose={() => setShowShortcuts(false)} />}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          items={buildContextMenu()}
          t={t}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--ph, #c0b8ae); pointer-events: none; }
        .prose p { margin: 0.25em 0; }
        .prose h1, .prose h2, .prose h3 { margin: 0.4em 0 0.2em; }
        .prose ul, .prose ol { margin: 0.25em 0; padding-left: 1.2em; }
        .prose code { background: rgba(128,128,128,0.15); padding: 0.1em 0.3em; border-radius: 4px; font-size: 0.85em; }
        .prose pre { background: rgba(128,128,128,0.1); padding: 0.5em; border-radius: 6px; overflow-x: auto; }
        .prose blockquote { border-left: 3px solid #ff8c94; padding-left: 0.75em; margin: 0.25em 0; opacity: 0.8; }
      `}</style>
    </div>
  );
}