export interface Block {
  id: number;
  type: "text" | "image" | "shape" | "pdf";
  content: string;
  x: number; y: number;
  width: number; height?: number;
  hidden: boolean;
  createdAt: number;
  // text formatting
  italic?: boolean; underline?: boolean; fontSize?: number; color?: string;
  // shape
  shapeType?: "rect" | "circle" | "triangle" | "line" | "arrow";
  fill?: string; stroke?: string;
  // pdf
  pdfName?: string; pdfPage?: number; pdfTotalPages?: number;
}

export interface CanvasFile {
  id: string;
  name: string;
  blocks: Block[];
  zoom: number;
  pan: { x: number; y: number };
  updatedAt: number;
}

export interface Theme {
  bg: string; panel: string; border: string;
  text: string; subtext: string; hover: string;
  toolbar: string; dot: string; placeholder: string;
  selBorder: string;
}

export const LIGHT: Theme = {
  bg: "#fdf5e6", panel: "#ffffff", border: "#ede8e0",
  text: "#111111", subtext: "#888888", hover: "#f5f2ee",
  toolbar: "#ffffff", dot: "#c7bfb5", placeholder: "#c0b8ae",
  selBorder: "#ff8c94",
};

export const DARK: Theme = {
  bg: "#141414", panel: "#1e1e1e", border: "#2e2e2e",
  text: "#f0ece4", subtext: "#777777", hover: "#272727",
  toolbar: "#252525", dot: "#333333", placeholder: "#444444",
  selBorder: "#ff8c94",
};
