export interface FontOption {
  label: string;
  value: string;
}

export const FONT_FAMILIES: FontOption[] = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Comic Sans MS", value: "'Comic Sans MS', cursive" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Garamond", value: "Garamond, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Impact", value: "Impact, fantasy" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Merriweather", value: "'Merriweather', serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Open Sans", value: "'Open Sans', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
];

export const FONT_SIZES: string[] = [
  "8pt",
  "9pt",
  "10pt",
  "11pt",
  "12pt",
  "14pt",
  "18pt",
  "24pt",
  "30pt",
  "36pt",
  "48pt",
  "60pt",
  "72pt",
  "96pt",
];

export interface HeadingOption {
  label: string;
  tag: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  fontSize: string;
  fontWeight: string;
  isTitle?: boolean;
  isSubtitle?: boolean;
}

export const HEADING_STYLES: HeadingOption[] = [
  { label: "Normal text", tag: "p", fontSize: "11pt", fontWeight: "normal" },
  { label: "Title", tag: "h1", level: 1, fontSize: "26pt", fontWeight: "bold", isTitle: true },
  { label: "Subtitle", tag: "h2", level: 2, fontSize: "15pt", fontWeight: "500", isSubtitle: true },
  { label: "Heading 1", tag: "h1", level: 1, fontSize: "20pt", fontWeight: "400" },
  { label: "Heading 2", tag: "h2", level: 2, fontSize: "16pt", fontWeight: "400" },
  { label: "Heading 3", tag: "h3", level: 3, fontSize: "14pt", fontWeight: "500" },
];

export const LINE_HEIGHTS = [
  { label: "Single", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "Double", value: "2" },
];

export const GOOGLE_COLORS = [
  // Grayscale
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  // Row 1: Primary hues
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
  // Row 2: Light hues
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
  // Row 3: Medium-light hues
  "#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd",
  // Row 4: Medium hues
  "#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0",
  // Row 5: Deep hues
  "#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79",
  // Row 6: Dark hues
  "#5b0f00", "#660000", "#783f04", "#7f6000", "#274e13", "#0c343d", "#1155cc", "#073763", "#20124d", "#4c1130",
];

export const HIGHLIGHT_COLORS = [
  { label: "None", value: "" },
  { label: "Yellow", value: "#fff59d" },
  { label: "Green", value: "#c8e6c9" },
  { label: "Cyan", value: "#b2ebf2" },
  { label: "Magenta", value: "#f8bbd0" },
  { label: "Orange", value: "#ffe0b2" },
  { label: "Purple", value: "#e1bee7" },
  { label: "Blue", value: "#bbdefb" },
  { label: "Red", value: "#ffcdd2" },
  { label: "Gray", value: "#e0e0e0" },
];

export const PAGE_SIZES = {
  LETTER: {
    name: "Letter (8.5 × 11 in)",
    widthPx: 816, // 8.5 in * 96 DPI
    heightPx: 1056, // 11 in * 96 DPI
    widthInches: 8.5,
  },
  A4: {
    name: "A4 (210 × 297 mm)",
    widthPx: 794,
    heightPx: 1123,
    widthInches: 8.27,
  },
};
