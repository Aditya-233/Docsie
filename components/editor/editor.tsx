"use client";

import "@/lib/editor/types";
import "./remote-caret.css";

import React, { useEffect, useState, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import type * as Y from "yjs";

import { FontSize } from "@/lib/editor/font-size";
import { LineHeight } from "@/lib/editor/line-height";
import { Indent } from "@/lib/editor/indent";
import { PAGE_SIZES } from "@/lib/editor/constants";
import { Toolbar } from "./toolbar";
import { Ruler } from "./ruler";
import { PageSheet } from "./page-sheet";
import { cn } from "@/lib/utils";

export interface EditorUser {
    name: string;
    color: string;
    avatar?: string;
}

export interface DocumentMargins {
    left: number; // in px
    right: number; // in px
    top?: number;
    bottom?: number;
    firstLineIndent?: number; // in px offset
}

export interface EditorProps {
    docId?: string;
    ydoc?: Y.Doc | null;
    provider?: any;
    user?: EditorUser;
    role?: "viewer" | "editor" | "owner" | "admin";
    initialContent?: string | Record<string, any>;
    onUpdate?: (content: Record<string, any>, html: string) => void;
    showToolbar?: boolean;
    showRuler?: boolean;
    pageFormat?: "LETTER" | "A4";
    margins?: DocumentMargins;
    onMarginsChange?: (margins: DocumentMargins) => void;
    headerContent?: React.ReactNode;
    footerContent?: React.ReactNode;
    onEditorReady?: (editor: any) => void;
    className?: string;
    editorClassName?: string;
}

export function Editor({
    ydoc,
    provider,
    user = { name: "Anonymous", color: "#1a73e8" },
    role = "editor",
    initialContent,
    onUpdate,
    onEditorReady,
    showToolbar = true,
    showRuler = true,
    pageFormat = "LETTER",
    margins: controlledMargins,
    onMarginsChange,
    headerContent,
    footerContent,
    className,
    editorClassName,
}: EditorProps) {
    const isViewer = role === "viewer";

    // Internal margins state with fallbacks
    const [internalMargins, setInternalMargins] = useState<DocumentMargins>({
        left: controlledMargins?.left ?? 72,
        right: controlledMargins?.right ?? 72,
        top: controlledMargins?.top ?? 72,
        bottom: controlledMargins?.bottom ?? 72,
        firstLineIndent: controlledMargins?.firstLineIndent ?? 0,
    });

    const margins = controlledMargins || internalMargins;

    const handleLeftMarginChange = (left: number) => {
        const next = { ...margins, left };
        setInternalMargins(next);
        onMarginsChange?.(next);
    };

    const handleRightMarginChange = (right: number) => {
        const next = { ...margins, right };
        setInternalMargins(next);
        onMarginsChange?.(next);
    };

    const handleFirstLineIndentChange = (firstLineIndent: number) => {
        const next = { ...margins, firstLineIndent };
        setInternalMargins(next);
        onMarginsChange?.(next);
    };

    // Dimensions
    const pageDimension = pageFormat === "A4" ? PAGE_SIZES.A4 : PAGE_SIZES.LETTER;

    // Build extension array based on collaboration setup
    const extensions = useMemo(() => {
        const list: any[] = [
            // Base StarterKit without history when Yjs collaboration is enabled
            StarterKit.configure({
                history: ydoc ? false : undefined,
            }),

            // Document formatting extensions
            TextStyle,
            Color,
            Highlight.configure({
                multicolor: true,
            }),
            FontFamily,
            Underline,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-[#1a73e8] underline cursor-pointer hover:text-[#1557b0]",
                },
            }),

            // Custom Google Docs extensions
            FontSize,
            LineHeight,
            Indent,

            // Tables
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: "docs-table",
                },
            }),
            TableRow,
            TableHeader,
            TableCell,

            // Rich Media & Task Lists
            Image.configure({
                inline: true,
                allowBase64: true,
                HTMLAttributes: {
                    class: "docs-image max-w-full rounded-sm my-2",
                },
            }),
            TaskList.configure({
                HTMLAttributes: {
                    class: "docs-task-list list-none pl-2 space-y-1",
                },
            }),
            TaskItem.configure({
                nested: true,
                HTMLAttributes: {
                    class: "flex items-start gap-2",
                },
            }),
        ];

        // Collaboration Extension
        if (ydoc) {
            list.push(
                Collaboration.configure({
                    document: ydoc,
                })
            );

            // Collaboration Cursor Extension (if provider is present)
            if (provider) {
                list.push(
                    CollaborationCursor.configure({
                        provider,
                        user: {
                            name: user.name || "Anonymous",
                            color: user.color || "#1a73e8",
                            avatar: user.avatar,
                        },
                        render(user: Record<string, any>) {
                            const cursor = document.createElement("span");
                            cursor.classList.add("collaboration-cursor__caret");
                            const userColor = user.color || "#1a73e8";
                            cursor.setAttribute("style", `border-color: ${userColor}; color: ${userColor}`);

                            const label = document.createElement("div");
                            label.classList.add("collaboration-cursor__label");
                            label.setAttribute("style", `background-color: ${userColor}`);
                            label.insertBefore(document.createTextNode(user.name || "Collaborator"), null);
                            cursor.insertBefore(label, null);

                            return cursor;
                        },
                    })
                );
            }
        }

        return list;
    }, [ydoc, provider, user.name, user.color, user.avatar]);

    // Mount Tiptap Editor
    const editor = useEditor({
        immediatelyRender: false,
        editable: !isViewer,
        extensions,
        content: ydoc ? undefined : initialContent || "<p>Start typing...</p>",
        onUpdate: ({ editor: currentEditor }) => {
            if (onUpdate) {
                onUpdate(currentEditor.getJSON(), currentEditor.getHTML());
            }
        },
        editorProps: {
            attributes: {
                class: cn(
                    "ProseMirror focus:outline-none min-h-[900px] w-full",
                    editorClassName
                ),
            },
        },
    });

    // Notify parent of editor instance
    useEffect(() => {
        if (editor && !editor.isDestroyed && onEditorReady) {
            onEditorReady(editor);
        }
    }, [editor, onEditorReady]);

    // Sync editable status when role changes
    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            editor.setEditable(!isViewer);
        }
    }, [editor, isViewer]);

    // Sync user info in collaboration cursor if provider & editor active
    useEffect(() => {
        if (editor && provider && user) {
            const cursorExtension = editor.extensionManager.extensions.find(
                (ext) => ext.name === "collaborationCursor"
            );
            if (cursorExtension) {
                cursorExtension.options.user = {
                    name: user.name,
                    color: user.color,
                    avatar: user.avatar,
                };
            }
            if (typeof provider.setUser === "function") {
                provider.setUser({
                    name: user.name,
                    color: user.color,
                    avatar: user.avatar,
                });
            } else if (provider.awareness) {
                provider.awareness.setLocalStateField("user", {
                    name: user.name,
                    color: user.color,
                    avatar: user.avatar,
                });
            }
        }
    }, [editor, provider, user]);

    return (
        <div className={cn("flex flex-col w-full min-h-screen bg-[#f9fbfd]", className)}>
            {/* Top Google Docs Toolbar */}
            {showToolbar && (
                <Toolbar editor={editor} readOnly={isViewer} />
            )}

            {/* Interactive Ruler */}
            {showRuler && (
                <Ruler
                    width={pageDimension.widthPx}
                    leftMargin={margins.left}
                    rightMargin={margins.right}
                    firstLineIndent={margins.firstLineIndent ?? 0}
                    onLeftMarginChange={handleLeftMarginChange}
                    onRightMarginChange={handleRightMarginChange}
                    onFirstLineIndentChange={handleFirstLineIndentChange}
                    readOnly={isViewer}
                />
            )}

            {/* Paginated Sheet View */}
            <div className="flex-1 w-full overflow-y-auto">
                <PageSheet
                    width={pageDimension.widthPx}
                    minHeight={pageDimension.heightPx}
                    leftMargin={margins.left}
                    rightMargin={margins.right}
                    topMargin={margins.top ?? 72}
                    bottomMargin={margins.bottom ?? 72}
                    headerContent={headerContent}
                    footerContent={footerContent}
                >
                    <EditorContent editor={editor} />
                </PageSheet>
            </div>
        </div>
    );
}

export default Editor;
