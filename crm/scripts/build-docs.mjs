// マニュアル・設計書を Word(.docx) で生成し、LibreOffice で PDF に変換する。
//   node scripts/build-docs.mjs   → docs/*.docx, docs/*.pdf と public/docs/ へのコピー
// 内容は scripts/docs-content.mjs を編集して再実行する（Word 側で直接編集してもよい）。
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MANUAL, DESIGN } from "./docs-content.mjs";

const require = createRequire(import.meta.url);
let docx;
try { docx = require("docx"); } catch { docx = require("/opt/node-tools/node_modules/docx"); }
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, ImageRun, AlignmentType, LevelFormat, PageBreak, BorderStyle, Footer, PageNumber, Header } = docx;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "docs");
const NAVY = "1F3A5F", GRAY = "54565E", LINE = "D4D3CE";
const W = 9638; // A4 本文幅（DXA）= 21cm - 余白 2cm×2

function png(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), data: b };
}

function build(doc, font) {
  const run = (t, o = {}) => new TextRun({ text: t, font, ...o });
  // **強調** を太字に変換
  const rich = (text, o = {}) => text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((s) => s.startsWith("**") ? run(s.slice(2, -2), { bold: true, ...o }) : run(s, o));
  const kids = [];
  const P = (text, o = {}) => new Paragraph({ spacing: { after: 100, line: 340 }, children: rich(text), ...o });
  const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (t, w, head = false, shade) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: head ? { fill: NAVY, type: ShadingType.CLEAR, color: "auto" } : shade ? { fill: shade, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: String(t).split("\n").map((l) => new Paragraph({ spacing: { line: 300 }, children: rich(l, head ? { bold: true, color: "FFFFFF", size: 19 } : { size: 19 }) })),
  });

  // 表紙
  kids.push(new Paragraph({ spacing: { before: 3200 }, children: [run(doc.eyebrow, { size: 24, color: GRAY, characterSpacing: 40 })] }));
  kids.push(new Paragraph({ spacing: { before: 200, after: 200 }, children: [run(doc.title, { size: 64, bold: true, color: NAVY })] }));
  kids.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 8 } }, spacing: { after: 300 }, children: [run(doc.subtitle, { size: 28, color: GRAY })] }));
  for (const l of doc.cover) kids.push(new Paragraph({ spacing: { after: 80 }, children: [run(l, { size: 22, color: GRAY })] }));
  kids.push(new Paragraph({ children: [new PageBreak()] }));

  // 目次（静的）
  kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run("目次")] }));
  doc.sections.forEach((s, i) => kids.push(new Paragraph({ spacing: { after: 70 }, children: [run(`${i + 1}.  ${s.title}`, { size: 22 })] })));
  kids.push(new Paragraph({ spacing: { before: 200 }, children: [run("※ 本書は Word で編集できます。社内の運用に合わせて加筆・修正してください。", { size: 18, color: GRAY })] }));
  kids.push(new Paragraph({ children: [new PageBreak()] }));

  doc.sections.forEach((s, si) => {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: si > 0 && s.newPage !== false, children: [run(`${si + 1}.  ${s.title}`)] }));
    for (const b of s.blocks) {
      if (typeof b === "string") kids.push(P(b));
      else if (b.h2) kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [run(b.h2)] }));
      else if (b.ul) b.ul.forEach((t) => kids.push(new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 60, line: 330 }, children: rich(t) })));
      else if (b.ol) b.ol.forEach((t) => kids.push(new Paragraph({ numbering: { reference: b.ref ?? "num", level: 0 }, spacing: { after: 60, line: 330 }, children: rich(t) })));
      else if (b.note) {
        kids.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [new TableRow({ children: [new TableCell({ width: { size: W, type: WidthType.DXA }, shading: { fill: b.tone === "warn" ? "FBF0DB" : "E8EEF7", type: ShadingType.CLEAR, color: "auto" }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.SINGLE, size: 24, color: b.tone === "warn" ? "A15C00" : NAVY } }, margins: { top: 100, bottom: 100, left: 180, right: 140 }, children: b.note.split("\n").map((l) => new Paragraph({ spacing: { line: 320 }, children: rich(l, { size: 20 }) })) })] })] }));
        kids.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      }
      else if (b.table) {
        const cols = b.widths ?? b.table[0].map(() => Math.floor(W / b.table[0].length));
        const sum = cols.reduce((a, c) => a + c, 0);
        const cw = cols.map((c) => Math.round((c / sum) * W)); cw[cw.length - 1] += W - cw.reduce((a, c) => a + c, 0);
        kids.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: cw, rows: b.table.map((r, ri) => new TableRow({ tableHeader: ri === 0, cantSplit: true, children: r.map((t, ci) => cell(t, cw[ci], ri === 0, ri > 0 && ci === 0 && b.firstColShade !== false ? "F1F1EE" : undefined)) })) }));
        kids.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      } else if (b.img) {
        const im = png(path.join(OUT, "img", b.img));
        const maxW = b.width ?? 15.5, maxH = b.maxH ?? 17; // cm
        let wcm = maxW, hcm = (im.h / im.w) * wcm;
        if (hcm > maxH) { hcm = maxH; wcm = (im.w / im.h) * hcm; }
        const px = (cm) => Math.round(cm * 37.8);
        kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 }, keepNext: true, children: [new ImageRun({ type: "png", data: im.data, transformation: { width: px(wcm), height: px(hcm) }, altText: { title: b.caption ?? b.img, description: b.caption ?? b.img, name: b.img } })] }));
        if (b.caption) kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run(b.caption, { size: 17, color: GRAY })] }));
      }
    }
  });

  const numCfg = (ref) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] });
  return new Document({
    creator: "H-LINK", title: doc.title, description: doc.subtitle,
    styles: {
      default: { document: { run: { font, size: 21 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font, size: 34, bold: true, color: NAVY }, paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 6 } } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font, size: 26, bold: true, color: "2F6FD0" }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
      ],
    },
    numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }, numCfg("num"), ...Array.from({ length: 40 }, (_, i) => numCfg("n" + i))] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1200, left: 1134, right: 1134 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(`${doc.title}｜${doc.subtitle}`, { size: 16, color: "8A8C95" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font, size: 18, color: "8A8C95" })] })] }) },
      children: kids,
    }],
  });
}

fs.mkdirSync(path.join(root, "public/docs"), { recursive: true });
const tmp = fs.mkdtempSync("/tmp/crmdocs-");
for (const [name, doc] of [["H-LINK-CRM_操作マニュアル", MANUAL], ["H-LINK-CRM_設計書", DESIGN]]) {
  // 配布用 .docx は Word 標準の「Meiryo」。PDF は同じ内容を、この環境にあるフォントで描画して変換する。
  fs.writeFileSync(path.join(OUT, name + ".docx"), await Packer.toBuffer(build(doc, "Meiryo")));
  fs.writeFileSync(path.join(tmp, name + ".docx"), await Packer.toBuffer(build(doc, process.env.PDF_FONT ?? "IPAGothic")));
  execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", OUT, path.join(tmp, name + ".docx")], { stdio: "ignore" });
  for (const ext of ["docx", "pdf"]) fs.copyFileSync(path.join(OUT, `${name}.${ext}`), path.join(root, "public/docs", `${name}.${ext}`));
  console.log("built", name);
}
