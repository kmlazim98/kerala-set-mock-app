/**
 * QuestionRenderer
 * ─────────────────
 * Detects question type and renders appropriate UI:
 *   - MATCH  : two-column table (Column A → Column B)
 *   - NORMAL : plain paragraph text
 *
 * Detection heuristic:
 *   A matching question typically contains patterns like:
 *   "a. ... 1. ...", "a) ... i) ...", "Match the following"
 *   or alternating lettered/numbered items in the text.
 */

// ── Regex patterns ────────────────────────────────────────────────────────────

// Detects "a. X  b. Y  c. Z  d. W  1. P  2. Q  3. R  4. S" structure
const MATCH_TRIGGER_WORDS = /match the following|match the given|match column|column [aib]/i;

// Finds lettered items: "a. ...", "a) ..."
const LETTER_ITEM = /([a-d])[.)]\s+(.+?)(?=\s+[a-d][.)]\s|\s+\d+[.)]\s|$)/gi;

// Finds numbered items: "1. ...", "1) ..."
const NUMBER_ITEM = /(\d)[.)]\s+(.+?)(?=\s+\d+[.)]\s|\s+[a-d][.)]\s|$)/gi;

// ── Parser ────────────────────────────────────────────────────────────────────

function parseMatchQuestion(text) {
  const letterItems = [];
  const numberItems = [];

  let m;
  const lt = new RegExp(LETTER_ITEM.source, 'gi');
  while ((m = lt.exec(text)) !== null) {
    letterItems.push({ key: m[1].toUpperCase(), value: m[2].trim() });
  }

  const nt = new RegExp(NUMBER_ITEM.source, 'gi');
  while ((m = nt.exec(text)) !== null) {
    numberItems.push({ key: m[1], value: m[2].trim() });
  }

  return { letterItems, numberItems };
}

function isMatchQuestion(text) {
  if (MATCH_TRIGGER_WORDS.test(text)) return true;

  // Has at least 3 lettered AND 3 numbered items
  const letters = (text.match(/\b[a-d][.)]/gi) || []).length;
  const numbers = (text.match(/\b[1-4][.)]/gi) || []).length;
  return letters >= 3 && numbers >= 3;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MatchQuestionView({ text }) {
  const { letterItems, numberItems } = parseMatchQuestion(text);

  // Extract the intro sentence (everything before the first "a.")
  const introMatch = text.match(/^(.*?)(?=[a-d][.)]\s)/i);
  const intro = introMatch ? introMatch[1].trim() : "";

  const rows = Math.max(letterItems.length, numberItems.length);

  return (
    <div>
      {/* Intro sentence if present */}
      {intro && (
        <p style={{ fontSize:"15px", fontWeight:"500", color:"var(--color-text-primary)", lineHeight:"1.6", marginBottom:"14px" }}>
          {intro}
        </p>
      )}

      {/* Match table */}
      <div style={{ border:"1px solid #e8eee8", borderRadius:"12px", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 20px 1fr", background:"#f8fbf8", borderBottom:"1px solid #e8eee8", padding:"8px 14px" }}>
          <span style={{ fontSize:"11px", fontWeight:"600", color:"#1D9E75", letterSpacing:"0.06em", textTransform:"uppercase" }}>Column A</span>
          <span/>
          <span style={{ fontSize:"11px", fontWeight:"600", color:"#378ADD", letterSpacing:"0.06em", textTransform:"uppercase" }}>Column B</span>
        </div>

        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => {
          const left  = letterItems[i];
          const right = numberItems[i];
          return (
            <div
              key={i}
              style={{ display:"grid", gridTemplateColumns:"1fr 20px 1fr", padding:"10px 14px", borderBottom: i < rows-1 ? "1px solid #f0f5f0" : "none", alignItems:"center" }}
            >
              {/* Left cell */}
              <div style={{ display:"flex", alignItems:"flex-start", gap:"8px" }}>
                {left && (
                  <>
                    <span style={{ width:"20px", height:"20px", borderRadius:"50%", background:"#E1F5EE", color:"#085041", fontSize:"11px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:"1px" }}>
                      {left.key}
                    </span>
                    <span style={{ fontSize:"13px", color:"#1a1a1a", lineHeight:"1.5" }}>{left.value}</span>
                  </>
                )}
              </div>

              {/* Arrow */}
              <div style={{ textAlign:"center", color:"#ccc", fontSize:"12px" }}>→</div>

              {/* Right cell */}
              <div style={{ display:"flex", alignItems:"flex-start", gap:"8px" }}>
                {right && (
                  <>
                    <span style={{ width:"20px", height:"20px", borderRadius:"50%", background:"#E6F1FB", color:"#0C447C", fontSize:"11px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:"1px" }}>
                      {right.key}
                    </span>
                    <span style={{ fontSize:"13px", color:"#555", lineHeight:"1.5" }}>{right.value}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NormalQuestionView({ text }) {
  return (
    <p style={{ fontSize:"16px", lineHeight:"1.8", color:"var(--color-text-primary)", fontWeight:"500", margin:0 }}>
      {text}
    </p>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function QuestionRenderer({ text }) {
  if (!text) return null;

  if (isMatchQuestion(text)) {
    return <MatchQuestionView text={text} />;
  }

  return <NormalQuestionView text={text} />;
}