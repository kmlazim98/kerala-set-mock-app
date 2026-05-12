/**
 * generateSessionPDF
 *
 * Unified PDF report generator for:
 *   - Daily Learning sessions  (pass sessionNumber)
 *   - Practice Tests           (pass paperId / partNumber / paperTitle)
 *
 * Common params:
 *   date            – "YYYY-MM-DD"
 *   score           – { correct, wrong, skipped, percentage }
 *   questions       – [{ id, text, options:{A,B,C,D}, correctAnswer, subject, year }]
 *   answers         – { [questionId]: "A"|"B"|"C"|"D" }
 *   subject         – string
 *   year            – string
 *   durationSeconds – number
 *   title           – override auto-generated report title
 *
 * Daily mode (include):
 *   sessionNumber   – 1–5
 *
 * Practice test mode (include):
 *   paperId         – string
 *   partNumber      – string / number
 *   paperTitle      – string
 */

import { jsPDF } from "jspdf";

// ── Brand palette ─────────────────────────────────────────────────────────────
const C = {
  green:   [29,  158, 117],
  navy:    [26,  35,  126],
  success: [15,  110, 86 ],
  error:   [226, 75,  74 ],
  warning: [186, 117, 23 ],
  gray:    [120, 120, 120],
  black:   [26,  26,  26 ],
  white:   [255, 255, 255],
  lgGreen: [225, 245, 238],
  lgRed:   [252, 235, 235],
  bgLight: [248, 249, 248],
  border:  [232, 238, 232],
  dim:     [180, 210, 200],
};

const PW = 210;          // A4 width  (mm)
const PH = 297;          // A4 height (mm)
const ML = 15;           // margin
const CW = PW - ML * 2; // content width

// ── Tiny helpers ──────────────────────────────────────────────────────────────

const rgb  = (doc, arr) => doc.setTextColor(...arr);
const fill = (doc, arr) => doc.setFillColor(...arr);
const drw  = (doc, arr) => doc.setDrawColor(...arr);
const fmt  = (doc, size, style = "normal", color) => {
  doc.setFontSize(size);
  doc.setFont("helvetica", style);
  if (color) rgb(doc, color);
};

function hLine(doc, y, color = C.border, w = 0.3) {
  drw(doc, color);
  doc.setLineWidth(w);
  doc.line(ML, y, PW - ML, y);
}

function fmtTime(seconds) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${s ? " " + s + "s" : ""}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateSessionPDF(params = {}) {
  const {
    sessionNumber,
    date,
    score,
    questions   = [],
    answers     = {},
    subject,
    year,
    durationSeconds,
    // Practice test
    paperId,
    partNumber,
    paperTitle,
    title,
  } = params;

  const isDaily  = sessionNumber != null;
  const passed   = (score?.percentage ?? 0) >= 55;
  const dateStr  = date ?? new Date().toISOString().split("T")[0];

  // Auto report title
  const reportTitle = title ?? (
    isDaily
      ? `Daily Learning · Session ${sessionNumber} of 5`
      : paperTitle
        ? `Practice Test · ${paperTitle}${partNumber != null ? ` · Part ${partNumber}` : ""}`
        : "Practice Test Report"
  );

  // Output filename
  const filename = isDaily
    ? `SET-Session${sessionNumber}-${dateStr}.pdf`
    : `SET-PracticeTest-${paperId ?? "report"}-${dateStr}.pdf`;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 0;

  // ── Page header (p2+) ─────────────────────────────────────────────────────
  function addRunningHeader() {
    fill(doc, C.navy);
    doc.rect(0, 0, PW, 8, "F");
    fill(doc, C.green);
    doc.rect(0, 6.2, PW, 1.8, "F");
    fmt(doc, 7, "bold", C.white);
    doc.text("Kerala SET Mock", ML, 5.2);
    fmt(doc, 7, "normal", C.dim);
    doc.text(reportTitle, ML + 30, 5.2);
    doc.text(`Page ${doc.getNumberOfPages()}`, PW - ML, 5.2, { align: "right" });
    y = 14;
  }

  function newPage() {
    doc.addPage();
    addRunningHeader();
  }

  function guard(needed) {
    if (y + needed > PH - ML - 10) newPage();
  }

  // ── PAGE 1 HERO HEADER ────────────────────────────────────────────────────
  fill(doc, C.navy);
  doc.rect(0, 0, PW, 44, "F");
  fill(doc, C.green);
  doc.rect(0, 41, PW, 3, "F");

  fmt(doc, 20, "bold", C.white);
  doc.text("Kerala SET Mock", ML, 17);
  fmt(doc, 10, "normal", C.dim);
  doc.text(reportTitle, ML, 27);
  fmt(doc, 8, "normal", [150, 185, 172]);
  doc.text(dateStr, PW - ML, 17, { align: "right" });

  y = 52;

  // ── META ROW ──────────────────────────────────────────────────────────────
  const meta = [
    subject                && `Subject: ${subject}`,
    year                   && `Year: ${year}`,
    !isDaily && paperTitle && `Paper: ${paperTitle}`,
    partNumber != null     && `Part: ${partNumber}`,
    durationSeconds != null && `Duration: ${fmtTime(durationSeconds)}`,
  ].filter(Boolean);

  if (meta.length) {
    fmt(doc, 8.5, "normal", C.gray);
    doc.text(meta.join("   ·   "), ML, y);
    y += 8;
  }

  // ── SCORE CARD ────────────────────────────────────────────────────────────
  const CARD_H  = 36;
  const scoreBg = passed ? C.lgGreen : C.lgRed;
  const scoreFg = passed ? C.success : C.error;

  fill(doc, scoreBg);
  doc.roundedRect(ML, y, CW, CARD_H, 3, 3, "F");
  drw(doc, scoreFg);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, CARD_H, 3, 3, "S");
  doc.setLineWidth(0.2);

  // Big percentage
  fmt(doc, 28, "bold", scoreFg);
  doc.text(`${score?.percentage ?? 0}%`, ML + 9, y + 21);
  fmt(doc, 9, "bold", scoreFg);
  doc.text(passed ? "✓  PASSED" : "✗  NEEDS WORK", ML + 9, y + 30);

  // Stat columns (right side)
  const statItems = [
    { label: "Correct",  value: score?.correct  ?? 0, color: C.success },
    { label: "Wrong",    value: score?.wrong    ?? 0, color: C.error   },
    { label: "Skipped",  value: score?.skipped  ?? 0, color: C.gray    },
    { label: "Total Qs", value: questions.length,      color: C.navy    },
  ];
  const BOX_W = 27;
  const BOX_X = PW - ML - BOX_W * statItems.length + 2;

  statItems.forEach((st, i) => {
    const bx = BOX_X + i * BOX_W;
    fmt(doc, 16, "bold", st.color);
    doc.text(String(st.value), bx + BOX_W / 2, y + 17, { align: "center" });
    fmt(doc, 7, "normal", C.gray);
    doc.text(st.label, bx + BOX_W / 2, y + 25, { align: "center" });
  });

  // Passing note
  fmt(doc, 7, "italic", C.gray);
  doc.text(`Passing cutoff: 55%  ·  Generated: ${new Date().toLocaleString("en-IN")}`, ML, y + CARD_H + 5);

  y += CARD_H + 12;

  // ── SECTION HEADING ───────────────────────────────────────────────────────
  fmt(doc, 11, "bold", C.black);
  doc.text("Question Review", ML, y);
  y += 3;
  hLine(doc, y, C.border, 0.4);
  y += 7;

  // ── QUESTIONS ─────────────────────────────────────────────────────────────
  questions.forEach((q, idx) => {
    const userAns   = answers[q.id];
    const isCorrect = userAns === q.correctAnswer;
    const isSkipped = !userAns;

    const statusCol = isSkipped ? C.warning : isCorrect ? C.success : C.error;
    const statusLbl = isSkipped ? "SKIPPED" : isCorrect ? "CORRECT" : "WRONG";

    // Rough height estimate
    const qLines   = doc.splitTextToSize(q.text ?? "", CW - 12);
    const optCount = ["A","B","C","D"].filter(o => q.options?.[o]).length;
    guard(qLines.length * 4.8 + optCount * 9 + 20);

    // ── Q-number badge + status ───────────────────────────────────────────
    fill(doc, statusCol);
    doc.roundedRect(ML, y, 9, 4.5, 1, 1, "F");
    fmt(doc, 6, "bold", C.white);
    doc.text(`Q${idx + 1}`, ML + 4.5, y + 3.2, { align: "center" });

    fmt(doc, 7, "bold", statusCol);
    doc.text(statusLbl, ML + 11, y + 3.2);

    y += 7;

    // ── Question text ─────────────────────────────────────────────────────
    fmt(doc, 9, "normal", C.black);
    doc.text(qLines, ML + 2, y);
    y += qLines.length * 4.8 + 3;

    // ── Options ───────────────────────────────────────────────────────────
    ["A", "B", "C", "D"].forEach(opt => {
      const optText      = q.options?.[opt];
      if (!optText) return;

      const isUserPick   = userAns === opt;
      const isCorrectOpt = q.correctAnswer === opt;

      const wrapped = doc.splitTextToSize(`${opt}.  ${optText}`, CW - 22);
      const rowH    = wrapped.length * 4.2 + 5;

      guard(rowH + 3);

      // Row background
      if (isCorrectOpt) {
        fill(doc, C.lgGreen);
        doc.roundedRect(ML + 4, y - 1.5, CW - 4, rowH, 1.5, 1.5, "F");
        drw(doc, C.success);
        doc.setLineWidth(0.3);
        doc.roundedRect(ML + 4, y - 1.5, CW - 4, rowH, 1.5, 1.5, "S");
        doc.setLineWidth(0.2);
      } else if (isUserPick) {
        fill(doc, C.lgRed);
        doc.roundedRect(ML + 4, y - 1.5, CW - 4, rowH, 1.5, 1.5, "F");
      }

      // Letter badge
      const bFill = isCorrectOpt ? C.success : isUserPick ? C.error : C.border;
      const bText = isCorrectOpt || isUserPick ? C.white : C.gray;
      fill(doc, bFill);
      doc.ellipse(ML + 10, y + rowH / 2 - 1.5, 2.4, 2.4, "F");
      fmt(doc, 7, "bold", bText);
      doc.text(opt, ML + 10, y + rowH / 2 + 0.5, { align: "center" });

      // Option text
      const tColor = isCorrectOpt ? C.success : isUserPick ? C.error : C.gray;
      fmt(doc, 8.5, isCorrectOpt || isUserPick ? "bold" : "normal", tColor);
      doc.text(wrapped, ML + 16, y + 3);

      // Right label
      if (isCorrectOpt && isUserPick) {
        fmt(doc, 7, "bold", C.success);
        doc.text("✓ Your answer · Correct", PW - ML - 2, y + rowH / 2 - 0.5, { align: "right" });
      } else if (isCorrectOpt) {
        fmt(doc, 7, "bold", C.success);
        doc.text("✓ Correct Answer", PW - ML - 2, y + rowH / 2 - 0.5, { align: "right" });
      } else if (isUserPick) {
        fmt(doc, 7, "bold", C.error);
        doc.text("✗ Your Answer", PW - ML - 2, y + rowH / 2 - 0.5, { align: "right" });
      }

      y += rowH + 2.5;
    });

    // Divider between questions
    if (idx < questions.length - 1) {
      y += 3;
      hLine(doc, y);
      y += 5;
    }
  });

  // ── FOOTER ON EVERY PAGE ──────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    fill(doc, C.bgLight);
    doc.rect(0, PH - 9, PW, 9, "F");
    drw(doc, C.border);
    doc.setLineWidth(0.3);
    doc.line(0, PH - 9, PW, PH - 9);
    fmt(doc, 7, "normal", C.gray);
    doc.text("Kerala SET Mock · For study purposes only", ML, PH - 3.5);
    doc.text(`Page ${p} of ${total}`, PW - ML, PH - 3.5, { align: "right" });
  }

  doc.save(filename);
}
