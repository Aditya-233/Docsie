import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Packer,
  AlignmentType,
  UnderlineType,
} from "docx";

export interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{
    type: string;
    attrs?: Record<string, any>;
  }>;
}

function parseMarks(marks?: Array<{ type: string; attrs?: Record<string, any> }>) {
  let bold = false;
  let italics = false;
  let underline = false;
  let strike = false;
  let font = "Arial";
  let color: string | undefined = undefined;
  let highlight: string | undefined = undefined;

  if (marks) {
    for (const mark of marks) {
      if (mark.type === "bold") bold = true;
      if (mark.type === "italic") italics = true;
      if (mark.type === "underline") underline = true;
      if (mark.type === "strike") strike = true;
      if (mark.type === "textStyle" && mark.attrs?.color) {
        color = mark.attrs.color.replace("#", "");
      }
      if (mark.type === "highlight") {
        highlight = mark.attrs?.color || "yellow";
      }
      if (mark.type === "fontFamily" && mark.attrs?.fontFamily) {
        font = mark.attrs.fontFamily;
      }
    }
  }

  return { bold, italics, underline, strike, color, highlight, font };
}

function processInlineContent(nodes?: TiptapNode[]): TextRun[] {
  if (!nodes || nodes.length === 0) return [];
  const runs: TextRun[] = [];

  for (const node of nodes) {
    if (node.type === "text" && node.text) {
      const { bold, italics, underline, strike, color, font } = parseMarks(node.marks);
      runs.push(
        new TextRun({
          text: node.text,
          bold,
          italics,
          strike,
          underline: underline ? { type: UnderlineType.SINGLE } : undefined,
          color,
          font,
          size: 22, // 11pt in half-points
        })
      );
    } else if (node.type === "hardBreak") {
      runs.push(new TextRun({ break: 1 }));
    }
  }

  return runs;
}

function convertNodeToDocx(node: TiptapNode): (Paragraph | Table)[] {
  switch (node.type) {
    case "heading": {
      const level = node.attrs?.level || 1;
      let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1;
      let size = 32; // 16pt

      if (level === 2) {
        headingLevel = HeadingLevel.HEADING_2;
        size = 26; // 13pt
      } else if (level === 3) {
        headingLevel = HeadingLevel.HEADING_3;
        size = 24; // 12pt
      } else if (level >= 4) {
        headingLevel = HeadingLevel.HEADING_4;
        size = 22; // 11pt
      }

      const runs = processInlineContent(node.content);
      return [
        new Paragraph({
          heading: headingLevel,
          spacing: { before: 200, after: 120 },
          children: runs.map(
            (r) =>
              new TextRun({
                text: (r as any).text,
                bold: true,
                size,
                font: "Arial",
              })
          ),
        }),
      ];
    }

    case "paragraph": {
      const runs = processInlineContent(node.content);
      const alignAttr = node.attrs?.textAlign;
      let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
      if (alignAttr === "center") alignment = AlignmentType.CENTER;
      if (alignAttr === "right") alignment = AlignmentType.RIGHT;
      if (alignAttr === "justify") alignment = AlignmentType.JUSTIFIED;

      return [
        new Paragraph({
          alignment,
          spacing: { after: 120, line: 276 }, // 1.15 line spacing
          children: runs.length > 0 ? runs : [new TextRun("")],
        }),
      ];
    }

    case "bulletList": {
      const paragraphs: Paragraph[] = [];
      if (node.content) {
        for (const listItem of node.content) {
          if (listItem.content) {
            for (const child of listItem.content) {
              paragraphs.push(
                new Paragraph({
                  bullet: { level: 0 },
                  spacing: { after: 80 },
                  children: processInlineContent(child.content),
                })
              );
            }
          }
        }
      }
      return paragraphs;
    }

    case "orderedList": {
      const paragraphs: Paragraph[] = [];
      if (node.content) {
        let index = 1;
        for (const listItem of node.content) {
          if (listItem.content) {
            for (const child of listItem.content) {
              paragraphs.push(
                new Paragraph({
                  numbering: { reference: "default-numbering", level: 0 },
                  spacing: { after: 80 },
                  children: [
                    new TextRun({ text: `${index}.  `, bold: true }),
                    ...processInlineContent(child.content),
                  ],
                })
              );
              index++;
            }
          }
        }
      }
      return paragraphs;
    }

    case "blockquote": {
      const paragraphs: Paragraph[] = [];
      if (node.content) {
        for (const child of node.content) {
          paragraphs.push(
            new Paragraph({
              indent: { left: 720 },
              spacing: { before: 100, after: 100 },
              children: [
                new TextRun({
                  italics: true,
                  color: "555555",
                  text: child.content ? child.content.map((c) => c.text || "").join("") : "",
                }),
              ],
            })
          );
        }
      }
      return paragraphs;
    }

    case "codeBlock": {
      const codeText = node.content?.map((c) => c.text || "").join("") || "";
      return [
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({
              text: codeText,
              font: "Courier New",
              size: 20,
              color: "333333",
            }),
          ],
        }),
      ];
    }

    case "table": {
      if (!node.content) return [];
      const rows: TableRow[] = [];

      for (const rowNode of node.content) {
        const cells: TableCell[] = [];
        if (rowNode.content) {
          for (const cellNode of rowNode.content) {
            const cellChildren: Paragraph[] = [];
            if (cellNode.content) {
              for (const child of cellNode.content) {
                cellChildren.push(
                  new Paragraph({
                    children: processInlineContent(child.content),
                  })
                );
              }
            }
            if (cellChildren.length === 0) {
              cellChildren.push(new Paragraph({ children: [new TextRun("")] }));
            }

            cells.push(
              new TableCell({
                children: cellChildren,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                },
              })
            );
          }
        }
        rows.push(new TableRow({ children: cells }));
      }

      return [
        new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      ];
    }

    default: {
      if (node.content) {
        return node.content.flatMap(convertNodeToDocx);
      }
      return [];
    }
  }
}

export async function generateDocxBlob(tiptapJson: any, title = "Untitled Document"): Promise<Blob> {
  let docxElements: (Paragraph | Table)[] = [];

  if (tiptapJson && tiptapJson.content) {
    for (const node of tiptapJson.content) {
      docxElements.push(...convertNodeToDocx(node));
    }
  }

  if (docxElements.length === 0) {
    docxElements = [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 36 })],
      }),
    ];
  }

  const doc = new Document({
    title,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch = 1440 twips
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: docxElements,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

export async function generateDocxBuffer(tiptapJson: any, title = "Untitled Document"): Promise<Buffer> {
  let docxElements: (Paragraph | Table)[] = [];

  if (tiptapJson && tiptapJson.content) {
    for (const node of tiptapJson.content) {
      docxElements.push(...convertNodeToDocx(node));
    }
  }

  if (docxElements.length === 0) {
    docxElements = [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 36 })],
      }),
    ];
  }

  const doc = new Document({
    title,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: docxElements,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

import { downloadBlob } from "../utils";

export async function downloadDocx(
  tiptapJson: any,
  filename = "document.docx"
): Promise<void> {
  const blob = await generateDocxBlob(tiptapJson, filename.replace(/\.docx$/i, ""));
  downloadBlob(blob, filename.endsWith(".docx") ? filename : `${filename}.docx`);
}
