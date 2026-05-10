import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchActivePapers } from "../lib/uploadPaper";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

const PARTS        = 4;
const Q_PER_PART   = 30;
const PART_MINUTES = 30;

export default function StudentHome() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [papers,   setPapers]   = useState([]);
  const [attempts, setAttempts] = useState({});
  const [history,  setHistory]  = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      const ps = await fetchActivePapers();
      setPapers(ps);

      const snap = await getDocs(
        query(collection(db, "attemptedQuizzes"),
          where("userId", "==", user.uid),
          where("status",  "==", "SUBMITTED"))
      );

      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0));

      setHistory(all.slice(0, 5));

      const map = {};
      all.forEach(d => {
        if (!d.paperId) return;
        const n   = d.partNumber ?? 0;
        const key = `${d.paperId}_part${n}`;
        if (map[key] === undefined || d.score.percentage > map[key]) {
          map[key] = d.score.percentage;
        }
      });
      setAttempts(map);
      setLoading(false);
    }
    load();
  }, []);

  const allScores   = Object.values(attempts);
  const totalTests  = allScores.length;
  const bestScore   = totalTests ? Math.max(...allScores) : null;
  const avgScore    = totalTests ? Math.round(allScores.reduce((a,b)=>a+b,0)/totalTests) : null;
  const passedCount = allScores.filter(s => s >= 55).length;

  const fmtDate = ts => ts?.seconds
    ? new Date(ts.seconds*1000).toLocaleDateString("en-IN",{day:"numeric",month:"short"})
    : "";

  const toggleExpand = id =>
    setExpanded(p => ({ ...p, [id]: !p[id] }));

  if (loading) return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"60vh"}}>
      <div style={{width:"36px",height:"36px",border:"3px solid #E1F5EE",borderTop:"3px solid #1D9E75",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  return (
    <div style={{fontFamily:"system-ui,-apple-system,sans-serif"}}>

      {/* Stats banner */}
      {totalTests > 0 && (
        <div style={{background:"linear-gradient(135deg,#0F6E56,#1D9E75)",borderRadius:"16px",padding:"24px 28px",marginBottom:"24px",color:"white"}}>
          <p style={{fontSize:"11px",opacity:0.7,fontWeight:"700",letterSpacing:"0.08em",textTransform:"uppercase",margin:"0 0 14px"}}>Your performance</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"16px"}}>
            {[
              {label:"Parts taken", value: totalTests},
              {label:"Best score",  value: bestScore!=null?`${bestScore}%`:"—"},
              {label:"Average",     value: avgScore!=null?`${avgScore}%`:"—"},
              {label:"Passed",      value: `${passedCount}/${totalTests}`},
            ].map(({label,value}) => (
              <div key={label}>
                <div style={{fontSize:"26px",fontWeight:"800",lineHeight:1}}>{value}</div>
                <div style={{fontSize:"12px",opacity:0.7,marginTop:"4px"}}>{label}</div>
              </div>
            ))}
          </div>
          {history.length > 0 && (
            <div style={{marginTop:"16px",borderTop:"1px solid rgba(255,255,255,0.15)",paddingTop:"14px"}}>
              <p style={{fontSize:"11px",opacity:0.6,margin:"0 0 8px",fontWeight:"700",letterSpacing:"0.05em",textTransform:"uppercase"}}>Recent attempts</p>
              <div style={{display:"flex",alignItems:"flex-end",gap:"6px",height:"44px"}}>
                {[...history].reverse().map((a,i) => {
                  const pct = a.score?.percentage ?? 0;
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}>
                      <span style={{fontSize:"9px",opacity:0.7}}>{pct}%</span>
                      <div style={{width:"100%",borderRadius:"3px 3px 0 0",background:pct>=55?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.3)",height:`${Math.max(6,pct*0.32)}px`}}/>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Paper list */}
      {papers.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 0",color:"#ccc"}}>
          <div style={{fontSize:"40px",marginBottom:"12px"}}>📭</div>
          <p style={{fontWeight:"600",color:"#aaa"}}>No papers available yet</p>
        </div>
      ) : papers.map(paper => {
        const isOpen = !!expanded[paper.id];
        const attemptedParts = Array.from({length:PARTS},(_,i)=>i+1)
          .filter(n => attempts[`${paper.id}_part${n}`] !== undefined).length;

        return (
          <div key={paper.id} style={{marginBottom:"14px"}}>

            {/* Paper header */}
            <div
              onClick={() => toggleExpand(paper.id)}
              style={{
                background:"white",
                borderRadius: isOpen ? "16px 16px 0 0" : "16px",
                border:"1.5px solid #eef2ee",
                borderBottom: isOpen ? "1.5px solid #f0f5f0" : "1.5px solid #eef2ee",
                padding:"18px 22px",
                cursor:"pointer",
                display:"flex",
                alignItems:"center",
                gap:"14px",
                transition:"border-color 0.2s",
              }}
              onMouseEnter={e => { if(!isOpen) e.currentTarget.style.borderColor="#1D9E75"; }}
              onMouseLeave={e => { if(!isOpen) e.currentTarget.style.borderColor="#eef2ee"; }}
            >
              {/* Icon */}
              <div style={{width:"46px",height:"46px",borderRadius:"12px",flexShrink:0,background:paper.paperType==="PAPER_1"?"#E6F1FB":"#E1F5EE",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:"13px",fontWeight:"800",color:paper.paperType==="PAPER_1"?"#0C447C":"#085041"}}>
                  P{paper.paperType==="PAPER_1"?"1":"2"}
                </span>
              </div>

              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"3px"}}>
                  <span style={{fontWeight:"700",fontSize:"15px",color:"#111"}}>{paper.subject}</span>
                  <span style={{fontSize:"11px",color:"#ccc"}}>·</span>
                  <span style={{fontSize:"12px",color:"#bbb"}}>{paper.year}</span>
                </div>
                <div style={{fontSize:"12px",color:"#aaa"}}>
                  {paper.totalQuestions} questions total · {PARTS} parts · {Q_PER_PART} random questions each · {PART_MINUTES} min
                </div>
              </div>

              {/* Right side */}
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                {/* Part dots */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"5px"}}>
                  <div style={{fontSize:"12px",fontWeight:"700",color:attemptedParts===PARTS?"#1D9E75":"#bbb"}}>
                    {attemptedParts}/{PARTS} done
                  </div>
                  <div style={{display:"flex",gap:"4px"}}>
                    {Array.from({length:PARTS},(_,i) => {
                      const s = attempts[`${paper.id}_part${i+1}`];
                      return (
                        <div key={i} style={{width:"8px",height:"8px",borderRadius:"50%",background: s!==undefined ? (s>=55?"#1D9E75":"#E24B4A") : "#e0e0e0"}}/>
                      );
                    })}
                  </div>
                </div>
                {/* Chevron */}
                <div style={{color:"#ccc",fontSize:"20px",lineHeight:1,transition:"transform 0.25s",transform:isOpen?"rotate(180deg)":"rotate(0deg)"}}>⌄</div>
              </div>
            </div>

            {/* 4 Part cards */}
            {isOpen && (
              <div style={{background:"#f8fbf8",border:"1.5px solid #eef2ee",borderTop:"none",borderRadius:"0 0 16px 16px",padding:"16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                {Array.from({length:PARTS},(_,i) => {
                  const partNum  = i + 1;
                  const key      = `${paper.id}_part${partNum}`;
                  const bestPart = attempts[key];
                  const done     = bestPart !== undefined;
                  const passed   = bestPart >= 55;

                  return (
                    <div key={partNum} style={{
                      background:"white",
                      borderRadius:"13px",
                      border: done ? `2px solid ${passed?"#9FE1CB":"#F7C1C1"}` : "1.5px solid #eef2ee",
                      padding:"16px 18px",
                      position:"relative",
                      overflow:"hidden",
                    }}>
                      {/* Ribbon */}
                      {done && (
                        <div style={{position:"absolute",top:0,right:0,background:passed?"#1D9E75":"#E24B4A",color:"white",fontSize:"9px",fontWeight:"800",padding:"3px 10px",borderRadius:"0 11px 0 8px",letterSpacing:"0.05em"}}>
                          {passed?"PASSED":"FAILED"}
                        </div>
                      )}

                      {/* Part header */}
                      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
                        <div style={{width:"38px",height:"38px",borderRadius:"50%",background:done?(passed?"#E1F5EE":"#FCEBEB"):"#f0f4f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <span style={{fontSize:"15px",fontWeight:"800",color:done?(passed?"#085041":"#A32D2D"):"#ccc"}}>{partNum}</span>
                        </div>
                        <div>
                          <div style={{fontWeight:"700",fontSize:"14px",color:"#111"}}>Part {partNum}</div>
                          <div style={{fontSize:"11px",color:"#aaa"}}>{Q_PER_PART} random questions · {PART_MINUTES} min</div>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div style={{height:"4px",borderRadius:"999px",background:"#f0f0f0",marginBottom:"13px",overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:"999px",background:passed?"#1D9E75":"#E24B4A",width:done?`${bestPart}%`:"0%",transition:"width 0.6s ease"}}/>
                      </div>

                      {/* Bottom row */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:"12px",fontWeight:"600",color:!done?"#ccc":passed?"#1D9E75":"#E24B4A"}}>
                          {done ? `Best: ${bestPart}%` : "Not attempted"}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/quiz/${paper.id}/part/${partNum}`); }}
                          style={{padding:"7px 16px",borderRadius:"9px",border:"none",cursor:"pointer",background:done?"#f0f4f0":"#1D9E75",color:done?"#555":"white",fontSize:"12px",fontWeight:"700",transition:"opacity 0.15s"}}
                          onMouseEnter={e => e.currentTarget.style.opacity="0.8"}
                          onMouseLeave={e => e.currentTarget.style.opacity="1"}
                        >
                          {done ? "Retry →" : "Start →"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Recent history */}
      {history.length > 0 && (
        <div style={{marginTop:"24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
            <span style={{fontSize:"11px",fontWeight:"700",color:"#bbb",letterSpacing:"0.08em",textTransform:"uppercase"}}>Recent attempts</span>
            <div style={{flex:1,height:"1px",background:"#eef2ee"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {history.map(a => {
              const pct    = a.score?.percentage ?? 0;
              const passed = pct >= 55;
              const label  = a.partNumber
                ? `${a.paperTitle ?? "Paper"} — Part ${a.partNumber}`
                : (a.paperTitle ?? "Mock test");
              return (
                <div key={a.id}
                  onClick={() => navigate(`/results/${a.id}`)}
                  style={{background:"white",border:"1.5px solid #eef2ee",borderRadius:"12px",padding:"13px 18px",display:"flex",alignItems:"center",gap:"14px",cursor:"pointer",transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#1D9E75";e.currentTarget.style.transform="translateX(3px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#eef2ee";e.currentTarget.style.transform="translateX(0)";}}
                >
                  <div style={{width:"44px",height:"44px",borderRadius:"50%",background:passed?"#E1F5EE":"#FCEBEB",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontWeight:"800",fontSize:"13px",color:passed?"#085041":"#A32D2D"}}>{pct}%</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"600",fontSize:"13px",color:"#111"}}>{label}</div>
                    <div style={{fontSize:"11px",color:"#bbb",marginTop:"2px"}}>
                      {a.score?.correct??0} correct · {a.score?.incorrect??0} wrong · {fmtDate(a.submittedAt)}
                    </div>
                  </div>
                  <span style={{fontSize:"11px",fontWeight:"700",padding:"3px 10px",borderRadius:"999px",background:passed?"#E1F5EE":"#FCEBEB",color:passed?"#085041":"#A32D2D"}}>
                    {passed?"Passed":"Failed"}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}