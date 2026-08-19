import React, { useState, useRef, useEffect, useCallback } from 'react';
import { calculateDragConstraints, DPI } from '../tools/ruler.js';

/**
 * Interactive Horizontal Ruler Component for Google Docs.
 * 
 * Features:
 * - 8.5" US Letter standard width (816px at 96 DPI)
 * - Inch subdivisions and numbering (0 to 8 inches)
 * - Shaded non-printable margin zones
 * - Draggable Left Margin Marker (upward triangle + rectangle)
 * - Draggable First-Line Indent Marker (downward triangle)
 * - Draggable Right Margin Marker (downward triangle)
 * - Vertical guideline feedback during dragging
 */
export default function Ruler({
  pageWidth = 816, // 8.5 inches at 96 DPI
  leftMargin = 72, // 0.75 in default
  rightMargin = 72,
  firstLineIndent = 0,
  onMarginsChange,
  isReadOnly = false
}) {
  const [activeDrag, setActiveDrag] = useState(null); // 'left' | 'firstLine' | 'right'
  const [dragX, setDragX] = useState(null);
  const rulerRef = useRef(null);

  // Total inches based on width
  const totalInches = Math.floor(pageWidth / DPI); // 8.5 -> 8 major ticks

  const handleMouseDown = (markerType, e) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveDrag(markerType);
    setDragX(e.clientX);
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!activeDrag || !rulerRef.current) return;

      const rect = rulerRef.current.getBoundingClientRect();
      const currentFirstLine = leftMargin + firstLineIndent;

      const result = calculateDragConstraints({
        markerType: activeDrag,
        clientX: e.clientX,
        rulerRect: { width: pageWidth, left: rect.left },
        currentLeft: leftMargin,
        currentFirstLine: currentFirstLine,
        currentRight: rightMargin,
        minContentWidth: 96,
        snap: true,
        snapStep: 6 // 1/16 in
      });

      if (onMarginsChange) {
        onMarginsChange({
          left: result.leftMargin,
          right: result.rightMargin,
          firstLineIndent: result.firstLineIndentOffset
        });
      }

      setDragX(e.clientX);
    },
    [activeDrag, leftMargin, rightMargin, firstLineIndent, pageWidth, onMarginsChange]
  );

  const handleMouseUp = useCallback(() => {
    if (activeDrag) {
      setActiveDrag(null);
      setDragX(null);
    }
  }, [activeDrag]);

  useEffect(() => {
    if (activeDrag) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [activeDrag, handleMouseMove, handleMouseUp]);

  // Generate tick marks (1/16 in = 6px)
  const ticks = [];
  const totalTicks = Math.floor(pageWidth / 6);

  for (let i = 0; i <= totalTicks; i++) {
    const px = i * 6;
    if (px > pageWidth) break;

    const isMajor = i % 16 === 0; // Every 1 inch (96px)
    const isHalf = i % 8 === 0 && !isMajor; // 0.5 in (48px)
    const isQuarter = i % 4 === 0 && !isMajor && !isHalf; // 0.25 in (24px)
    const isEighth = i % 2 === 0 && !isMajor && !isHalf && !isQuarter;

    let height = '3px';
    if (isMajor) height = '9px';
    else if (isHalf) height = '7px';
    else if (isQuarter) height = '5px';
    else if (isEighth) height = '4px';

    const inchIndex = i / 16;

    ticks.push(
      <div
        key={i}
        className="absolute bottom-0"
        style={{ left: `${px}px` }}
      >
        <div
          className={`w-[1px] ${
            isMajor
              ? 'bg-[#5f6368] dark:bg-[#8e918f]'
              : 'bg-[#9aa0a6] dark:bg-[#5f6368]'
          }`}
          style={{ height }}
        />
        {isMajor && inchIndex > 0 && inchIndex < totalInches + 1 && (
          <span
            className="absolute -top-3.5 -left-1.5 text-[9px] font-medium text-[#5f6368] dark:text-[#8e918f] pointer-events-none select-none"
          >
            {inchIndex}
          </span>
        )}
      </div>
    );
  }

  const firstLineMarkerPos = leftMargin + firstLineIndent;
  const rightMarkerPos = pageWidth - rightMargin;

  return (
    <div className="relative mx-auto select-none" style={{ width: `${pageWidth}px` }}>
      {/* Ruler Track */}
      <div
        ref={rulerRef}
        className="h-[18px] bg-[#f1f3f4] dark:bg-[#1e1f20] border-b border-[#dadce0] dark:border-[#444746] relative overflow-hidden flex items-end"
      >
        {/* Left Shaded Margin Zone */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-[#e8eaed] dark:bg-[#282a2c] pointer-events-none transition-all"
          style={{ width: `${leftMargin}px` }}
        />

        {/* Right Shaded Margin Zone */}
        <div
          className="absolute top-0 bottom-0 right-0 bg-[#e8eaed] dark:bg-[#282a2c] pointer-events-none transition-all"
          style={{ width: `${rightMargin}px` }}
        />

        {/* Render Tick Marks */}
        {ticks}

        {/* 1. First-Line Indent Marker (Downward rectangle/triangle at top) */}
        <div
          onMouseDown={(e) => handleMouseDown('firstLine', e)}
          className="absolute top-0 cursor-ew-resize z-20 group"
          style={{ left: `${firstLineMarkerPos}px`, transform: 'translateX(-50%)' }}
          title={`First Line Indent: ${(firstLineIndent / DPI).toFixed(2)}"`}
        >
          {/* Top Rectangle */}
          <div className="w-3 h-1.5 bg-[#1a73e8] dark:bg-[#8ab4f8] shadow-sm rounded-t-sm" />
          {/* Downward pointing triangle */}
          <div
            className="w-0 h-0 mx-auto"
            style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #1a73e8'
            }}
          />
        </div>

        {/* 2. Left Margin Marker (Bottom triangle + rectangle) */}
        <div
          onMouseDown={(e) => handleMouseDown('left', e)}
          className="absolute bottom-0 cursor-ew-resize z-10 group"
          style={{ left: `${leftMargin}px`, transform: 'translateX(-50%)' }}
          title={`Left Margin: ${(leftMargin / DPI).toFixed(2)}"`}
        >
          {/* Upward pointing triangle */}
          <div
            className="w-0 h-0 mx-auto"
            style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: '5px solid #1a73e8'
            }}
          />
          {/* Bottom Rectangle */}
          <div className="w-3 h-1.5 bg-[#1a73e8] dark:bg-[#8ab4f8] shadow-sm rounded-b-sm" />
        </div>

        {/* 3. Right Margin Marker (Downward triangle at bottom) */}
        <div
          onMouseDown={(e) => handleMouseDown('right', e)}
          className="absolute bottom-0 cursor-ew-resize z-10 group"
          style={{ left: `${rightMarkerPos}px`, transform: 'translateX(-50%)' }}
          title={`Right Margin: ${(rightMargin / DPI).toFixed(2)}"`}
        >
          {/* Upward pointing triangle */}
          <div
            className="w-0 h-0 mx-auto"
            style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: '6px solid #1a73e8'
            }}
          />
          <div className="w-3 h-1 bg-[#1a73e8] dark:bg-[#8ab4f8] shadow-sm rounded-b-sm" />
        </div>
      </div>

      {/* Visual Vertical Guideline on Canvas during Active Drag */}
      {activeDrag && (
        <div
          className="absolute top-[18px] bottom-[-1100px] w-[1px] border-l border-dashed border-[#1a73e8] pointer-events-none z-30 opacity-70"
          style={{
            left: `${
              activeDrag === 'left'
                ? leftMargin
                : activeDrag === 'firstLine'
                ? firstLineMarkerPos
                : rightMarkerPos
            }px`
          }}
        />
      )}
    </div>
  );
}
