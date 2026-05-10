import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function Results() {
  const { quizId } = useParams();
  const navigate   = useNavigate();
  const [quiz,     setQuiz]    = useState(null);
  const [showAll,  setShowAll] = useState(false);
  const [filter,   setFilter]  = useState("all");

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "attemptedQuizzes", quizId));
      if (snap.exists()) setQuiz(snap.data());
    }
    load();
  }, [quizId]);

  if (!quiz) return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh" }}>
      <div style={{ width:"36px", height:"36px", border:"3px solid #E1F5EE", borderTop:"3px solid #1D9E75", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  const { score, questions, paperTitle, paperId } = quiz;
  const pct    = score.percentage;
  const passed = pct >= 55;

  const fmtTime = (s) => {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const circumference = 2 * Math.PI * 42;
  const dashOffset    = circumference - (pct / 100) * circumference;

  const filteredQs = questions?.filter(q => {
    if (filter === "correct")   return q.isCorrect;
    if (filter === "wrong")     return !q.isCorrect && q.selectedAnswer;
    if (filter === "skipped")   return !q.selectedAnswer;
    return true;
  }) ?? [];

  const displayQs = showAll ? filteredQs : filteredQs.slice(0, 5);

  return (
    <div style={{ minHeight:"100vh", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>

      {/* Top bar */}
      <div style={{ background:"white", borderBottom:"1px solid #e8eee8", padding:"0 24px", height:"56px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#1D9E75" }} />
          <span style={{ fontWeight:"700", fontSize:"14px" }}>Kerala SET prep</span>
        </div>
        <div style={{ display:"flex", gap:"10px" }}>
          {paperId && (
            <button onClick={() => navigate(`/quiz/${paperId}`)} style={{ padding:"8px 18px", borderRadius:"8px", border:"1.5px solid #1D9E75", background:"white", color:"#1D9E75", cursor:"pointer", fontSize:"13px", fontWeight:"600" }}>
              Retry test
            </button>
          )}
          <button onClick={() => navigate("/")} style={{ padding:"8px 18px", borderRadius:"8px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontSize:"13px", fontWeight:"600" }}>
            ← Home
          </button>
        </div>
      </div>

      <div style={{ maxWidth:"820px", margin:"0 auto", padding:"28px 20px" }}>

        {/* ── Hero score card ── */}
        <div style={{
          background: passed ? "linear-gradient(135deg,#0F6E56,#1D9E75)" : "linear-gradient(135deg,#791F1F,#E24B4A)",
          borderRadius:"20px", padding:"32px", marginBottom:"20px", color:"white",
          display:"grid", gridTemplateColumns:"auto 1fr", gap:"32px", alignItems:"center",
        }}>
          {/* Score ring */}
          <div style={{ position:"relative", width:"110px", height:"110px", flexShrink:0 }}>
            <svg width="110" height="110" style={{ transform:"rotate(-90deg)" }}>
              <circle cx="55" cy="55" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="9"/>
              <circle cx="55" cy="55" r="42" fill="none" stroke="white" strokeWidth="9"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                strokeLinecap="round" style={{ transition:"stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:"26px", fontWeight:"800", lineHeight:1 }}>{pct}%</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize:"22px", fontWeight:"800", marginBottom:"4px" }}>
              {passed ? "🎉 You passed!" : "📚 Keep practising"}
            </div>
            <div style={{ fontSize:"14px", opacity:0.85, marginBottom:"16px" }}>
              {paperTitle ?? "Mock test"} · Cutoff: 55%
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px" }}>
              {[
                { label:"Correct",  value: score.correct,   color:"rgba(255,255,255,0.95)" },
                { label:"Wrong",    value: score.incorrect, color:"rgba(255,255,255,0.95)" },
                { label:"Skipped",  value: score.skipped,   color:"rgba(255,255,255,0.95)" },
                { label:"Time",     value: fmtTime(quiz.durationSeconds), color:"rgba(255,255,255,0.95)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background:"rgba(255,255,255,0.15)", borderRadius:"10px", padding:"10px 12px" }}>
                  <div style={{ fontSize:"18px", fontWeight:"800", color }}>{value}</div>
                  <div style={{ fontSize:"11px", opacity:0.75, marginTop:"2px" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Analytics grid ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", marginBottom:"20px" }}>

          {/* Accuracy breakdown */}
          <div style={{ background:"white", borderRadius:"16px", border:"1px solid #e8eee8", padding:"20px" }}>
            <p style={{ fontWeight:"700", fontSize:"13px", marginBottom:"16px", color:"#111" }}>Score breakdown</p>
            {[
              { label:"Correct",  value: score.correct,   total: score.total, color:"#1D9E75", bg:"#E1F5EE" },
              { label:"Wrong",    value: score.incorrect, total: score.total, color:"#E24B4A", bg:"#FCEBEB" },
              { label:"Skipped",  value: score.skipped,   total: score.total, color:"#BA7517", bg:"#FAEEDA" },
            ].map(({ label, value, total, color, bg }) => (
              <div key={label} style={{ marginBottom:"12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"5px" }}>
                  <span style={{ color:"#666" }}>{label}</span>
                  <span style={{ fontWeight:"700", color }}>{value} <span style={{ color:"#ccc", fontWeight:"400" }}>/ {total}</span></span>
                </div>
                <div style={{ height:"6px", borderRadius:"999px", background:"#f0f0f0", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:"999px", background:color, width:`${Math.round(value/total*100)}%`, transition:"width 0.8s ease" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Performance meter */}
          <div style={{ background:"white", borderRadius:"16px", border:"1px solid #e8eee8", padding:"20px" }}>
            <p style={{ fontWeight:"700", fontSize:"13px", marginBottom:"16px", color:"#111" }}>Performance rating</p>
            {[
              { label:"Excellent",   min:80, color:"#1D9E75" },
              { label:"Good",        min:65, color:"#639922" },
              { label:"Pass",        min:55, color:"#BA7517" },
              { label:"Below cutoff",min:0,  color:"#E24B4A" },
            ].map(({ label, min, color }) => {
              const isActive = pct >= min && (label === "Below cutoff" ? pct < 55 : label === "Pass" ? pct >= 55 && pct < 65 : label === "Good" ? pct >= 65 && pct < 80 : pct >= 80);
              return (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"8px 12px", borderRadius:"9px", marginBottom:"6px", background: isActive ? `${color}15` : "transparent", border: isActive ? `1.5px solid ${color}40` : "1.5px solid transparent" }}>
                  <div style={{ width:"10px", height:"10px", borderRadius:"50%", background: color, flexShrink:0 }} />
                  <span style={{ fontSize:"13px", color: isActive ? color : "#bbb", fontWeight: isActive ? "700" : "400" }}>{label}</span>
                  {isActive && <span style={{ marginLeft:"auto", fontSize:"11px", fontWeight:"700", color }}>← You are here</span>}
                </div>
              );
            })}
            <div style={{ marginTop:"12px", padding:"10px 12px", background:"#f8f8f8", borderRadius:"9px" }}>
              <div style={{ fontSize:"11px", color:"#888", marginBottom:"3px" }}>Accuracy rate</div>
              <div style={{ fontSize:"20px", fontWeight:"800", color:"#111" }}>
                {score.correct + score.incorrect > 0
                  ? Math.round(score.correct / (score.correct + score.incorrect) * 100)
                  : 0}%
                <span style={{ fontSize:"12px", color:"#aaa", fontWeight:"400", marginLeft:"4px" }}>of attempted</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Answer review ── */}
        <div style={{ background:"white", borderRadius:"16px", border:"1px solid #e8eee8", padding:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px", flexWrap:"wrap", gap:"10px" }}>
            <p style={{ fontWeight:"700", fontSize:"13px", color:"#111", margin:0 }}>Answer review</p>
            <div style={{ display:"flex", gap:"6px" }}>
              {[
                { key:"all",     label:`All (${questions?.length ?? 0})`,        color:"#555" },
                { key:"correct", label:`Correct (${score.correct})`,              color:"#1D9E75" },
                { key:"wrong",   label:`Wrong (${score.incorrect})`,              color:"#E24B4A" },
                { key:"skipped", label:`Skipped (${score.skipped})`,              color:"#BA7517" },
              ].map(({ key, label, color }) => (
                <button key={key} onClick={() => { setFilter(key); setShowAll(false); }} style={{
                  padding:"5px 12px", borderRadius:"999px", border:"none", cursor:"pointer",
                  fontSize:"11px", fontWeight:"600",
                  background: filter===key ? `${color}18` : "#f5f5f5",
                  color:      filter===key ? color         : "#aaa",
                  outline:    filter===key ? `1.5px solid ${color}40` : "none",
                }}>{label}</button>
              ))}
            </div>
          </div>

          {filteredQs.length === 0 && (
            <p style={{ textAlign:"center", color:"#ccc", padding:"24px 0", fontSize:"13px" }}>No questions in this filter</p>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {displayQs.map((q, i) => (
              <div key={i} style={{
                border:`1.5px solid ${q.isCorrect ? "#9FE1CB" : !q.selectedAnswer ? "#FAC775" : "#F7C1C1"}`,
                borderRadius:"12px", padding:"16px", background: q.isCorrect ? "#f8fffc" : !q.selectedAnswer ? "#fffdf5" : "#fff8f8",
              }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"10px", marginBottom:"10px" }}>
                  <p style={{ fontSize:"14px", color:"#1a1a1a", fontWeight:"500", margin:0, lineHeight:"1.6", flex:1 }}>
                    <span style={{ color:"#aaa", marginRight:"6px" }}>Q{i+1}.</span>
                    {q.questionId}
                  </p>
                  <span style={{
                    flexShrink:0, fontSize:"10px", fontWeight:"700", padding:"3px 10px", borderRadius:"999px",
                    background: q.isCorrect ? "#E1F5EE" : !q.selectedAnswer ? "#FAEEDA" : "#FCEBEB",
                    color:      q.isCorrect ? "#085041" : !q.selectedAnswer ? "#633806" : "#A32D2D",
                  }}>
                    {q.isCorrect ? "Correct" : !q.selectedAnswer ? "Skipped" : "Wrong"}
                  </span>
                </div>
                <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                  <span style={{ fontSize:"12px", background: q.isCorrect ? "#E1F5EE" : "#FCEBEB", color: q.isCorrect ? "#085041" : "#A32D2D", padding:"4px 12px", borderRadius:"999px", fontWeight:"600" }}>
                    Your answer: {q.selectedAnswer ?? "—"}
                  </span>
                  {!q.isCorrect && (
                    <span style={{ fontSize:"12px", background:"#E1F5EE", color:"#085041", padding:"4px 12px", borderRadius:"999px", fontWeight:"600" }}>
                      Correct: {q.correctAnswer}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredQs.length > 5 && (
            <button
              onClick={() => setShowAll(s => !s)}
              style={{ width:"100%", marginTop:"14px", padding:"12px", borderRadius:"10px", border:"1.5px solid #eef2ee", background:"white", cursor:"pointer", fontSize:"13px", fontWeight:"600", color:"#1D9E75" }}
            >
              {showAll ? "Show less ↑" : `Show all ${filteredQs.length} questions ↓`}
            </button>
          )}
        </div>

        {/* ── CTA ── */}
        <div style={{ display:"flex", gap:"12px", justifyContent:"center", marginTop:"20px" }}>
          {paperId && (
            <button onClick={() => navigate(`/quiz/${paperId}`)} style={{ padding:"13px 28px", borderRadius:"11px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontSize:"14px", fontWeight:"700" }}>
              Retry this paper →
            </button>
          )}
          <button onClick={() => navigate("/")} style={{ padding:"13px 28px", borderRadius:"11px", border:"1.5px solid #ddd", background:"white", cursor:"pointer", fontSize:"14px", fontWeight:"600", color:"#555" }}>
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}