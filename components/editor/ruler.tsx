"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface RulerProps {
  width?: number; // Total page width in px (default: 816px for US Letter)
  leftMargin?: number; // Left margin in px (default: 72px / 0.75 in)
  rightMargin?: number; // Right margin in px (default: 72px / 0.75 in)
  firstLineIndent?: number; // First line indent offset in px (default: 0px)
  onLeftMarginChange?: (margin: number) => void;
  onRightMarginChange?: (margin: number) => void;
  onFirstLineIndentChange?: (indent: number) => void;
  readOnly?: boolean;
  className?: string;
}

type DragHandle = "left-margin" | "right-margin" | "first-line-indent" | null;

export function Ruler({
  width = 816,
  leftMargin = 72,
  rightMargin = 72,
  firstLineIndent = 0,
  onLeftMarginChange,
  onRightMarginChange,
  onFirstLineIndentChange,
  readOnly = false,
  className,
}: RulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [activeHandle, setActiveHandle] = useState<DragHandle>(null);
  const [dragX, setDragX] = useState<number | null>(null);

  // 96 px = 1 inch
  const pixelsPerInch = 96;
  const totalInches = width / pixelsPerInch;

  // Handle pointer drag
  const handlePointerDown = (handle: DragHandle, e: React.PointerEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveHandle(handle);

    if (rulerRef.current) {
      const rect = rulerRef.current.getBoundingClientRect();
      setDragX(e.clientX - rect.left);
    }
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeHandle || !rulerRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(width, e.clientX - rect.left));
      setDragX(currentX);

      const minMargin = 18; // 0.1875 in
      const maxMargin = width / 2 - 20;

      if (activeHandle === "left-margin") {
        const newLeft = Math.max(minMargin, Math.min(maxMargin, Math.round(currentX)));
        onLeftMarginChange?.(newLeft);
      } else if (activeHandle === "right-margin") {
        const newRight = Math.max(minMargin, Math.min(maxMargin, Math.round(width - currentX)));
        onRightMarginChange?.(newRight);
      } else if (activeHandle === "first-line-indent") {
        const indentOffset = Math.round(currentX - leftMargin);
        const clampedIndent = Math.max(-leftMargin + minMargin, Math.min(200, indentOffset));
        onFirstLineIndentChange?.(clampedIndent);
      }
    },
    [activeHandle, width, leftMargin, onLeftMarginChange, onRightMarginChange, onFirstLineIndentChange]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (activeHandle) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      setActiveHandle(null);
      setDragX(null);
    }
  }, [activeHandle]);

  // Generate Inch and Sub-inch ticks
  const ticks = [];
  const eighthInches = Math.floor((width / pixelsPerInch) * 8);

  for (let i = 0; i <= eighthInches; i++) {
    const x = (i * pixelsPerInch) / 8;
    if (x > width) break;

    const isInch = i % 8 === 0;
    const isHalfInch = i % 4 === 0 && !isInch;
    const isQuarterInch = i % 2 === 0 && !isHalfInch && !isInch;
    const inchNumber = i / 8;

    ticks.push(
      <div
        key={i}
        className="absolute top-0 flex flex-col items-center pointer-events-none"
        style={{ left: `${x}px` }}
      >
        {isInch ? (
          <>
            <div className="h-3 w-[1px] bg-neutral-400" />
            {inchNumber > 0 && inchNumber < totalInches && (
              <span className="text-[9px] font-medium text-neutral-600 select-none -translate-x-1/2 mt-0.5">
                {inchNumber}
              </span>
            )}
          </>
        ) : isHalfInch ? (
          <div className="h-2 w-[1px] bg-neutral-300" />
        ) : isQuarterInch ? (
          <div className="h-1.5 w-[1px] bg-neutral-300" />
        ) : (
          <div className="h-1 w-[1px] bg-neutral-200" />
        )}
      </div>
    );
  }

  const leftHandlePos = leftMargin;
  const firstLinePos = leftMargin + firstLineIndent;
  const rightHandlePos = width - rightMargin;

  return (
    <div className={cn("relative select-none no-print", className)}>
      <div
        ref={rulerRef}
        className="relative h-6 bg-[#f1f3f4] border-b border-neutral-300 overflow-visible mx-auto shadow-xs"
        style={{ width: `${width}px` }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Printable/Writable Page Canvas Region (White) */}
        <div
          className="absolute top-0 bottom-0 bg-white border-x border-neutral-300 pointer-events-none"
          style={{
            left: `${leftMargin}px`,
            width: `${width - leftMargin - rightMargin}px`,
          }}
        />

        {/* Ticks overlay */}
        <div className="absolute inset-0 pointer-events-none">{ticks}</div>

        {/* First Line Indent Handle (Rectangle) */}
        <div
          aria-label="First Line Indent"
          role="slider"
          aria-valuenow={firstLineIndent}
          className={cn(
            "absolute top-0 z-30 -translate-x-1/2 flex flex-col items-center group cursor-ew-resize",
            readOnly && "cursor-default pointer-events-none"
          )}
          style={{ left: `${firstLinePos}px` }}
          onPointerDown={(e) => handlePointerDown("first-line-indent", e)}
        >
          <div className="w-3 h-1.5 bg-[#1a73e8] rounded-t-xs hover:bg-[#1557b0] active:scale-110 transition-transform shadow-xs" />
          <div className="w-[1px] h-1.5 bg-[#1a73e8]" />
        </div>

        {/* Left Margin Handle (Downward Triangle) */}
        <div
          aria-label="Left Margin"
          role="slider"
          aria-valuenow={leftMargin}
          className={cn(
            "absolute top-2.5 z-20 -translate-x-1/2 flex flex-col items-center cursor-ew-resize group",
            readOnly && "cursor-default pointer-events-none"
          )}
          style={{ left: `${leftHandlePos}px` }}
          onPointerDown={(e) => handlePointerDown("left-margin", e)}
        >
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-[#1a73e8] group-hover:border-t-[#1557b0] transition-colors" />
        </div>

        {/* Right Margin Handle (Downward Triangle) */}
        <div
          aria-label="Right Margin"
          role="slider"
          aria-valuenow={rightMargin}
          className={cn(
            "absolute top-0 z-20 -translate-x-1/2 flex flex-col items-center cursor-ew-resize group",
            readOnly && "cursor-default pointer-events-none"
          )}
          style={{ left: `${rightHandlePos}px` }}
          onPointerDown={(e) => handlePointerDown("right-margin", e)}
        >
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-[#1a73e8] group-hover:border-t-[#1557b0] transition-colors" />
        </div>
      </div>

      {/* Vertical Guideline overlay when dragging handles */}
      {activeHandle && dragX !== null && (
        <div
          className="fixed top-0 bottom-0 w-[1px] border-l border-dashed border-[#1a73e8] pointer-events-none z-50 opacity-80"
          style={{
            left: `${(rulerRef.current?.getBoundingClientRect().left || 0) + dragX}px`,
          }}
        />
      )}
    </div>
  );
}
