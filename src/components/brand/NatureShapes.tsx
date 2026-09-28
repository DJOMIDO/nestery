// src/components/brand/NatureShapes.tsx
// Nature-style shapes (from shapes.gallery by Monika Michalczyk) arranged into
// decorative backgrounds. Layouts are seeded, so the server and the browser
// render the same picture and it stays the same on every visit.

import { cn } from "@/lib/utils";

const SIZE = 256;

// Each shape fills a 256×256 square
const SHAPES = {
  seeds:
    "M 60 136 C 93.137 136 120 162.863 120 196 C 120 229.137 93.137 256 60 256 C 26.863 256 0 229.137 0 196 C 0 162.863 26.863 136 60 136 Z M 196 136 C 229.137 136 256 162.863 256 196 C 256 229.137 229.137 256 196 256 C 162.863 256 136 229.137 136 196 C 136 162.863 162.863 136 196 136 Z M 128 104 C 141.255 104 152 114.745 152 128 C 152 141.255 141.255 152 128 152 C 114.745 152 104 141.255 104 128 C 104 114.745 114.745 104 128 104 Z M 60 0 C 93.137 0 120 26.863 120 60 C 120 93.137 93.137 120 60 120 C 26.863 120 0 93.137 0 60 C 0 26.863 26.863 0 60 0 Z M 196 0 C 229.137 0 256 26.863 256 60 C 256 93.137 229.137 120 196 120 C 162.863 120 136 93.137 136 60 C 136 26.863 162.863 0 196 0 Z",
  flower:
    "M 192 0 C 227.346 0 256 28.654 256 64 C 256 99.346 227.346 128 192 128 C 227.346 128 256 156.654 256 192 C 256 227.346 227.346 256 192 256 C 156.654 256 128 227.346 128 192 C 128 227.346 99.346 256 64 256 C 28.654 256 0 227.346 0 192 C 0 156.654 28.654 128 64 128 C 28.654 128 0 99.346 0 64 C 0 28.654 28.654 0 64 0 C 99.346 0 128 28.654 128 64 C 128 28.654 156.654 0 192 0 Z M 128 100 C 112.536 100 100 112.536 100 128 C 100 143.464 112.536 156 128 156 C 143.464 156 156 143.464 156 128 C 156 112.536 143.464 100 128 100 Z",
  rosette:
    "M 128 0 C 147.68 0 164.04 14.213 167.377 32.934 C 182.974 22.055 204.594 23.574 218.51 37.49 C 232.426 51.406 233.944 73.025 223.066 88.622 C 241.787 91.96 256 108.32 256 128 C 256 147.68 241.787 164.04 223.065 167.377 C 233.944 182.974 232.426 204.594 218.51 218.51 C 204.594 232.426 182.974 233.944 167.377 223.065 C 164.04 241.787 147.68 256 128 256 C 108.32 256 91.959 241.787 88.622 223.065 C 73.025 233.944 51.406 232.426 37.49 218.51 C 23.574 204.594 22.055 182.974 32.934 167.377 C 14.213 164.04 0 147.68 0 128 C 0 108.32 14.213 91.96 32.934 88.622 C 22.056 73.025 23.574 51.406 37.49 37.49 C 51.406 23.574 73.025 22.055 88.622 32.934 C 91.96 14.213 108.32 0 128 0 Z",
  sprout:
    "M 28 0 C 83.228 0 128 44.772 128 100 C 128 44.772 172.772 0 228 0 L 256 0 L 256 156 C 256 211.228 211.228 256 156 256 L 100 256 C 44.772 256 0 211.228 0 156 L 0 0 Z",
  pinwheel:
    "M 128 128 C 128 198.692 70.692 256 0 256 C 0 185.308 57.308 128 128 128 Z M 128 128 C 198.692 128 256 185.308 256 256 C 185.308 256 128 198.692 128 128 Z M 0 0 C 70.692 0 128 57.308 128 128 C 57.308 128 0 70.692 0 0 Z M 256 0 C 256 70.692 198.692 128 128 128 C 128 57.308 185.308 0 256 0 Z",
  quatrefoil:
    "M 78 0 C 105.614 0 128 22.386 128 50 C 128 22.386 150.386 0 178 0 L 256 0 L 256 78 C 256 105.614 233.614 128 206 128 C 233.614 128 256 150.386 256 178 L 256 256 L 178 256 C 150.386 256 128 233.614 128 206 C 128 233.614 105.614 256 78 256 L 0 256 L 0 178 C 0 150.386 22.386 128 50 128 C 22.386 128 0 105.614 0 78 L 0 0 Z",
};

const SHAPE_PATHS = Object.values(SHAPES);

// Theme tokens, so the pattern follows light and dark mode
const COLORS = [
  "var(--forest)",
  "var(--moss)",
  "var(--leaf)",
  "var(--bark)",
  "var(--leaf-soft)",
  "var(--bark-soft)",
];

// Small seeded PRNG (mulberry32): same seed, same sequence, on server and client
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rounded so server and client print identical attribute strings
const r2 = (n: number) => Math.round(n * 100) / 100;

const svgProps = {
  "aria-hidden": true,
  focusable: false,
  preserveAspectRatio: "xMidYMid slice",
} as const;

interface NatureGridProps {
  seed: number;
  cols: number;
  rows: number;
  // Fills to pick from (at least 3, so neighbors can always differ);
  // defaults to the forest palette
  colors?: string[];
  className?: string;
}

// Every cell holds one shape. Neighbors never share a shape or a color, and
// each shape is turned by a quarter turn at random.
export function NatureGrid({ seed, cols, rows, colors: palette = COLORS, className }: NatureGridProps) {
  const next = random(seed);
  const pick = (count: number, avoid: number[]) => {
    let i = Math.floor(next() * count);
    while (avoid.includes(i)) i = (i + 1) % count;
    return i;
  };

  const gap = 24;
  const pitch = SIZE + gap;
  const shapes: number[][] = [];
  const colors: number[][] = [];
  const cells = [];

  for (let row = 0; row < rows; row++) {
    shapes.push([]);
    colors.push([]);
    for (let col = 0; col < cols; col++) {
      const neighbors = (grid: number[][]) =>
        [grid[row][col - 1], grid[row - 1]?.[col]].filter((n) => n !== undefined);
      const shape = pick(SHAPE_PATHS.length, neighbors(shapes));
      const color = pick(palette.length, neighbors(colors));
      shapes[row].push(shape);
      colors[row].push(color);
      const turn = Math.floor(next() * 4) * 90;
      cells.push(
        <path
          key={`${row}-${col}`}
          d={SHAPE_PATHS[shape]}
          fill={palette[color]}
          transform={`translate(${col * pitch} ${row * pitch}) rotate(${turn} ${SIZE / 2} ${SIZE / 2})`}
        />
      );
    }
  }

  return (
    <svg
      {...svgProps}
      viewBox={`${-gap / 2} ${-gap / 2} ${cols * pitch} ${rows * pitch}`}
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      {cells}
    </svg>
  );
}

const SCATTER_W = 1600;
const SCATTER_H = 1000;
// The middle stays empty for the page's text
const CLEAR = { x1: 380, x2: 1220, y1: 230, y2: 770 };

// Shapes of mixed sizes and angles around the edges, leaving the center clear
export function NatureScatter({ seed, count = 14, className }: { seed: number; count?: number; className?: string }) {
  const next = random(seed);
  const placed: { x: number; y: number; size: number }[] = [];
  const shapes = [];

  for (let attempt = 0; attempt < 400 && placed.length < count; attempt++) {
    const size = 60 + next() * 200;
    const x = next() * SCATTER_W;
    const y = next() * SCATTER_H;
    const half = size / 2;
    const inCenter =
      x + half > CLEAR.x1 && x - half < CLEAR.x2 && y + half > CLEAR.y1 && y - half < CLEAR.y2;
    // Allow a little overlap, never a pile-up
    const crowded = placed.some(
      (p) => Math.hypot(p.x - x, p.y - y) < (p.size + size) * 0.45
    );
    if (inCenter || crowded) continue;

    placed.push({ x, y, size });
    const path = SHAPE_PATHS[Math.floor(next() * SHAPE_PATHS.length)];
    const color = COLORS[Math.floor(next() * COLORS.length)];
    const angle = Math.floor(next() * 360);
    shapes.push(
      <path
        key={placed.length}
        d={path}
        fill={color}
        transform={`translate(${r2(x - half)} ${r2(y - half)}) scale(${r2(size / SIZE)}) rotate(${angle} ${SIZE / 2} ${SIZE / 2})`}
      />
    );
  }

  return (
    <svg
      {...svgProps}
      viewBox={`0 0 ${SCATTER_W} ${SCATTER_H}`}
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      {shapes}
    </svg>
  );
}

// Small logo: the rosette in the leaf color
export function NesteryMark({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden focusable={false} className={cn("size-7", className)}>
      <path d={SHAPES.rosette} fill="var(--leaf)" />
    </svg>
  );
}
