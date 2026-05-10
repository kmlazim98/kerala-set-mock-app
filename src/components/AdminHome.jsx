import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { validatePaperJSON, uploadPaperToFirestore } from "../lib/uploadPaper";
import {
  collection, getDocs, doc,
  updateDoc, deleteDoc, query,
  where, orderBy
} from "firebase/firestore";
import { db } from "../firebase";

export default function AdminHome() {
  const { user }   = useAuth();
  const [tab, setTab] = useState("students");

  // Students state
  const [students,   setStudents]   = useState([]);
  const [attempts,   setAttempts]   = useState({});  // uid → array of attempts
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedStudent, setExpandedStudent] = useState(null);

  // Upload state
  const [dragging,   setDragging]   = useState(false);
  const [parsed,     setParsed]     = useState(null);
  const [errors,     setErrors]     = useState([]);
  const [uploading,  setUploading]  = useState(false);

  // Papers state
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    if (tab === "students") loadStudents();
    if (tab === "papers")   loadPapers();
  }, [tab]);

  async function loadStudents() {
    setLoadingStudents(true);
    const snap = await getDocs(collection(db, "users"));
    const all  = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role !== "admin")
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    setStudents(all);

    // Load attempt counts per student
    const attSnap = await getDocs(
      query(collection(db, "attemptedQuizzes"), where("status", "==", "SUBMITTED"))
    );
    const map = {};
    attSnap.docs.forEach(d => {
      const data = d.data();
      const uid  = data.userId;
      if (!map[uid]) map[uid] = [];
      map[uid].push({ id: d.id, ...data });
    });
    setAttempts(map);
    setLoadingStudents(false);
  }

  async function loadPapers() {
    const snap = await getDocs(collection(db, "papers"));
    setPapers(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.year - a.year));
  }

  async function updateStudentStatus(uid, status) {
    await updateDoc(doc(db, "users", uid), { status });
    setStudents(s => s.map(st => st.id === uid ? { ...st, status } : st));
  }

  async function deleteStudent(uid) {
    if (!window.confirm("Delete this student account? Their attempt history will remain.")) return;
    await deleteDoc(doc(db, "users", uid));
    setStudents(s => s.filter(st => st.id !== uid));
  }

  async function togglePaper(paper) {
    await updateDoc(doc(db, "papers", paper.id), { isActive: !paper.isActive });
    setPapers(p => p.map(pp => pp.id === paper.id ? { ...pp, isActive: !pp.isActive } : pp));
  }

  async function deletePaper(paper) {
    if (!window.confirm(`Delete "${paper.title}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "papers", paper.id));
    setPapers(p => p.filter(pp => pp.id !== paper.id));
  }

  function handleFile(file) {
    if (!file?.name.endsWith(".json")) { alert("Please upload a .json file"); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        const errs = validatePaperJSON(data);
        setErrors(errs);
        setParsed(errs.length === 0 ? data : null);
      } catch { setErrors(["Invalid JSON — could not parse file"]); setParsed(null); }
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!parsed) return;
    setUploading(true);
    try {
      await uploadPaperToFirestore(parsed, user.uid);
      alert(`✅ "${parsed.meta.title}" uploaded!`);
      setParsed(null); setErrors([]);
      setTab("papers"); loadPapers();
    } catch (err) { alert("Upload failed: " + err.message); }
    setUploading(false);
  }

  const fmtDate = ts => ts?.seconds
    ? new Date(ts.seconds * 1000).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })
    : "—";

  const filteredStudents = students.filter(s => {
    const matchSearch = !searchQuery ||
      s.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount  = students.filter(s => s.status === "pending").length;
  const activeCount   = students.filter(s => s.status === "active").length;
  const suspendedCount= students.filter(s => s.status === "suspended").length;

  const statusColor = {
    pending:   { bg:"#FAEEDA", color:"#633806", label:"Pending" },
    active:    { bg:"#E1F5EE", color:"#085041", label:"Active"  },
    suspended: { bg:"#FCEBEB", color:"#A32D2D", label:"Suspended" },
  };

  const tabs = [
    { key:"students", label:"Students",     badge: pendingCount > 0 ? pendingCount : null },
    { key:"upload",   label:"Upload paper", badge: null },
    { key:"papers",   label:"Papers",       badge: null },
  ];

  return (
    <div style={{ fontFamily:"system-ui,-apple-system,sans-serif" }}>

      {/* Tabs */}
      <div style={{ display:"flex", gap:"0", borderBottom:"1.5px solid #eef2ee", marginBottom:"24px" }}>
        {tabs.map(({ key, label, badge }) => (
          <button key={key} onClick={() => setTab(key)} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"10px 20px", border:"none", background:"transparent", cursor:"pointer", fontSize:"13px", fontWeight: tab===key ? "700" : "400", color: tab===key ? "#1D9E75" : "#999", borderBottom: tab===key ? "2.5px solid #1D9E75" : "2.5px solid transparent", marginBottom:"-1.5px" }}>
            {label}
            {badge && (
              <span style={{ background:"#E24B4A", color:"white", fontSize:"10px", fontWeight:"800", padding:"1px 6px", borderRadius:"999px" }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Students tab ── */}
      {tab === "students" && (
        <div>
          {/* Stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px", marginBottom:"20px" }}>
            {[
              { label:"Total students", value: students.length,   color:"#111",    bg:"#f8f8f8" },
              { label:"Active",         value: activeCount,        color:"#085041", bg:"#E1F5EE" },
              { label:"Pending",        value: pendingCount,       color:"#633806", bg:"#FAEEDA" },
              { label:"Suspended",      value: suspendedCount,     color:"#A32D2D", bg:"#FCEBEB" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ background:bg, borderRadius:"12px", padding:"14px 16px" }}>
                <div style={{ fontSize:"24px", fontWeight:"800", color, lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:"12px", color, opacity:0.75, marginTop:"4px" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display:"flex", gap:"10px", marginBottom:"16px" }}>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex:1, padding:"10px 14px", borderRadius:"10px", border:"1.5px solid #e8eee8", fontSize:"13px", outline:"none" }}
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding:"10px 14px", borderRadius:"10px", border:"1.5px solid #e8eee8", fontSize:"13px", background:"white", cursor:"pointer" }}
            >
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Student list */}
          {loadingStudents ? (
            <div style={{ textAlign:"center", padding:"40px", color:"#aaa" }}>Loading students...</div>
          ) : filteredStudents.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px", color:"#ccc" }}>
              <div style={{ fontSize:"36px", marginBottom:"10px" }}>👤</div>
              <p>No students found</p>
            </div>
          ) : filteredStudents.map(student => {
            const studentAttempts = attempts[student.id] ?? [];
            const scores = studentAttempts.map(a => a.score?.percentage ?? 0);
            const bestScore = scores.length ? Math.max(...scores) : null;
            const avgScore  = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
            const isExpanded = expandedStudent === student.id;
            const sc = statusColor[student.status] ?? statusColor.pending;

            return (
              <div key={student.id} style={{ background:"white", border:"1.5px solid #eef2ee", borderRadius:"14px", marginBottom:"10px", overflow:"hidden" }}>

                {/* Student row */}
                <div style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 18px" }}>

                  {/* Avatar */}
                  <div style={{ width:"42px", height:"42px", borderRadius:"50%", background: sc.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", fontWeight:"800", color: sc.color, flexShrink:0 }}>
                    {student.displayName?.[0]?.toUpperCase() ?? "?"}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"2px" }}>
                      <span style={{ fontWeight:"700", fontSize:"14px", color:"#111" }}>{student.displayName ?? "Unknown"}</span>
                      <span style={{ fontSize:"10px", fontWeight:"700", padding:"2px 8px", borderRadius:"999px", background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </div>
                    <div style={{ fontSize:"12px", color:"#aaa" }}>
                      {student.email} · Joined {fmtDate(student.createdAt)}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display:"flex", gap:"16px", marginRight:"8px" }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:"16px", fontWeight:"800", color:"#111" }}>{studentAttempts.length}</div>
                      <div style={{ fontSize:"10px", color:"#aaa" }}>attempts</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:"16px", fontWeight:"800", color: bestScore!=null?(bestScore>=55?"#1D9E75":"#E24B4A"):"#ccc" }}>
                        {bestScore != null ? `${bestScore}%` : "—"}
                      </div>
                      <div style={{ fontSize:"10px", color:"#aaa" }}>best</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:"16px", fontWeight:"800", color:"#888" }}>
                        {avgScore != null ? `${avgScore}%` : "—"}
                      </div>
                      <div style={{ fontSize:"10px", color:"#aaa" }}>avg</div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display:"flex", gap:"6px", flexShrink:0 }}>
                    {student.status === "pending" && (
                      <button
                        onClick={() => updateStudentStatus(student.id, "active")}
                        style={{ padding:"7px 14px", borderRadius:"8px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontSize:"12px", fontWeight:"700" }}
                      >
                        ✓ Approve
                      </button>
                    )}
                    {student.status === "active" && (
                      <button
                        onClick={() => updateStudentStatus(student.id, "suspended")}
                        style={{ padding:"7px 14px", borderRadius:"8px", border:"1.5px solid #FAC775", background:"#FAEEDA", color:"#633806", cursor:"pointer", fontSize:"12px", fontWeight:"600" }}
                      >
                        Suspend
                      </button>
                    )}
                    {student.status === "suspended" && (
                      <button
                        onClick={() => updateStudentStatus(student.id, "active")}
                        style={{ padding:"7px 14px", borderRadius:"8px", border:"1.5px solid #9FE1CB", background:"#E1F5EE", color:"#085041", cursor:"pointer", fontSize:"12px", fontWeight:"600" }}
                      >
                        Reactivate
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                      style={{ padding:"7px 12px", borderRadius:"8px", border:"1.5px solid #eef2ee", background:"white", cursor:"pointer", fontSize:"12px", color:"#888" }}
                    >
                      {isExpanded ? "▲ Hide" : "▼ History"}
                    </button>
                    <button
                      onClick={() => deleteStudent(student.id)}
                      style={{ padding:"7px 10px", borderRadius:"8px", border:"1.5px solid #F7C1C1", background:"#FCEBEB", color:"#A32D2D", cursor:"pointer", fontSize:"12px" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Expanded attempt history */}
                {isExpanded && (
                  <div style={{ borderTop:"1px solid #f0f0f0", padding:"14px 18px", background:"#fafcfa" }}>
                    <p style={{ fontSize:"11px", fontWeight:"700", color:"#aaa", letterSpacing:"0.06em", textTransform:"uppercase", margin:"0 0 10px" }}>
                      Attempt history ({studentAttempts.length})
                    </p>
                    {studentAttempts.length === 0 ? (
                      <p style={{ fontSize:"13px", color:"#ccc", textAlign:"center", padding:"16px 0" }}>No attempts yet</p>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                        {studentAttempts.slice(0, 8).map(a => {
                          const pct    = a.score?.percentage ?? 0;
                          const passed = pct >= 55;
                          return (
                            <div key={a.id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 12px", background:"white", borderRadius:"10px", border:"1px solid #eef2ee" }}>
                              <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:passed?"#E1F5EE":"#FCEBEB", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                <span style={{ fontSize:"11px", fontWeight:"800", color:passed?"#085041":"#A32D2D" }}>{pct}%</span>
                              </div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:"12px", fontWeight:"600", color:"#333" }}>
                                  {a.paperTitle ?? "Mock test"}
                                  {a.partNumber && <span style={{ marginLeft:"6px", fontSize:"10px", background:"#E1F5EE", color:"#085041", padding:"1px 6px", borderRadius:"999px" }}>Part {a.partNumber}</span>}
                                </div>
                                <div style={{ fontSize:"11px", color:"#bbb", marginTop:"1px" }}>
                                  {a.score?.correct ?? 0}✓ · {a.score?.incorrect ?? 0}✗ · {a.score?.skipped ?? 0} skipped · {fmtDate(a.submittedAt)}
                                </div>
                              </div>
                              <span style={{ fontSize:"10px", fontWeight:"700", padding:"2px 8px", borderRadius:"999px", background:passed?"#E1F5EE":"#FCEBEB", color:passed?"#085041":"#A32D2D" }}>
                                {passed ? "Passed" : "Failed"}
                              </span>
                            </div>
                          );
                        })}
                        {studentAttempts.length > 8 && (
                          <p style={{ fontSize:"12px", color:"#bbb", textAlign:"center", margin:"4px 0 0" }}>
                            +{studentAttempts.length - 8} more attempts
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Upload tab ── */}
      {tab === "upload" && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById("json-file-input").click()}
            style={{ border:`2px dashed ${dragging?"#1D9E75":"#ddd"}`, background:dragging?"#E1F5EE":"#fafafa", borderRadius:"14px", padding:"36px", textAlign:"center", cursor:"pointer", marginBottom:"16px", transition:"all 0.2s" }}
          >
            <div style={{ fontSize:"32px", marginBottom:"10px" }}>📂</div>
            <div style={{ fontWeight:"700", fontSize:"15px", marginBottom:"4px", color:"#333" }}>
              {parsed ? parsed.meta.title : "Drop JSON file here or click to browse"}
            </div>
            <div style={{ fontSize:"12px", color:"#aaa" }}>One file per paper · must follow the Kerala SET JSON schema</div>
            <input id="json-file-input" type="file" accept=".json" style={{ display:"none" }} onChange={e => handleFile(e.target.files[0])} />
          </div>

          {errors.length > 0 && (
            <div style={{ background:"#FCEBEB", border:"1px solid #F09595", borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
              <div style={{ fontWeight:"700", color:"#A32D2D", marginBottom:"8px" }}>{errors.length} error{errors.length > 1 ? "s" : ""} — fix the JSON and re-upload</div>
              {errors.map((e, i) => <div key={i} style={{ fontSize:"13px", color:"#791F1F" }}>• {e}</div>)}
            </div>
          )}

          {parsed && (
            <div style={{ border:"1.5px solid #eef2ee", borderRadius:"14px", padding:"20px", marginBottom:"16px" }}>
              <div style={{ fontWeight:"700", fontSize:"14px", marginBottom:"14px" }}>Preview — {parsed.questions.length} questions</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"8px", marginBottom:"16px" }}>
                {[["Paper", parsed.meta.paperType.replace("PAPER_","Paper ")], ["Subject", parsed.meta.subject], ["Year", parsed.meta.year], ["Questions", parsed.questions.length]].map(([label, val]) => (
                  <div key={label} style={{ background:"#f8f8f8", borderRadius:"10px", padding:"10px 12px" }}>
                    <div style={{ fontSize:"11px", color:"#aaa", marginBottom:"2px" }}>{label}</div>
                    <div style={{ fontWeight:"700", fontSize:"14px" }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:"10px" }}>
                <button onClick={handleUpload} disabled={uploading} style={{ padding:"11px 22px", borderRadius:"10px", border:"none", background:uploading?"#ccc":"#1D9E75", color:"white", cursor:uploading?"not-allowed":"pointer", fontWeight:"700", fontSize:"14px" }}>
                  {uploading ? "Uploading..." : `Upload ${parsed.questions.length} questions`}
                </button>
                <button onClick={() => { setParsed(null); setErrors([]); }} style={{ padding:"11px 18px", borderRadius:"10px", border:"1.5px solid #eee", background:"white", cursor:"pointer", fontSize:"14px", color:"#666" }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Schema reference */}
          <div style={{ background:"#1a1a2e", borderRadius:"12px", padding:"18px", fontFamily:"monospace", fontSize:"12px", color:"#a8d8a8", lineHeight:"1.8" }}>
            <div style={{ color:"#888", fontFamily:"sans-serif", fontSize:"11px", marginBottom:"10px", fontWeight:"600" }}>Expected JSON format</div>
            {`{\n  "meta": {\n    "title": "Kerala SET 2023 — Paper 2 English",\n    "year": 2023,\n    "paperType": "PAPER_2",\n    "subject": "English Literature",\n    "durationMinutes": 120\n  },\n  "questions": [\n    {\n      "number": 1,\n      "text": "Question text here",\n      "options": { "A":"...", "B":"...", "C":"...", "D":"..." },\n      "correctAnswer": "A"\n    }\n  ]\n}`}
          </div>
        </div>
      )}

      {/* ── Papers tab ── */}
      {tab === "papers" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
            <span style={{ fontWeight:"700", fontSize:"14px" }}>{papers.length} paper{papers.length !== 1 ? "s" : ""} uploaded</span>
            <button onClick={() => setTab("upload")} style={{ padding:"9px 18px", borderRadius:"9px", border:"none", background:"#1D9E75", color:"white", cursor:"pointer", fontSize:"13px", fontWeight:"700" }}>
              + Upload paper
            </button>
          </div>
          {papers.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px", color:"#ccc" }}>
              <div style={{ fontSize:"36px", marginBottom:"10px" }}>📄</div>
              <p>No papers yet. Upload one!</p>
            </div>
          ) : papers.map(p => (
            <div key={p.id} style={{ background:"white", border:"1.5px solid #eef2ee", borderRadius:"12px", padding:"16px 20px", marginBottom:"10px", display:"flex", alignItems:"center", gap:"14px", opacity:p.isActive?1:0.55 }}>
              <div style={{ width:"42px", height:"42px", borderRadius:"10px", background:p.paperType==="PAPER_1"?"#E6F1FB":"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:"12px", fontWeight:"800", color:p.paperType==="PAPER_1"?"#0C447C":"#085041" }}>P{p.paperType==="PAPER_1"?"1":"2"}</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"3px" }}>
                  <span style={{ fontWeight:"700", fontSize:"14px", color:"#111" }}>{p.subject}</span>
                  <span style={{ fontSize:"11px", color:"#bbb" }}>· {p.year}</span>
                  {!p.isActive && <span style={{ fontSize:"10px", background:"#FAEEDA", color:"#633806", padding:"1px 8px", borderRadius:"999px", fontWeight:"600" }}>Hidden</span>}
                </div>
                <div style={{ fontSize:"12px", color:"#aaa" }}>{p.totalQuestions} questions · {p.durationMinutes} min</div>
              </div>
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={() => togglePaper(p)} style={{ padding:"7px 14px", borderRadius:"8px", border:"1.5px solid #eee", background:"white", cursor:"pointer", fontSize:"12px", fontWeight:"600", color:"#555" }}>
                  {p.isActive ? "Hide" : "Show"}
                </button>
                <button onClick={() => deletePaper(p)} style={{ padding:"7px 12px", borderRadius:"8px", border:"1.5px solid #F7C1C1", background:"#FCEBEB", color:"#A32D2D", cursor:"pointer", fontSize:"12px" }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}