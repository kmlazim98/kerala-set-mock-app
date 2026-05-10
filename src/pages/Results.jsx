import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { fetchPaperQuestions } from "../lib/uploadPaper";

export default function Results() {
  const { quizId } = useParams();
  const navigate   = useNavigate();
  const [quiz,     setQuiz]      = useState(null);
  const [qMap,     setQMap]      = useState({});  // questionId → full question data
  const [loading,  setLoading]   = useState(true);
  const [showAll,  setShowAll]   = useState(false);
  const [filter,   setFilter]    = useState("all");

  useEffect(() => {
    async function load() {
      // 1. Load the quiz attempt
      const snap = await getDoc(doc(db, "attemptedQuizzes", quizId));
      if (!snap.exists()) { setLoading(false); return; }
      const quizData = snap.data();
      setQuiz(quizData);

      // 2. Try to get question text from the stored attempt first
      //    (new attempts store questionText + options directly)
      const hasText = quizData.questions?.some(q => q.questionText);

      if (!hasText && quizData.paperId) {
        // Old attempt — fetch questions from Firestore to get text
        const allQs = await fetchPaperQuestions(quizData.paperId);
        const map = {};
        allQs.forEach(q => { map[q.id] = q; });
        setQMap(map);
      }

      setLoading(false);
    }
    load();
  }, [quizId]);

  const fmtTime = s => {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh" }}>
      <div style={{ width:"36px", height:"36px", border:"3px solid #E1F5EE", borderTop:"3px solid #1D9E75", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  if (!quiz) return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh", flexDirection:"column", gap:"12px" }}>
      <p style={{ color:"#E24B4A", fontWeight:"600" }}>Result not found.</p>
      <button onClick={() => navigate("/")} style={{ padding:"10px 20px", borderRadius:"8px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer" }}>← Home</button>
    </div>
  );

  const { score, questions, paperTitle, paperId, partNumber, durationSeconds } = quiz;
  const pct    = score?.percentage ?? 0;
  const passed = pct >= 55;

  const circumference = 2 * Math.PI * 44;
  const dashOffset    = circumference - (pct / 100) * circumference;

  // Get display data for a question — prefers stored text, falls back to fetched map
  function getQ(q) {
    if (q.questionText) {
      return {
        text:    q.questionText,
        options: q.options ?? {},
      };
    }
    // Fall back to fetched question data
    const fetched = qMap[q.questionId];
    return {
      text:    fetched?.text    ?? q.questionId,
      options: fetched?.options ?? {},
    };
  }

  const filteredQs = (questions ?? []).filter(q => {
    if (filter === "correct") return q.isCorrect;
    if (filter === "wrong")   return !q.isCorrect && q.selectedAnswer;
    if (filter === "skipped") return !q.selectedAnswer;
    return true;
  });

  const displayQs = showAll ? filteredQs : filteredQs.slice(0, 5);

  return (
    <div style={{ minHeight:"100vh", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>

      {/* Top bar */}
      <div style={{ background:"white", borderBottom:"1px solid #e8eee8", padding:"0 24px", height:"56px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#1D9E75" }}/>
          <span style={{ fontWeight:"700", fontSize:"14px" }}>Kerala SET prep</span>
        </div>
        <div style={{ display:"flex", gap:"10px" }}>
          {paperId && (
            <button
              onClick={() => navigate(partNumber ? `/quiz/${paperId}/part/${partNumber}` : `/quiz/${paperId}`)}
              style={{ padding:"8px 18px", borderRadius:"8px", border:"1.5px solid #1D9E75", background:"white", color:"#1D9E75", cursor:"pointer", fontSize:"13px", fontWeight:"600" }}
            >
              Retry
            </button>
          )}
          <button onClick={() => navigate("/")} style={{ padding:"8px 18px", borderRadius:"8px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontSize:"13px", fontWeight:"600" }}>
            ← Home
          </button>
        </div>
      </div>

      <div style={{ maxWidth:"820px", margin:"0 auto", padding:"28px 20px" }}>

        {/* Hero card */}
        <div style={{
          background: passed
            ? "linear-gradient(135deg,#0F6E56,#1D9E75)"
            : "linear-gradient(135deg,#791F1F,#E24B4A)",
          borderRadius:"20px", padding:"32px", marginBottom:"20px",
          color:"white", display:"grid",
          gridTemplateColumns:"auto 1fr", gap:"32px", alignItems:"center",
        }}>
          {/* Score ring */}
          <div style={{ position:"relative", width:"110px", height:"110px", flexShrink:0 }}>
            <svg width="110" height="110" style={{ transform:"rotate(-90deg)" }}>
              <circle cx="55" cy="55" r="44" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="9"/>
              <circle cx="55" cy="55" r="44" fill="none" stroke="white" strokeWidth="9"
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
              {paperTitle ?? "Mock test"}
              {partNumber && ` — Part ${partNumber}`}
              {" · "}Cutoff: 55%
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px" }}>
              {[
                { label:"Correct",  value: score?.correct   ?? 0 },
                { label:"Wrong",    value: score?.incorrect  ?? 0 },
                { label:"Skipped",  value: score?.skipped    ?? 0 },
                { label:"Time",     value: fmtTime(durationSeconds) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background:"rgba(255,255,255,0.15)", borderRadius:"10px", padding:"10px 12px" }}>
                  <div style={{ fontSize:"18px", fontWeight:"800" }}>{value}</div>
                  <div style={{ fontSize:"11px", opacity:0.75, marginTop:"2px" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", marginBottom:"20px" }}>

          {/* Score breakdown */}
          <div style={{ background:"white", borderRadius:"16px", border:"1px solid #e8eee8", padding:"20px" }}>
            <p style={{ fontWeight:"700", fontSize:"13px", marginBottom:"16px", color:"#111" }}>Score breakdown</p>
            {[
              { label:"Correct",  value: score?.correct   ?? 0, color:"#1D9E75" },
              { label:"Wrong",    value: score?.incorrect  ?? 0, color:"#E24B4A" },
              { label:"Skipped",  value: score?.skipped    ?? 0, color:"#BA7517" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ marginBottom:"12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"5px" }}>
                  <span style={{ color:"#666" }}>{label}</span>
                  <span style={{ fontWeight:"700", color }}>
                    {value} <span style={{ color:"#ccc", fontWeight:"400" }}>/ {score?.total ?? 0}</span>
                  </span>
                </div>
                <div style={{ height:"6px", borderRadius:"999px", background:"#f0f0f0", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:"999px", background:color, width:`${score?.total ? Math.round(value/score.total*100) : 0}%`, transition:"width 0.8s ease" }}/>
                </div>
              </div>
            ))}
          </div>

          {/* Performance rating */}
          <div style={{ background:"white", borderRadius:"16px", border:"1px solid #e8eee8", padding:"20px" }}>
            <p style={{ fontWeight:"700", fontSize:"13px", marginBottom:"16px", color:"#111" }}>Performance rating</p>
            {[
              { label:"Excellent",    range:[80,100], color:"#1D9E75" },
              { label:"Good",         range:[65,79],  color:"#639922" },
              { label:"Pass",         range:[55,64],  color:"#BA7517" },
              { label:"Below cutoff", range:[0,54],   color:"#E24B4A" },
            ].map(({ label, range, color }) => {
              const isActive = pct >= range[0] && pct <= range[1];
              return (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"8px 10px", borderRadius:"9px", marginBottom:"6px", background:isActive?`${color}15`:"transparent", border:isActive?`1.5px solid ${color}40`:"1.5px solid transparent" }}>
                  <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:color, flexShrink:0 }}/>
                  <span style={{ fontSize:"13px", color:isActive?color:"#bbb", fontWeight:isActive?"700":"400" }}>{label}</span>
                  <span style={{ fontSize:"11px", color:"#ccc", marginLeft:"auto" }}>{range[0]}–{range[1]}%</span>
                  {isActive && <span style={{ fontSize:"11px", fontWeight:"700", color }}>← you</span>}
                </div>
              );
            })}
            <div style={{ marginTop:"10px", padding:"10px", background:"#f8f8f8", borderRadius:"9px" }}>
              <div style={{ fontSize:"11px", color:"#888", marginBottom:"2px" }}>Accuracy (of attempted)</div>
              <div style={{ fontSize:"20px", fontWeight:"800", color:"#111" }}>
                {(score?.correct ?? 0) + (score?.incorrect ?? 0) > 0
                  ? Math.round((score?.correct ?? 0) / ((score?.correct ?? 0) + (score?.incorrect ?? 0)) * 100)
                  : 0}%
              </div>
            </div>
          </div>
        </div>

        {/* Answer review */}
        <div style={{ background:"white", borderRadius:"16px", border:"1px solid #e8eee8", padding:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px", flexWrap:"wrap", gap:"10px" }}>
            <p style={{ fontWeight:"700", fontSize:"13px", color:"#111", margin:0 }}>Answer review</p>
            <div style={{ display:"flex", gap:"6px" }}>
              {[
                { key:"all",     label:`All (${questions?.length ?? 0})`,         color:"#555"    },
                { key:"correct", label:`Correct (${score?.correct ?? 0})`,         color:"#1D9E75" },
                { key:"wrong",   label:`Wrong (${score?.incorrect ?? 0})`,         color:"#E24B4A" },
                { key:"skipped", label:`Skipped (${score?.skipped ?? 0})`,         color:"#BA7517" },
              ].map(({ key, label, color }) => (
                <button key={key} onClick={() => { setFilter(key); setShowAll(false); }} style={{
                  padding:"5px 12px", borderRadius:"999px", border:"none", cursor:"pointer",
                  fontSize:"11px", fontWeight:"600",
                  background: filter===key ? `${color}18` : "#f5f5f5",
                  color:      filter===key ? color : "#aaa",
                  outline:    filter===key ? `1.5px solid ${color}40` : "none",
                }}>{label}</button>
              ))}
            </div>
          </div>

          {filteredQs.length === 0 && (
            <p style={{ textAlign:"center", color:"#ccc", padding:"24px 0", fontSize:"13px" }}>No questions in this filter</p>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            {displayQs.map((q, i) => {
              const { text, options } = getQ(q);
              const isSkipped = !q.selectedAnswer;

              return (
                <div key={i} style={{
                  border:`1.5px solid ${q.isCorrect ? "#9FE1CB" : isSkipped ? "#FAC775" : "#F7C1C1"}`,
                  borderRadius:"14px", padding:"18px 20px",
                  background: q.isCorrect ? "#f8fffc" : isSkipped ? "#fffdf5" : "#fff8f8",
                }}>
                  {/* Question number + status */}
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"10px", marginBottom:"12px" }}>
                    <p style={{ fontSize:"14px", color:"#1a1a1a", fontWeight:"500", margin:0, lineHeight:"1.7", flex:1 }}>
                      <span style={{ color:"#bbb", fontSize:"12px", marginRight:"8px", fontWeight:"600" }}>Q{filteredQs.indexOf(q)+1}.</span>
                      {text}
                    </p>
                    <span style={{
                      flexShrink:0, fontSize:"10px", fontWeight:"700",
                      padding:"3px 10px", borderRadius:"999px",
                      background: q.isCorrect ? "#E1F5EE" : isSkipped ? "#FAEEDA" : "#FCEBEB",
                      color:      q.isCorrect ? "#085041" : isSkipped ? "#633806" : "#A32D2D",
                    }}>
                      {q.isCorrect ? "✓ Correct" : isSkipped ? "— Skipped" : "✗ Wrong"}
                    </span>
                  </div>

                  {/* Options grid */}
                  {Object.keys(options).length > 0 && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"12px" }}>
                      {["A","B","C","D"].map(letter => {
                        const isCorrectAnswer  = letter === q.correctAnswer;
                        const isStudentAnswer  = letter === q.selectedAnswer;
                        const isWrongSelection = isStudentAnswer && !q.isCorrect;

                        let bg     = "#f8f8f8";
                        let border = "1px solid #eee";
                        let color  = "#555";

                        if (isCorrectAnswer) { bg="#E1F5EE"; border="1.5px solid #9FE1CB"; color="#085041"; }
                        if (isWrongSelection){ bg="#FCEBEB"; border="1.5px solid #F7C1C1"; color="#A32D2D"; }

                        return (
                          <div key={letter} style={{ display:"flex", alignItems:"flex-start", gap:"8px", padding:"9px 12px", borderRadius:"9px", background:bg, border }}>
                            <div style={{ width:"22px", height:"22px", borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:"700", background: isCorrectAnswer?"#1D9E75":isWrongSelection?"#E24B4A":"#e0e0e0", color: (isCorrectAnswer||isWrongSelection)?"white":"#888" }}>
                              {letter}
                            </div>
                            <span style={{ fontSize:"13px", color, lineHeight:"1.4", flex:1 }}>
                              {options[letter]}
                              {isCorrectAnswer && !isStudentAnswer && (
                                <span style={{ marginLeft:"6px", fontSize:"10px", background:"#1D9E75", color:"white", padding:"1px 6px", borderRadius:"999px", fontWeight:"700" }}>Correct</span>
                              )}
                              {isStudentAnswer && isCorrectAnswer && (
                                <span style={{ marginLeft:"6px", fontSize:"10px", background:"#1D9E75", color:"white", padding:"1px 6px", borderRadius:"999px", fontWeight:"700" }}>Your answer ✓</span>
                              )}
                              {isWrongSelection && (
                                <span style={{ marginLeft:"6px", fontSize:"10px", background:"#E24B4A", color:"white", padding:"1px 6px", borderRadius:"999px", fontWeight:"700" }}>Your answer ✗</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Answer summary line */}
                  <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                    <span style={{ fontSize:"12px", padding:"4px 12px", borderRadius:"999px", fontWeight:"600", background: q.isCorrect?"#E1F5EE":"#FCEBEB", color:q.isCorrect?"#085041":"#A32D2D" }}>
                      Your answer: {q.selectedAnswer ?? "—"}
                    </span>
                    {!q.isCorrect && (
                      <span style={{ fontSize:"12px", padding:"4px 12px", borderRadius:"999px", fontWeight:"600", background:"#E1F5EE", color:"#085041" }}>
                        Correct: {q.correctAnswer}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredQs.length > 5 && (
            <button
              onClick={() => setShowAll(s => !s)}
              style={{ width:"100%", marginTop:"16px", padding:"12px", borderRadius:"10px", border:"1.5px solid #eef2ee", background:"white", cursor:"pointer", fontSize:"13px", fontWeight:"600", color:"#1D9E75" }}
            >
              {showAll ? "Show less ↑" : `Show all ${filteredQs.length} questions ↓`}
            </button>
          )}
        </div>

        {/* CTA */}
        <div style={{ display:"flex", gap:"12px", justifyContent:"center", marginTop:"20px" }}>
          {paperId && (
            <button
              onClick={() => navigate(partNumber ? `/quiz/${paperId}/part/${partNumber}` : `/quiz/${paperId}`)}
              style={{ padding:"13px 28px", borderRadius:"11px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontSize:"14px", fontWeight:"700" }}
            >
              Retry →
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