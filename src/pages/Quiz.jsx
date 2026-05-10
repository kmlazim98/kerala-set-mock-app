import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { fetchPaperQuestions } from "../lib/uploadPaper";

const Q_PER_PART   = 30;
const PART_MINUTES = 30;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Quiz() {
  const { paperId, partNumber } = useParams();
  const partNum  = partNumber ? parseInt(partNumber, 10) : null;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [questions,  setQuestions]  = useState([]);
  const [current,    setCurrent]    = useState(0);
  const [quizId,     setQuizId]     = useState(null);
  const [paperData,  setPaperData]  = useState(null);
  const [startedAt]                 = useState(Date.now());
  const [timeLeft,   setTimeLeft]   = useState(PART_MINUTES * 60);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function buildQuiz() {
      try {
        const paperSnap = await getDoc(doc(db, "papers", paperId));
        if (!paperSnap.exists()) { setError("Paper not found."); setLoading(false); return; }
        const pd = paperSnap.data();
        setPaperData(pd);

        const allQs = await fetchPaperQuestions(paperId);
        if (allQs.length === 0) { setError("No questions found for this paper."); setLoading(false); return; }

        const picked = shuffle(allQs).slice(0, Math.min(Q_PER_PART, allQs.length));
        const duration = partNum ? PART_MINUTES : (pd.durationMinutes ?? 120);
        setTimeLeft(duration * 60);

        const enriched = picked.map(q => ({ ...q, selectedAnswer: null, flaggedForReview: false }));

        const docRef = await addDoc(collection(db, "attemptedQuizzes"), {
          userId:      user.uid,
          paperId,
          partNumber:  partNum,
          paperTitle:  pd.title,
          quizType:    partNum ? "PART_PRACTICE" : "PREVIOUS_YEAR",
          startedAt:   serverTimestamp(),
          status:      "IN_PROGRESS",
          questions:   enriched.map(q => ({
            questionId: q.id, questionText: q.text, options: q.options,
            selectedAnswer: null, correctAnswer: q.correctAnswer,
            isCorrect: false, flaggedForReview: false,
          })),
          score: null,
        });

        setQuizId(docRef.id);
        setQuestions(enriched);
        setLoading(false);
      } catch (err) { setError(err.message); setLoading(false); }
    }
    buildQuiz();
  }, [paperId, partNumber]);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft === 0 && quizId && !submitting) handleSubmit(true);
  }, [timeLeft]);

  function selectAnswer(letter) {
    setQuestions(qs => qs.map((q, i) => i === current ? { ...q, selectedAnswer: letter } : q));
  }

  function toggleFlag() {
    setQuestions(qs => qs.map((q, i) => i === current ? { ...q, flaggedForReview: !q.flaggedForReview } : q));
  }

  async function handleSubmit(auto = false) {
    if (!auto && !window.confirm(`Submit? You've answered ${questions.filter(q => q.selectedAnswer).length} of ${questions.length} questions.`)) return;
    setSubmitting(true);
    const correct   = questions.filter(q => q.selectedAnswer === q.correctAnswer).length;
    const incorrect = questions.filter(q => q.selectedAnswer && q.selectedAnswer !== q.correctAnswer).length;
    const skipped   = questions.filter(q => !q.selectedAnswer).length;
    const score = { correct, incorrect, skipped, total: questions.length, percentage: Math.round((correct / questions.length) * 100) };
    await updateDoc(doc(db, "attemptedQuizzes", quizId), {
      submittedAt: serverTimestamp(), status: "SUBMITTED",
      durationSeconds: Math.round((Date.now() - startedAt) / 1000), score,
      questions: questions.map(q => ({
        questionId: q.id, questionText: q.text, options: q.options,
        selectedAnswer: q.selectedAnswer, correctAnswer: q.correctAnswer,
        isCorrect: q.selectedAnswer === q.correctAnswer, flaggedForReview: q.flaggedForReview,
      })),
    });
    navigate(`/results/${quizId}`);
  }

  const hrs  = Math.floor(timeLeft / 3600);
  const mins = Math.floor((timeLeft % 3600) / 60);
  const secs = timeLeft % 60;
  const fmt  = n => String(n).padStart(2, "0");
  const isLow = timeLeft < 180;
  const answeredCount = questions.filter(q => q.selectedAnswer).length;
  const flaggedCount  = questions.filter(q => q.flaggedForReview).length;
  const progressPct   = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:"16px", background:"#f4f7f4" }}>
      <div style={{ width:"44px", height:"44px", border:"3px solid #E1F5EE", borderTop:"3px solid #1D9E75", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <p style={{ fontWeight:"600", color:"#1D9E75", fontSize:"15px", margin:0 }}>{partNum ? `Loading Part ${partNum}...` : "Loading paper..."}</p>
      <p style={{ fontSize:"13px", color:"#aaa", margin:0 }}>Picking {Q_PER_PART} random questions</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:"14px" }}>
      <p style={{ fontWeight:"600", color:"#E24B4A" }}>{error}</p>
      <button onClick={() => navigate("/")} style={{ padding:"10px 24px", borderRadius:"8px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontWeight:"600" }}>← Go home</button>
    </div>
  );

  const q = questions[current];

  return (
    <div style={{ minHeight:"100vh", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>

      <div style={{ background:"white", borderBottom:"1px solid #e8eee8", padding:"0 24px", height:"58px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#1D9E75" }}/>
            <span style={{ fontWeight:"700", fontSize:"14px", color:"#111" }}>Kerala SET prep</span>
          </div>
          {paperData && (
            <span style={{ fontSize:"12px", color:"#999", borderLeft:"1px solid #eee", paddingLeft:"12px" }}>
              {paperData.subject} · {paperData.year}
              {partNum && <span style={{ marginLeft:"8px", background:"#E1F5EE", color:"#085041", fontSize:"10px", fontWeight:"700", padding:"2px 8px", borderRadius:"999px" }}>Part {partNum}</span>}
            </span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ background:isLow?"#FCEBEB":"#E1F5EE", color:isLow?"#A32D2D":"#085041", padding:"7px 16px", borderRadius:"999px", fontSize:"15px", fontWeight:"700", border:`1px solid ${isLow?"#F7C1C1":"#9FE1CB"}`, animation:isLow?"pulse 1s ease-in-out infinite":"none" }}>
            ⏱ {hrs > 0 ? `${hrs}:` : ""}{fmt(mins)}:{fmt(secs)}
          </div>
          <button onClick={() => handleSubmit(false)} disabled={submitting} style={{ padding:"9px 22px", borderRadius:"9px", border:"none", background:submitting?"#ccc":"#E24B4A", color:"white", cursor:submitting?"not-allowed":"pointer", fontSize:"13px", fontWeight:"700" }}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      <div style={{ height:"3px", background:"#e8eee8" }}>
        <div style={{ height:"100%", background:"#1D9E75", width:`${progressPct}%`, transition:"width 0.5s" }}/>
      </div>

      <div style={{ maxWidth:"1020px", margin:"0 auto", padding:"28px 20px", display:"grid", gridTemplateColumns:"1fr 240px", gap:"22px", alignItems:"start" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ fontWeight:"800", fontSize:"20px", color:"#111" }}>Q{current+1}</span>
              <span style={{ color:"#ccc", fontSize:"15px" }}>/ {questions.length}</span>
              {partNum && <span style={{ background:"#E1F5EE", color:"#085041", fontSize:"11px", fontWeight:"600", padding:"3px 10px", borderRadius:"999px" }}>Part {partNum}</span>}
            </div>
            <button onClick={toggleFlag} style={{ padding:"8px 16px", borderRadius:"9px", cursor:"pointer", fontSize:"13px", fontWeight:"500", border:q.flaggedForReview?"1.5px solid #EF9F27":"1.5px solid #e0e0e0", background:q.flaggedForReview?"#FAEEDA":"white", color:q.flaggedForReview?"#633806":"#777" }}>
              {q.flaggedForReview ? "⚑ Flagged" : "⚐ Flag"}
            </button>
          </div>

          <div style={{ background:"white", border:"1px solid #e8eee8", borderRadius:"16px", padding:"26px 30px", marginBottom:"18px" }}>
            <p style={{ fontSize:"16px", lineHeight:"1.8", color:"#1a1a1a", fontWeight:"500", margin:0 }}>{q.text}</p>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"11px", marginBottom:"28px" }}>
            {["A","B","C","D"].map(letter => {
              const sel = q.selectedAnswer === letter;
              return (
                <div key={letter} onClick={() => selectAnswer(letter)} style={{ display:"flex", alignItems:"center", gap:"14px", padding:"15px 20px", cursor:"pointer", borderRadius:"13px", border:sel?"2px solid #1D9E75":"1.5px solid #e8eee8", background:sel?"#E1F5EE":"white", boxShadow:sel?"0 0 0 4px rgba(29,158,117,0.08)":"0 1px 3px rgba(0,0,0,0.04)", transition:"all 0.12s" }}>
                  <div style={{ width:"36px", height:"36px", borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", fontWeight:"700", background:sel?"#1D9E75":"#f0f4f0", color:sel?"white":"#999", transition:"all 0.12s" }}>{letter}</div>
                  <span style={{ fontSize:"15px", lineHeight:"1.5", color:sel?"#085041":"#2a2a2a", fontWeight:sel?"500":"400", flex:1 }}>{q.options[letter]}</span>
                  {sel && <div style={{ width:"22px", height:"22px", borderRadius:"50%", background:"#1D9E75", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
                </div>
              );
            })}
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <button onClick={() => setCurrent(c => Math.max(0,c-1))} disabled={current===0} style={{ padding:"11px 22px", borderRadius:"10px", border:"1.5px solid #ddd", background:"white", cursor:current===0?"not-allowed":"pointer", fontSize:"13px", fontWeight:"600", color:"#555", opacity:current===0?0.35:1 }}>← Previous</button>
            <span style={{ fontSize:"12px", color:"#bbb", fontWeight:"500" }}>{answeredCount} / {questions.length} answered</span>
            <button onClick={() => setCurrent(c => Math.min(questions.length-1,c+1))} disabled={current===questions.length-1} style={{ padding:"11px 22px", borderRadius:"10px", border:"none", background:current===questions.length-1?"#ccc":"#1D9E75", color:"white", cursor:current===questions.length-1?"not-allowed":"pointer", fontSize:"13px", fontWeight:"600" }}>Next →</button>
          </div>
        </div>

        <div style={{ position:"sticky", top:"82px", display:"flex", flexDirection:"column", gap:"12px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px" }}>
            {[{label:"Done",val:answeredCount,bg:"#E1F5EE",color:"#085041"},{label:"Flagged",val:flaggedCount,bg:"#FAEEDA",color:"#633806"},{label:"Left",val:questions.length-answeredCount,bg:"white",color:"#888"}].map(({label,val,bg,color}) => (
              <div key={label} style={{ background:bg, border:"1px solid #e8eee8", borderRadius:"11px", padding:"10px 6px", textAlign:"center" }}>
                <div style={{ fontSize:"20px", fontWeight:"800", color, lineHeight:1 }}>{val}</div>
                <div style={{ fontSize:"10px", color, opacity:0.75, marginTop:"3px", fontWeight:"500" }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ background:"white", border:"1px solid #e8eee8", borderRadius:"14px", padding:"16px" }}>
            <p style={{ fontSize:"10px", fontWeight:"700", color:"#bbb", letterSpacing:"0.08em", textTransform:"uppercase", margin:"0 0 12px" }}>Navigator</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"5px", marginBottom:"14px" }}>
              {questions.map((qItem,i) => {
                const isCur=i===current, isFl=qItem.flaggedForReview, isAns=!!qItem.selectedAnswer;
                return <button key={i} onClick={()=>setCurrent(i)} style={{ width:"100%", aspectRatio:"1", borderRadius:"7px", fontSize:"11px", fontWeight:"700", cursor:"pointer", outline:isCur?"2px solid #1D9E75":"none", outlineOffset:"1px", border:"none", background:isCur?"#1D9E75":isFl?"#FAEEDA":isAns?"#E1F5EE":"#f0f4f0", color:isCur?"white":isFl?"#633806":isAns?"#085041":"#bbb" }}>{i+1}</button>;
              })}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"5px", borderTop:"1px solid #f0f0f0", paddingTop:"11px" }}>
              {[{bg:"#E1F5EE",border:"#9FE1CB",label:`Answered (${answeredCount})`},{bg:"#FAEEDA",border:"#FAC775",label:`Flagged (${flaggedCount})`},{bg:"#f0f4f0",border:"#ddd",label:`Remaining (${questions.length-answeredCount})`}].map(({bg,border,label}) => (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:"7px", fontSize:"11px", color:"#888" }}>
                  <div style={{ width:"11px", height:"11px", borderRadius:"3px", background:bg, border:`1px solid ${border}`, flexShrink:0 }}/>{label}
                </div>
              ))}
            </div>
            <div style={{ marginTop:"12px", borderTop:"1px solid #f0f0f0", paddingTop:"11px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:"#bbb", marginBottom:"5px" }}>
                <span>Progress</span><span style={{ fontWeight:"700", color:"#1D9E75" }}>{progressPct}%</span>
              </div>
              <div style={{ height:"5px", borderRadius:"999px", background:"#eef2ee", overflow:"hidden" }}>
                <div style={{ height:"100%", background:"#1D9E75", width:`${progressPct}%`, borderRadius:"999px", transition:"width 0.5s" }}/>
              </div>
            </div>
          </div>

          <button onClick={()=>handleSubmit(false)} disabled={submitting} style={{ width:"100%", padding:"13px", borderRadius:"11px", border:"none", background:submitting?"#ccc":"#1D9E75", color:"white", cursor:submitting?"not-allowed":"pointer", fontSize:"14px", fontWeight:"700" }}>
            {submitting ? "Submitting..." : "Submit test →"}
          </button>
        </div>
      </div>
    </div>
  );
}