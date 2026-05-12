import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDailySession, startNextSession, markSessionComplete } from "../lib/dailyLearning";

function QuestionText({ text }) {
  if (!text) return null;
  const isMatching = text.includes("|");
  if (isMatching) {
    const pipeIdx    = text.indexOf("|");
    const beforePipe = text.substring(0, pipeIdx);
    const afterPipe  = text.substring(pipeIdx + 1);
    const aIndex     = beforePipe.search(/\ba\.\s/);
    const questionPart = aIndex > 0 ? beforePipe.substring(0, aIndex).trim() : "";
    const leftRaw      = aIndex > 0 ? beforePipe.substring(aIndex).trim() : beforePipe.trim();
    const leftItems  = parseLetterList(leftRaw);
    const rightItems = parseNumberList(afterPipe.trim());
    return (
      <div>
        {questionPart && (
          <p style={{ fontSize:"15px", fontWeight:"600", color:"#111", marginBottom:"14px", lineHeight:"1.6" }}>{questionPart}</p>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
          <div style={{ background:"#f0f4f0", borderRadius:"10px", padding:"12px" }}>
            <div style={{ fontSize:"10px", fontWeight:"700", color:"#1D9E75", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"8px" }}>List I</div>
            {leftItems.map(({ key, val }) => (
              <div key={key} style={{ display:"flex", gap:"8px", marginBottom:"6px", fontSize:"13px", color:"#333" }}>
                <span style={{ fontWeight:"700", color:"#1D9E75", flexShrink:0 }}>{key}.</span>
                <span>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ background:"#f0f4f0", borderRadius:"10px", padding:"12px" }}>
            <div style={{ fontSize:"10px", fontWeight:"700", color:"#378ADD", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"8px" }}>List II</div>
            {rightItems.map(({ key, val }) => (
              <div key={key} style={{ display:"flex", gap:"8px", marginBottom:"6px", fontSize:"13px", color:"#333" }}>
                <span style={{ fontWeight:"700", color:"#378ADD", flexShrink:0 }}>{key}.</span>
                <span>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <p style={{ fontSize:"16px", lineHeight:"1.8", color:"#1a1a1a", fontWeight:"500", margin:0 }}>{text}</p>
  );
}

function parseLetterList(raw) {
  const parts = raw.split(/(?=[a-d]\.\s)/);
  return parts.map(p => { const m = p.match(/^([a-d])\.\s+(.+)/); return m ? { key: m[1], val: m[2].trim() } : null; }).filter(Boolean);
}

function parseNumberList(raw) {
  const parts = raw.split(/(?=\d+\.\s)/);
  return parts.map(p => { const m = p.match(/^(\d+)\.\s+(.+)/); return m ? { key: m[1], val: m[2].trim() } : null; }).filter(Boolean);
}

export default function DailyLearning() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [meta,           setMeta]           = useState(null);
  const [questions,      setQuestions]      = useState([]);
  const [current,        setCurrent]        = useState(0);
  const [selected,       setSelected]       = useState(null);
  const [revealed,       setRevealed]       = useState(false);
  const [sessionDone,    setSessionDone]    = useState(false);  // current session of 20 done
  const [allDone,        setAllDone]        = useState(false);  // all 5 sessions done
  const [results,        setResults]        = useState([]);
  const [loadingNext,    setLoadingNext]    = useState(false);

  useEffect(() => { loadSession(); }, []);

  async function loadSession() {
    try {
      const res = await getDailySession(user.uid);
      if (res.error) { setError(res.error); setLoading(false); return; }
      applySession(res);
      setLoading(false);
    } catch (err) { setError(err.message); setLoading(false); }
  }

  function applySession(res) {
    setMeta({
      seenCount:      res.seenCount,
      totalAvailable: res.totalAvailable,
      cycleDay:       res.cycleDay,
      cycleDays:      res.cycleDays,
      sessionsToday:  res.sessionsToday,
      maxSessions:    res.maxSessions,
    });
    setQuestions(res.todayQuestions);
    setAllDone(res.allSessionsDone && res.session.todayCompleted);
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setSessionDone(false);
    setResults([]);
  }

  function handleSelect(letter) {
    if (revealed) return;
    setSelected(letter);
    setRevealed(true);
    setResults(r => [...r, {
      question:  questions[current],
      selected:  letter,
      correct:   questions[current].correctAnswer,
      isCorrect: letter === questions[current].correctAnswer,
    }]);
  }

  async function handleNext() {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
      setRevealed(false);
    } else {
      await markSessionComplete(user.uid);
      setSessionDone(true);
    }
  }

  async function handleNextSession() {
    setLoadingNext(true);
    try {
      const res = await startNextSession(user.uid);
      if (res.error) { setError(res.error); return; }
      applySession(res);
    } catch (err) { setError(err.message); }
    setLoadingNext(false);
  }

  const q            = questions[current];
  const progressPct  = questions.length ? Math.round(((current + (revealed ? 1 : 0)) / questions.length) * 100) : 0;
  const correctCount = results.filter(r => r.isCorrect).length;

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:"16px", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <div style={{ width:"44px", height:"44px", border:"3px solid #E1F5EE", borderTop:"3px solid #1D9E75", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <p style={{ fontWeight:"600", color:"#1D9E75", margin:0 }}>Loading today's questions...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:"14px", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <div style={{ fontSize:"40px" }}>⚠️</div>
      <p style={{ color:"#E24B4A", fontWeight:"600", textAlign:"center", maxWidth:"300px" }}>{error}</p>
      <button onClick={() => navigate("/")} style={{ padding:"10px 24px", borderRadius:"8px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontWeight:"600" }}>← Go home</button>
    </div>
  );

  // ── All 5 sessions done for today ───────────────────────────────────────────
  if (allDone) return (
    <div style={{ minHeight:"100vh", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <TopBar navigate={navigate}/>
      <div style={{ maxWidth:"520px", margin:"60px auto", padding:"0 20px", textAlign:"center" }}>
        <div style={{ fontSize:"64px", marginBottom:"16px" }}>🏆</div>
        <h2 style={{ fontSize:"24px", fontWeight:"800", color:"#111", marginBottom:"8px" }}>Amazing work!</h2>
        <p style={{ color:"#888", fontSize:"14px", lineHeight:"1.7", marginBottom:"24px" }}>
          You've completed all <strong>5 sessions (100 questions)</strong> today. That's the maximum for one day. Come back tomorrow for more!
        </p>
        <div style={{ background:"linear-gradient(135deg,#0F6E56,#1D9E75)", borderRadius:"16px", padding:"20px", color:"white", marginBottom:"20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px" }}>
            {[
              { label:"Sessions done", value:`5/5` },
              { label:"Questions done",value:`100` },
              { label:"Day",           value:`${meta?.cycleDay}/30` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background:"rgba(255,255,255,0.15)", borderRadius:"10px", padding:"10px" }}>
                <div style={{ fontSize:"20px", fontWeight:"800" }}>{value}</div>
                <div style={{ fontSize:"10px", opacity:0.75, marginTop:"2px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => navigate("/")} style={{ width:"100%", padding:"13px", borderRadius:"11px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontSize:"14px", fontWeight:"700" }}>
          ← Back to home
        </button>
      </div>
    </div>
  );

  // ── Session of 20 completed — show score + next session option ──────────────
  if (sessionDone) return (
    <div style={{ minHeight:"100vh", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <TopBar navigate={navigate}/>
      <div style={{ maxWidth:"600px", margin:"0 auto", padding:"28px 20px" }}>

        {/* Score card */}
        <div style={{ background:correctCount>=14?"linear-gradient(135deg,#0F6E56,#1D9E75)":"linear-gradient(135deg,#633806,#BA7517)", borderRadius:"20px", padding:"28px", color:"white", textAlign:"center", marginBottom:"16px" }}>
          <div style={{ fontSize:"44px", marginBottom:"8px" }}>{correctCount>=14?"🎉":correctCount>=10?"👍":"📚"}</div>
          <div style={{ fontSize:"44px", fontWeight:"800", lineHeight:1 }}>{correctCount}<span style={{ fontSize:"22px", opacity:0.75 }}>/20</span></div>
          <div style={{ fontSize:"14px", opacity:0.85, marginTop:"6px", marginBottom:"16px" }}>
            {correctCount>=14?"Excellent!":correctCount>=10?"Good effort!":"Keep practising!"}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px" }}>
            {[
              { label:"Correct",   value: correctCount },
              { label:"Wrong",     value: 20-correctCount },
              { label:"Session",   value: `${meta?.sessionsToday}/${meta?.maxSessions}` },
              { label:"Day",       value: `${meta?.cycleDay}/30` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background:"rgba(255,255,255,0.18)", borderRadius:"10px", padding:"10px 6px" }}>
                <div style={{ fontSize:"18px", fontWeight:"800" }}>{value}</div>
                <div style={{ fontSize:"10px", opacity:0.75, marginTop:"2px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sessions remaining indicator */}
        <div style={{ background:"white", border:"1px solid #e8eee8", borderRadius:"14px", padding:"16px 20px", marginBottom:"16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
            <span style={{ fontWeight:"700", fontSize:"13px", color:"#111" }}>Today's sessions</span>
            <span style={{ fontSize:"13px", color:"#1D9E75", fontWeight:"700" }}>
              {meta?.sessionsToday}/{meta?.maxSessions} done
            </span>
          </div>
          <div style={{ display:"flex", gap:"6px" }}>
            {Array.from({ length: meta?.maxSessions ?? 5 }, (_, i) => (
              <div key={i} style={{ flex:1, height:"8px", borderRadius:"999px", background: i < (meta?.sessionsToday ?? 0) ? "#1D9E75" : "#f0f0f0", transition:"background 0.3s" }}/>
            ))}
          </div>
          <p style={{ fontSize:"12px", color:"#aaa", margin:"8px 0 0" }}>
            {(meta?.maxSessions ?? 5) - (meta?.sessionsToday ?? 0)} session{(meta?.maxSessions ?? 5) - (meta?.sessionsToday ?? 0) !== 1 ? "s" : ""} remaining today
          </p>
        </div>

        {/* Quick review */}
        <div style={{ background:"white", borderRadius:"14px", border:"1px solid #e8eee8", padding:"16px 20px", marginBottom:"16px" }}>
          <p style={{ fontWeight:"700", fontSize:"13px", color:"#111", marginBottom:"12px" }}>Quick review</p>
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {results.map((r, i) => (
              <div key={i} style={{ border:`1.5px solid ${r.isCorrect?"#9FE1CB":"#F7C1C1"}`, borderRadius:"10px", padding:"10px 14px", background:r.isCorrect?"#f8fffc":"#fff8f8" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:"8px", marginBottom:"6px" }}>
                  <p style={{ fontSize:"12px", color:"#333", margin:0, lineHeight:"1.4", flex:1 }}>
                    <span style={{ color:"#bbb", marginRight:"5px" }}>Q{i+1}.</span>{r.question.text?.slice(0,80)}{r.question.text?.length > 80 ? "..." : ""}
                  </p>
                  <span style={{ fontSize:"10px", fontWeight:"700", padding:"2px 7px", borderRadius:"999px", flexShrink:0, background:r.isCorrect?"#E1F5EE":"#FCEBEB", color:r.isCorrect?"#085041":"#A32D2D" }}>
                    {r.isCorrect?"✓":"✗"}
                  </span>
                </div>
                {!r.isCorrect && (
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    <span style={{ fontSize:"11px", padding:"2px 8px", borderRadius:"999px", background:"#FCEBEB", color:"#A32D2D", fontWeight:"600" }}>You: {r.selected}</span>
                    <span style={{ fontSize:"11px", padding:"2px 8px", borderRadius:"999px", background:"#E1F5EE", color:"#085041", fontWeight:"600" }}>Correct: {r.correct}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {(meta?.sessionsToday ?? 0) < (meta?.maxSessions ?? 5) && (
            <button
              onClick={handleNextSession}
              disabled={loadingNext}
              style={{ width:"100%", padding:"14px", borderRadius:"11px", border:"none", background:loadingNext?"#ccc":"#1D9E75", color:"white", cursor:loadingNext?"not-allowed":"pointer", fontSize:"15px", fontWeight:"700" }}
            >
              {loadingNext ? "Loading..." : `Start session ${(meta?.sessionsToday ?? 0) + 1} → (20 more questions)`}
            </button>
          )}
          <button onClick={() => navigate("/")} style={{ width:"100%", padding:"13px", borderRadius:"11px", border:"1.5px solid #ddd", background:"white", cursor:"pointer", fontSize:"14px", fontWeight:"600", color:"#555" }}>
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main quiz UI ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#f4f7f4", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <TopBar navigate={navigate} sessionsToday={meta?.sessionsToday} maxSessions={meta?.maxSessions}/>
      <div style={{ height:"4px", background:"#e8eee8" }}>
        <div style={{ height:"100%", background:"#1D9E75", width:`${progressPct}%`, transition:"width 0.4s" }}/>
      </div>
      <div style={{ maxWidth:"620px", margin:"0 auto", padding:"24px 20px" }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px" }}>
          <div>
            <div style={{ fontWeight:"800", fontSize:"18px", color:"#111" }}>
              Q{current+1} <span style={{ color:"#ccc", fontWeight:"400", fontSize:"15px" }}>/ {questions.length}</span>
            </div>
            <div style={{ fontSize:"12px", color:"#aaa", marginTop:"2px" }}>
              Session {meta?.sessionsToday}/{meta?.maxSessions} · Day {meta?.cycleDay}/30 · {q?.subject}
            </div>
          </div>
          <div style={{ display:"flex", gap:"4px" }}>
            {questions.map((_, i) => (
              <div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%", background:i<=current?"#1D9E75":"#e0e0e0", opacity:i===current?1:i<current?0.6:0.3 }}/>
            ))}
          </div>
        </div>

        <div style={{ background:"white", border:"1px solid #e8eee8", borderRadius:"18px", padding:"28px 28px 24px", marginBottom:"16px", boxShadow:"0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", gap:"8px", marginBottom:"14px" }}>
            <span style={{ background:"#E1F5EE", color:"#085041", fontSize:"10px", fontWeight:"700", padding:"3px 10px", borderRadius:"999px" }}>Daily Learning</span>
            <span style={{ background:"#f0f4f0", color:"#888", fontSize:"10px", fontWeight:"600", padding:"3px 10px", borderRadius:"999px" }}>{q?.year}</span>
          </div>
          <QuestionText text={q?.text} />
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"20px" }}>
          {["A","B","C","D"].map(letter => {
            const isCorrect  = letter === q?.correctAnswer;
            const isSelected = letter === selected;
            const isWrong    = isSelected && !isCorrect;
            let bg="white", border="1.5px solid #e8eee8", color="#2a2a2a";
            let circleBg="#f0f4f0", circleColor="#999";
            if (revealed) {
              if (isCorrect)    { bg="#E1F5EE"; border="2px solid #1D9E75"; color="#085041"; circleBg="#1D9E75"; circleColor="white"; }
              else if (isWrong) { bg="#FCEBEB"; border="2px solid #E24B4A"; color="#A32D2D"; circleBg="#E24B4A"; circleColor="white"; }
              else              { bg="#fafafa"; border="1.5px solid #eee";  color="#bbb"; circleColor="#ccc"; }
            } else if (isSelected) { bg="#E1F5EE"; border="2px solid #1D9E75"; color="#085041"; circleBg="#1D9E75"; circleColor="white"; }
            return (
              <div key={letter} onClick={() => handleSelect(letter)} style={{ display:"flex", alignItems:"flex-start", gap:"12px", padding:"14px 18px", borderRadius:"14px", border, background:bg, cursor:revealed?"default":"pointer", transition:"all 0.15s" }}>
                <div style={{ width:"32px", height:"32px", borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", fontWeight:"700", background:circleBg, color:circleColor, marginTop:"1px" }}>
                  {letter}
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:"14px", lineHeight:"1.6", color, fontWeight:revealed&&isCorrect?"600":"400" }}>
                    {q?.options?.[letter]}
                  </span>
                  {revealed && isCorrect && !isSelected && <span style={{ marginLeft:"8px", fontSize:"10px", background:"#1D9E75", color:"white", padding:"2px 8px", borderRadius:"999px", fontWeight:"700" }}>✓ Correct</span>}
                  {revealed && isSelected && isCorrect && <span style={{ marginLeft:"8px", fontSize:"10px", background:"#1D9E75", color:"white", padding:"2px 8px", borderRadius:"999px", fontWeight:"700" }}>Your answer ✓</span>}
                  {isWrong && <span style={{ marginLeft:"8px", fontSize:"10px", background:"#E24B4A", color:"white", padding:"2px 8px", borderRadius:"999px", fontWeight:"700" }}>Your answer ✗</span>}
                </div>
              </div>
            );
          })}
        </div>

        {revealed && (
          <div style={{ background:selected===q?.correctAnswer?"#E1F5EE":"#FFF3CD", border:`1.5px solid ${selected===q?.correctAnswer?"#9FE1CB":"#FAC775"}`, borderRadius:"14px", padding:"16px 20px", marginBottom:"20px", animation:"fadeIn 0.3s ease" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" }}>
              <span style={{ fontSize:"18px" }}>{selected===q?.correctAnswer?"🎯":"💡"}</span>
              <span style={{ fontWeight:"700", fontSize:"14px", color:selected===q?.correctAnswer?"#085041":"#633806" }}>
                {selected===q?.correctAnswer?"Correct!":` Correct answer is ${q?.correctAnswer}`}
              </span>
            </div>
            <p style={{ fontSize:"13px", color:selected===q?.correctAnswer?"#085041":"#633806", margin:0, lineHeight:"1.5", opacity:0.85 }}>
              {selected===q?.correctAnswer
                ? `Well done! "${q?.options?.[q?.correctAnswer]}" is the right answer.`
                : `"${q?.options?.[q?.correctAnswer]}" is correct. You selected "${q?.options?.[selected]}".`}
            </p>
          </div>
        )}

        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {revealed ? (
          <button onClick={handleNext} style={{ width:"100%", padding:"15px", borderRadius:"12px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontSize:"15px", fontWeight:"700", animation:"fadeIn 0.3s ease" }}
            onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
            onMouseLeave={e=>e.currentTarget.style.opacity="1"}
          >
            {current < questions.length-1 ? "Next question →" : "Finish session 🎉"}
          </button>
        ) : (
          <p style={{ textAlign:"center", fontSize:"13px", color:"#bbb", fontWeight:"500" }}>
            Tap an option to reveal the answer
          </p>
        )}
      </div>
    </div>
  );
}

function TopBar({ navigate, sessionsToday, maxSessions }) {
  return (
    <div style={{ background:"white", borderBottom:"1px solid #e8eee8", padding:"0 20px", height:"54px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
        <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#1D9E75" }}/>
        <span style={{ fontWeight:"700", fontSize:"14px", color:"#111" }}>Daily Learning</span>
        {sessionsToday && (
          <span style={{ fontSize:"11px", background:"#E1F5EE", color:"#085041", padding:"2px 8px", borderRadius:"999px", fontWeight:"600" }}>
            Session {sessionsToday}/{maxSessions}
          </span>
        )}
      </div>
      <button onClick={() => navigate("/")} style={{ padding:"7px 14px", borderRadius:"8px", border:"1.5px solid #eee", background:"white", cursor:"pointer", fontSize:"12px", color:"#888", fontWeight:"500" }}>
        ← Home
      </button>
    </div>
  );
}