/**
 * QuestionRenderer
 * Detects question type and renders appropriate UI:
 *   - MATCH         : two-column table (List I / List II)
 *   - ASSERTION     : Assertion (A) + Reason (R) cards
 *   - STATEMENTS    : Statement I / Statement II cards
 *   - NORMAL        : plain paragraph
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseItems(text, regex) {
  const items = [];
  let m;
  const re = new RegExp(regex.source, regex.flags);
  while ((m = re.exec(text)) !== null) {
    items.push({ key: m[1].toUpperCase(), value: m[2].trim() });
  }
  return items;
}

// ── Match question ─────────────────────────────────────────────────────────────

const MATCH_TRIGGER = /match the following|match the given|match column|column [aib]/i;

function isMatchQuestion(text) {
  if (MATCH_TRIGGER.test(text)) return true;
  const letters = (text.match(/\b[a-d][.)]/gi) || []).length;
  const numbers = (text.match(/\b[1-4][.)]/gi) || []).length;
  return letters >= 3 && numbers >= 3;
}

function parseMatchQuestion(text) {
  let intro       = "";
  let leftHeader  = "Column A";
  let rightHeader = "Column B";
  let letterItems = [];
  let numberItems = [];

  if (text.includes("|")) {
    // Format: "Intro: List I — a. X b. Y | List II — 1. P 2. Q"
    const pipeIdx  = text.indexOf("|");
    const leftPart  = text.substring(0, pipeIdx);
    const rightPart = text.substring(pipeIdx + 1);

    if (/List\s*I\b/i.test(leftPart))  leftHeader  = "List I";
    if (/List\s*II\b/i.test(rightPart)) rightHeader = "List II";

    // Intro = everything before the first letter item in leftPart
    const introM = leftPart.match(/^(.*?)(?=\b[a-d][.)]\s)/i);
    intro = introM ? introM[1].trim() : "";

    // Strip header from each side, keep only item text
    const leftItems  = leftPart.replace(/^.*?(?=\b[a-d][.)]\s)/i, "");
    const rightItems = rightPart.replace(/^.*?(?=\b\d[.)]\s)/, "");

    letterItems = parseItems(leftItems,  /([a-d])[.)]\s+(.+?)(?=\s+[a-d][.)]\s|$)/gi);
    numberItems = parseItems(rightItems, /(\d)[.)]\s+(.+?)(?=\s+\d[.)]\s|$)/gi);
  } else {
    // Single-string format: items interleaved or sequential
    const introM = text.match(/^(.*?)(?=\b[a-d][.)]\s)/i);
    intro = introM ? introM[1].trim() : "";

    letterItems = parseItems(text, /([a-d])[.)]\s+(.+?)(?=\s+[a-d][.)]\s|\s+\d+[.)]\s|$)/gi);
    numberItems = parseItems(text, /(\d)[.)]\s+(.+?)(?=\s+\d+[.)]\s|\s+[a-d][.)]\s|$)/gi);
  }

  return { intro, letterItems, numberItems, leftHeader, rightHeader };
}

function MatchQuestionView({ text }) {
  const { intro, letterItems, numberItems, leftHeader, rightHeader } = parseMatchQuestion(text);
  const rows = Math.max(letterItems.length, numberItems.length);

  return (
    <div>
      {intro && (
        <p style={{ fontSize:"15px", fontWeight:"600", color:"#111", lineHeight:"1.6", marginBottom:"14px", margin:"0 0 14px" }}>
          {intro}
        </p>
      )}
      <div style={{ border:"1px solid #e8eee8", borderRadius:"12px", overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 24px 1fr", background:"#f8fbf8", borderBottom:"1px solid #e8eee8", padding:"8px 14px" }}>
          <span style={{ fontSize:"11px", fontWeight:"700", color:"#1D9E75", letterSpacing:"0.06em", textTransform:"uppercase" }}>{leftHeader}</span>
          <span />
          <span style={{ fontSize:"11px", fontWeight:"700", color:"#378ADD", letterSpacing:"0.06em", textTransform:"uppercase" }}>{rightHeader}</span>
        </div>
        {Array.from({ length: rows }).map((_, i) => {
          const left  = letterItems[i];
          const right = numberItems[i];
          return (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 24px 1fr", padding:"10px 14px", borderBottom: i < rows - 1 ? "1px solid #f0f5f0" : "none", alignItems:"flex-start" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:"8px" }}>
                {left && <>
                  <span style={{ width:20, height:20, borderRadius:"50%", background:"#E1F5EE", color:"#085041", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>{left.key}</span>
                  <span style={{ fontSize:13, color:"#1a1a1a", lineHeight:1.5 }}>{left.value}</span>
                </>}
              </div>
              <div style={{ textAlign:"center", color:"#ccc", fontSize:12, paddingTop:3 }}>→</div>
              <div style={{ display:"flex", alignItems:"flex-start", gap:"8px" }}>
                {right && <>
                  <span style={{ width:20, height:20, borderRadius:"50%", background:"#E6F1FB", color:"#0C447C", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>{right.key}</span>
                  <span style={{ fontSize:13, color:"#555", lineHeight:1.5 }}>{right.value}</span>
                </>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Assertion-Reason question ─────────────────────────────────────────────────

function tryParseAssertion(text) {
  const m = text.match(/^(.*?)\bAssertion\s*(?:\(A\))?\s*[:—]\s*(.+?)\s*\bReason\s*(?:\(R\))?\s*[:—]\s*(.+)$/is);
  if (!m) return null;
  return { intro: m[1].trim(), assertion: m[2].trim(), reason: m[3].trim() };
}

function AssertionView({ intro, assertion, reason }) {
  return (
    <div>
      {intro && <p style={{ fontSize:15, fontWeight:600, color:"#111", lineHeight:1.6, margin:"0 0 12px" }}>{intro}</p>}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ border:"1px solid #e8eee8", borderRadius:10, padding:"12px 14px" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#1D9E75", textTransform:"uppercase", letterSpacing:"0.05em" }}>Assertion (A)</span>
          <p style={{ margin:"6px 0 0", fontSize:13, color:"#1a1a1a", lineHeight:1.6 }}>{assertion}</p>
        </div>
        <div style={{ border:"1px solid #e8eee8", borderRadius:10, padding:"12px 14px" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#378ADD", textTransform:"uppercase", letterSpacing:"0.05em" }}>Reason (R)</span>
          <p style={{ margin:"6px 0 0", fontSize:13, color:"#555", lineHeight:1.6 }}>{reason}</p>
        </div>
      </div>
    </div>
  );
}

// ── Statement question ────────────────────────────────────────────────────────

function tryParseStatements(text) {
  const matches = [...text.matchAll(/Statement\s*(I{1,2}|[12])\s*[:—]\s*(.+?)(?=Statement\s*(I{1,2}|[12])\s*[:—]|$)/gis)];
  if (matches.length < 2) return null;
  const introM = text.match(/^(.*?)Statement\s/i);
  return {
    intro: introM ? introM[1].trim() : "",
    statements: matches.map(m => ({ label: `Statement ${m[1]}`, text: m[2].trim() })),
  };
}

function StatementsView({ intro, statements }) {
  const colors = [
    { bg:"#E1F5EE", label:"#085041", border:"#9FE1CB" },
    { bg:"#E6F1FB", label:"#0C447C", border:"#93C5FD" },
    { bg:"#FFF8E1", label:"#7C5700", border:"#FDE68A" },
  ];
  return (
    <div>
      {intro && <p style={{ fontSize:15, fontWeight:600, color:"#111", lineHeight:1.6, margin:"0 0 12px" }}>{intro}</p>}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {statements.map((s, i) => {
          const c = colors[i % colors.length];
          return (
            <div key={i} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:"12px 14px" }}>
              <span style={{ fontSize:11, fontWeight:700, color:c.label, textTransform:"uppercase", letterSpacing:"0.05em" }}>{s.label}</span>
              <p style={{ margin:"6px 0 0", fontSize:13, color:"#1a1a1a", lineHeight:1.6 }}>{s.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Numbered list question ─────────────────────────────────────────────────────
// e.g. "Which is correct? 1. X 2. Y 3. Z"

function tryParseNumberedList(text) {
  if (!/\b1[.)]\s/.test(text)) return null;

  // Skip if it looks like a match question (has lettered items too)
  const letterCount = (text.match(/\b[a-d][.)]\s/gi) || []).length;
  if (letterCount >= 2) return null;

  // Need at least 2 numbered items
  const numCount = (text.match(/\b\d+[.)]\s/g) || []).length;
  if (numCount < 2) return null;

  // Split stem from items at the first "1."
  const firstM = text.match(/^(.*?)\b(1[.)]\s)/s);
  if (!firstM) return null;

  const stem      = firstM[1].trim();
  const itemsText = text.substring(firstM.index + firstM[1].length);

  const items = [];
  const re    = /(\d+)[.)]\s+(.+?)(?=\s+\d+[.)]\s|$)/gis;
  let m;
  while ((m = re.exec(itemsText)) !== null) {
    items.push({ num: m[1], text: m[2].trim() });
  }

  return items.length >= 2 ? { stem, items } : null;
}

function NumberedListView({ stem, items }) {
  return (
    <div>
      {stem && (
        <p style={{ fontSize:15, fontWeight:600, color:"#111", lineHeight:1.7, margin:"0 0 12px" }}>{stem}</p>
      )}
      <ol style={{ margin:0, padding:"0 0 0 4px", listStyle:"none", display:"flex", flexDirection:"column", gap:8 }}>
        {items.map(({ num, text }) => (
          <li key={num} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
            <span style={{ minWidth:24, height:24, borderRadius:"50%", background:"#f0f4f0", color:"#555", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
              {num}
            </span>
            <span style={{ fontSize:14, color:"#1a1a1a", lineHeight:1.6 }}>{text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Plain text ────────────────────────────────────────────────────────────────

function NormalQuestionView({ text }) {
  return (
    <p style={{ fontSize:"16px", lineHeight:"1.8", color:"#1a1a1a", fontWeight:"500", margin:0 }}>
      {text}
    </p>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function QuestionRenderer({ text }) {
  if (!text) return null;

  if (isMatchQuestion(text)) return <MatchQuestionView text={text} />;

  const ar = tryParseAssertion(text);
  if (ar) return <AssertionView {...ar} />;

  const st = tryParseStatements(text);
  if (st) return <StatementsView {...st} />;

  const nl = tryParseNumberedList(text);
  if (nl) return <NumberedListView {...nl} />;

  return <NormalQuestionView text={text} />;
}
