import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { fetchAllActiveQuestions, saveSessionAnswers, completeSession, QUESTIONS_PER_SESSION } from "../lib/dailyLearning";
import QuestionRenderer from "../components/QuestionRenderer";
import { generateSessionPDF } from "../lib/generateSessionPDF";

export default function DailySession() {
  const { num }       = useParams();
  const sessionIndex  = parseInt(num, 10) - 1;
  const { user }      = useAuth();
  const navigate      = useNavigate();

  const [questions, setQuestions]   = useState([]);
  const [answers,   setAnswers]     = useState({});
  const [current,   setCurrent]     = useState(0);
  const [submitted, setSubmitted]   = useState(false);
  const [score,     setScore]       = useState(null);
  const [loading,   setLoading]     = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error,     setError]       = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const ref  = doc(db, "dailyLearning", user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) { setError("Session not found."); setLoading(false); return; }

        const session = snap.data().sessions?.[sessionIndex];
        if (!session) { setError("Session not found."); setLoading(false); return; }

        if (session.answers) setAnswers(session.answers);
        if (session.completed && session.score) {
          setSubmitted(true);
          setScore(session.score);
        }

        const allQs = await fetchAllActiveQuestions();
        const map   = Object.fromEntries(allQs.map(q => [q.id, q]));
        setQuestions(session.questionIds.map(id => map[id]).filter(Boolean));
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    }
    load();
  }, [user.uid, sessionIndex]);

  async function handleAnswer(qId, opt) {
    const newAnswers = { ...answers, [qId]: opt };
    setAnswers(newAnswers);
    await saveSessionAnswers(user.uid, sessionIndex, newAnswers);
  }

  async function handleSubmit() {
    const correct  = questions.filter(q => answers[q.id] === q.correctAnswer).length;
    const wrong    = questions.filter(q => answers[q.id] && answers[q.id] !== q.correctAnswer).length;
    const skipped  = questions.length - correct - wrong;
    const newScore = { correct, wrong, skipped, percentage: Math.round((correct / questions.length) * 100) };

    await completeSession(user.uid, sessionIndex, answers, newScore);
    setScore(newScore);
    setSubmitted(true);
  }

  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh", background:"#f4f7f4" }}>
      <div style={{ width:36, height:36, border:"3px solid #E1F5EE", borderTop:"3px solid #1D9E75", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:12, fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <p style={{ color:"#E24B4A", fontWeight:600 }}>{error}</p>
      <button onClick={() => navigate("/daily")} style={{ padding:"10px 20px", background:"#1D9E75", color:"white", border:"none", borderRadius:8, cursor:"pointer" }}>← Back</button>
    </div>
  );

  if (submitted && score) {
    const passed = score.percentage >= 55;

    async function handlePDF() {
      setPdfLoading(true);
      try {
        generateSessionPDF({
          sessionNumber:   parseInt(num, 10),
          date:            new Date().toISOString().split("T")[0],
          score,
          questions,
          answers,
          subject:         questions[0]?.subject ?? "",
          year:            questions[0]?.year    ?? "",
        });
      } catch (e) {
        alert("PDF failed: " + e.message);
      }
      setPdfLoading(false);
    }

    return (
      <div style={{ minHeight:"100vh", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
        <div style={{ background:"white", borderBottom:"1px solid #eee", padding:"0 20px", height:54, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontWeight:700, fontSize:14 }}>Session {num} · Results</span>
          <button onClick={() => navigate("/daily")} style={{ padding:"7px 14px", borderRadius:8, border:"1.5px solid #eee", background:"white", cursor:"pointer", fontSize:12, color:"#888" }}>← Sessions</button>
        </div>
        <div style={{ maxWidth:520, margin:"0 auto", padding:"32px 20px", textAlign:"center" }}>
          <div style={{
            background: passed ? "linear-gradient(135deg,#0F6E56,#1D9E75)" : "linear-gradient(135deg,#633806,#BA7517)",
            borderRadius:20, padding:32, color:"white", marginBottom:16,
          }}>
            <div style={{ fontSize:48, marginBottom:10 }}>{passed ? "🎉" : "📚"}</div>
            <div style={{ fontSize:44, fontWeight:800, lineHeight:1 }}>{score.percentage}%</div>
            <div style={{ fontSize:14, opacity:0.85, marginTop:6, marginBottom:18 }}>
              {passed ? "Passed!" : "Keep practising!"} · Session {num} of 5
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {[{ label:"Correct", value: score.correct }, { label:"Wrong", value: score.wrong }, { label:"Skipped", value: score.skipped }].map(({ label, value }) => (
                <div key={label} style={{ background:"rgba(255,255,255,0.18)", borderRadius:10, padding:10 }}>
                  <div style={{ fontSize:20, fontWeight:800 }}>{value}</div>
                  <div style={{ fontSize:10, opacity:0.75, marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button
              onClick={handlePDF}
              disabled={pdfLoading}
              style={{ width:"100%", padding:13, borderRadius:11, border:"none", background: pdfLoading ? "#aaa" : "#1a237e", color:"white", cursor: pdfLoading ? "not-allowed" : "pointer", fontSize:14, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
            >
              {pdfLoading
                ? <><span style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.3)", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" }}/> Generating...</>
                : "📄 Download PDF Report"}
            </button>
            <button
              onClick={() => navigate("/daily")}
              style={{ width:"100%", padding:13, borderRadius:11, border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontSize:14, fontWeight:700 }}
            >
              ← Back to sessions
            </button>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      </div>
    );
  }

  const q          = questions[current];
  const selected   = q ? answers[q.id] : null;
  const revealed   = selected != null;          // show correct/wrong once answered
  const isCorrect  = revealed && selected === q?.correctAnswer;

  if (!q) return null;

  function optionStyle(opt) {
    if (!revealed) {
      return {
        background: "white",
        border: "1.5px solid #eef2ee",
      };
    }
    if (opt === q.correctAnswer) {
      return { background: "#E1F5EE", border: "2px solid #1D9E75" };
    }
    if (opt === selected) {
      return { background: "#FCEBEB", border: "2px solid #E24B4A" };
    }
    return { background: "white", border: "1.5px solid #eef2ee", opacity: 0.5 };
  }

  function circleStyle(opt) {
    if (!revealed) return { background: "#f0f4f0", color: "#555" };
    if (opt === q.correctAnswer) return { background: "#1D9E75", color: "white" };
    if (opt === selected)        return { background: "#E24B4A", color: "white" };
    return { background: "#f0f4f0", color: "#bbb" };
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      {/* Top bar */}
      <div style={{ background:"white", borderBottom:"1px solid #eee", padding:"0 20px", height:54, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontWeight:700, fontSize:14, color:"#111" }}>
          Session {num} · Q{current + 1}/{questions.length}
        </span>
        <button onClick={() => navigate("/daily")} style={{ padding:"7px 14px", borderRadius:8, border:"1.5px solid #eee", background:"white", cursor:"pointer", fontSize:12, color:"#888" }}>
          ← Exit
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height:3, background:"#E1F5EE" }}>
        <div style={{ height:"100%", background:"#1D9E75", width:`${((current + 1) / questions.length) * 100}%`, transition:"width 0.3s" }}/>
      </div>

      <div style={{ maxWidth:640, margin:"0 auto", padding:"24px 20px" }}>

        {/* Question card */}
        <div style={{ background:"white", borderRadius:14, padding:"22px 20px", marginBottom:16, border:"1.5px solid #eef2ee" }}>
          <div style={{ fontSize:11, color:"#1D9E75", fontWeight:700, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.05em" }}>
            Question {current + 1}
          </div>
          <QuestionRenderer text={q.text} />
        </div>

        {/* Options */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {["A", "B", "C", "D"].map(opt => {
            const label = q.options?.[opt];
            if (!label) return null;
            return (
              <div
                key={opt}
                onClick={() => !revealed && handleAnswer(q.id, opt)}
                style={{
                  ...optionStyle(opt),
                  borderRadius:12, padding:"14px 16px",
                  cursor: revealed ? "default" : "pointer",
                  display:"flex", alignItems:"center", gap:12, transition:"all 0.2s",
                }}
              >
                <div style={{
                  width:28, height:28, borderRadius:"50%", flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontWeight:700, fontSize:13, transition:"all 0.2s",
                  ...circleStyle(opt),
                }}>
                  {opt}
                </div>
                <span style={{ fontSize:14, color:"#111", lineHeight:1.5 }}>{label}</span>
                {revealed && opt === q.correctAnswer && (
                  <span style={{ marginLeft:"auto", fontSize:12, fontWeight:700, color:"#1D9E75" }}>✓ Correct</span>
                )}
                {revealed && opt === selected && opt !== q.correctAnswer && (
                  <span style={{ marginLeft:"auto", fontSize:12, fontWeight:700, color:"#E24B4A" }}>✗ Wrong</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Inline feedback banner */}
        {revealed && (
          <div style={{
            background: isCorrect ? "#E1F5EE" : "#FCEBEB",
            border: `1.5px solid ${isCorrect ? "#1D9E75" : "#E24B4A"}`,
            borderRadius:10, padding:"10px 16px", marginBottom:16,
            fontSize:13, fontWeight:600,
            color: isCorrect ? "#085041" : "#7a1a1a",
          }}>
            {isCorrect ? "Well done! That's correct." : `Correct answer: ${q.correctAnswer}. ${q.options?.[q.correctAnswer] ?? ""}`}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display:"flex", gap:10 }}>
          {current > 0 && (
            <button
              onClick={() => setCurrent(c => c - 1)}
              style={{ flex:1, padding:13, borderRadius:11, border:"1.5px solid #ddd", background:"white", cursor:"pointer", fontSize:14, fontWeight:600, color:"#555" }}
            >
              ← Prev
            </button>
          )}
          {current < questions.length - 1 ? (
            <button
              onClick={() => setCurrent(c => c + 1)}
              style={{ flex:2, padding:13, borderRadius:11, border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontSize:14, fontWeight:700 }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              style={{ flex:2, padding:13, borderRadius:11, border:"none", background:"#1a237e", color:"white", cursor:"pointer", fontSize:14, fontWeight:700 }}
            >
              Submit Session
            </button>
          )}
        </div>

        <p style={{ textAlign:"center", fontSize:12, color:"#bbb", marginTop:12 }}>
          {Object.keys(answers).length}/{QUESTIONS_PER_SESSION} answered
        </p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}
