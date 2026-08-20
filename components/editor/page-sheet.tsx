"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface PageSheetProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number; // In px, default 816 (US Letter)
  minHeight?: number; // In px, default 1056 (US Letter)
  leftMargin?: number; // In px, default 72
  rightMargin?: number; // In px, default 72
  topMargin?: number; // In px, default 72
  bottomMargin?: number; // In px, default 72
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
  pageNumber?: number;
  totalPages?: number;
  showPageNumbers?: boolean;
  children?: React.ReactNode;
}

export const PageSheet = forwardRef<HTMLDivElement, PageSheetProps>(
  (
    {
      width = 816,
      minHeight = 1056,
      leftMargin = 72,
      rightMargin = 72,
      topMargin = 72,
      bottomMargin = 72,
      headerContent,
      footerContent,
      pageNumber,
      totalPages,
      showPageNumbers = false,
      children,
      className,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <div className="docs-page-container flex flex-col items-center justify-start w-full min-h-full py-8 bg-[#f9fbfd] transition-colors select-text">
        <div
          ref={ref}
          className={cn(
            "docs-page relative bg-white text-[#202124] transition-shadow duration-200 ease-in-out",
            "shadow-[0_1px_3px_1px_rgba(60,64,67,0.15),0_1px_2px_0_rgba(60,64,67,0.30)]",
            "hover:shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),0_1px_2px_0_rgba(60,64,67,0.30)]",
            "border border-[#dadce0]/60 rounded-[2px]",
            "print:shadow-none print:border-none print:m-0 print:w-full print:rounded-none",
            className
          )}
          style={{
            width: `${width}px`,
            minHeight: `${minHeight}px`,
            paddingLeft: `${leftMargin}px`,
            paddingRight: `${rightMargin}px`,
            paddingTop: `${topMargin}px`,
            paddingBottom: `${bottomMargin}px`,
            ...style,
          }}
          {...props}
        >
          {/* Optional Header Area */}
          {headerContent && (
            <div
              className="absolute left-0 right-0 top-0 text-xs text-neutral-400 select-none flex items-center justify-between no-print px-12 h-14"
              style={{
                paddingLeft: `${leftMargin}px`,
                paddingRight: `${rightMargin}px`,
              }}
            >
              {headerContent}
            </div>
          )}

          {/* Main Document Content Canvas */}
          <div className="relative w-full h-full min-h-[900px]">
            {children}
          </div>

          {/* Optional Footer Area / Page Number */}
          {(footerContent || showPageNumbers) && (
            <div
              className="absolute left-0 right-0 bottom-0 text-xs text-neutral-400 select-none flex items-center justify-between no-print px-12 h-14"
              style={{
                paddingLeft: `${leftMargin}px`,
                paddingRight: `${rightMargin}px`,
              }}
            >
              <div>{footerContent}</div>
              {showPageNumbers && pageNumber && (
                <div className="ml-auto text-neutral-500 font-mono text-[11px]">
                  {pageNumber} {totalPages ? `/ ${totalPages}` : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

PageSheet.displayName = "PageSheet";
