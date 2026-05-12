import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validatePaperJSON, uploadPaperToFirestore } from "../lib/uploadPaper";
import {
  collection, getDocs, doc,
  updateDoc, deleteDoc, query,
  where
} from "firebase/firestore";
import { db } from "../firebase";

const TEAL   = { bg: "#E1F5EE", border: "#9FE1CB", text: "#085041", mid: "#1D9E75" };
const AMBER  = { bg: "#FAEEDA", border: "#FAC775", text: "#633806", mid: "#EF9F27" };
const RED    = { bg: "#FCEBEB", border: "#F7C1C1", text: "#A32D2D", mid: "#E24B4A" };
const BLUE   = { bg: "#E6F1FB", border: "#B5D4F4", text: "#0C447C", mid: "#378ADD" };

const STATUS = {
  pending:   { ...AMBER, label: "Pending"   },
  active:    { ...TEAL,  label: "Active"    },
  suspended: { ...RED,   label: "Suspended" },
};

const fmtDate = ts =>
  ts?.seconds
    ? new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "—";

/* ─── tiny shared atoms ─────────────────────────────────────────────────── */

function Badge({ scheme, children }) {
  return (
    <span style={{
      fontSize: "10px", fontWeight: "700", padding: "2px 8px",
      borderRadius: "999px", background: scheme.bg, color: scheme.text,
      border: `1px solid ${scheme.border}`, letterSpacing: "0.03em",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function Btn({ variant = "ghost", color, onClick, disabled, children, style = {} }) {
  const variants = {
    primary: { background: TEAL.mid,  color: "#fff",        border: "none" },
    danger:  { background: RED.bg,    color: RED.text,      border: `1px solid ${RED.border}` },
    warn:    { background: AMBER.bg,  color: AMBER.text,    border: `1px solid ${AMBER.border}` },
    success: { background: TEAL.bg,   color: TEAL.text,     border: `1px solid ${TEAL.border}` },
    ghost:   { background: "#f5f5f5", color: "#555",        border: "1px solid #e8e8e8" },
  };
  const v = color ? variants[color] : variants[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...v,
        padding: "7px 14px", borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "12px", fontWeight: "600", opacity: disabled ? 0.5 : 1,
        lineHeight: "1.4", whiteSpace: "nowrap", transition: "opacity .15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, scheme }) {
  return (
    <div style={{
      background: scheme?.bg ?? "#f8f8f8",
      border: `1px solid ${scheme?.border ?? "#e8e8e8"}`,
      borderRadius: "12px", padding: "16px 18px",
    }}>
      <div style={{ fontSize: "26px", fontWeight: "800", color: scheme?.text ?? "#111", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: "11px", fontWeight: "600", color: scheme?.text ?? "#666", opacity: 0.7, marginTop: "5px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
    </div>
  );
}

/* ─── Students Tab ──────────────────────────────────────────────────────── */

function AttemptRow({ attempt }) {
  const pct    = attempt.score?.percentage ?? 0;
  const passed = pct >= 55;
  const sc     = passed ? TEAL : RED;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "10px 14px", background: "#fff",
      borderRadius: "10px", border: "1px solid #eef2ee",
    }}>
      <div style={{
        width: "40px", height: "40px", borderRadius: "50%",
        background: sc.bg, border: `1.5px solid ${sc.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <span style={{ fontSize: "11px", fontWeight: "800", color: sc.text }}>{pct}%</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12px", fontWeight: "600", color: "#333", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {attempt.paperTitle ?? "Mock test"}
          {attempt.partNumber && (
            <Badge scheme={TEAL}>Part {attempt.partNumber}</Badge>
          )}
        </div>
        <div style={{ fontSize: "11px", color: "#bbb", marginTop: "2px" }}>
          {attempt.score?.correct ?? 0} correct · {attempt.score?.incorrect ?? 0} wrong · {attempt.score?.skipped ?? 0} skipped · {fmtDate(attempt.submittedAt)}
        </div>
      </div>
      <Badge scheme={sc}>{passed ? "Passed" : "Failed"}</Badge>
    </div>
  );
}

function StudentRow({ student, studentAttempts, onStatusChange, onDelete, onProfile }) {
  const scores    = studentAttempts.map(a => a.score?.percentage ?? 0);
  const bestScore = scores.length ? Math.max(...scores) : null;
  const avgScore  = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const sc        = STATUS[student.status] ?? STATUS.pending;
  const initials  = student.displayName?.[0]?.toUpperCase() ?? "?";

  return (
    <div style={{
      background: "#fff", border: "1px solid #eef2ee",
      borderRadius: "14px", marginBottom: "8px",
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", padding: "16px 18px", flexWrap: "wrap" }}>

        {/* avatar — click to open profile */}
        <div
          title="View profile"
          onClick={() => onProfile(student.id)}
          style={{
            width: "44px", height: "44px", borderRadius: "50%",
            background: sc.bg, border: `1.5px solid ${sc.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: "800", color: sc.text, flexShrink: 0,
            cursor: "pointer", transition: "transform .15s, box-shadow .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)";    e.currentTarget.style.boxShadow = "none"; }}
        >
          {initials}
        </div>

        {/* info */}
        <div style={{ flex: 1, minWidth: "180px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
            <span
              onClick={() => onProfile(student.id)}
              style={{ fontWeight: "700", fontSize: "14px", color: "#111", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#ddd" }}
            >
              {student.displayName ?? "Unknown"}
            </span>
            <Badge scheme={sc}>{sc.label}</Badge>
          </div>
          <div style={{ fontSize: "12px", color: "#aaa", marginBottom: "10px" }}>
            {student.email} · Joined {fmtDate(student.createdAt)}
          </div>
          <div style={{ display: "flex", gap: "20px" }}>
            {[
              { val: studentAttempts.length, label: "attempts", scheme: null },
              { val: bestScore != null ? `${bestScore}%` : "—", label: "best", scheme: bestScore != null ? (bestScore >= 55 ? TEAL : RED) : null },
              { val: avgScore  != null ? `${avgScore}%`  : "—", label: "avg",  scheme: null },
            ].map(({ val, label, scheme }) => (
              <div key={label}>
                <span style={{ fontSize: "15px", fontWeight: "800", color: scheme ? scheme.text : "#999" }}>{val}</span>
                <span style={{ fontSize: "11px", color: "#bbb", marginLeft: "4px" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center", paddingTop: "2px" }}>
          {student.status === "pending"   && <Btn color="primary" onClick={() => onStatusChange(student.id, "active")}>✓ Approve</Btn>}
          {student.status === "active"    && <Btn color="warn"    onClick={() => onStatusChange(student.id, "suspended")}>Suspend</Btn>}
          {student.status === "suspended" && <Btn color="success" onClick={() => onStatusChange(student.id, "active")}>Reactivate</Btn>}
          <Btn onClick={() => onProfile(student.id)}>View profile</Btn>
          <Btn color="danger" onClick={() => onDelete(student.id)}>✕</Btn>
        </div>
      </div>
    </div>
  );
}

function StudentsTab({ students, attempts, loading, onStatusChange, onDelete, onProfile }) {
  const [searchQuery,  setSearchQuery]  = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = students.filter(s => {
    const matchSearch =
      !searchQuery ||
      s.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    total:     students.length,
    active:    students.filter(s => s.status === "active").length,
    pending:   students.filter(s => s.status === "pending").length,
    suspended: students.filter(s => s.status === "suspended").length,
  };

  return (
    <div>
      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "20px" }}>
        <StatCard label="Total students" value={counts.total}     />
        <StatCard label="Active"         value={counts.active}    scheme={TEAL}  />
        <StatCard label="Pending"        value={counts.pending}   scheme={AMBER} />
        <StatCard label="Suspended"      value={counts.suspended} scheme={RED}   />
      </div>

      {/* filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Search by name or email…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, padding: "9px 14px", borderRadius: "10px",
            border: "1.5px solid #e8eee8", fontSize: "13px", outline: "none",
            fontFamily: "inherit",
          }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: "9px 14px", borderRadius: "10px",
            border: "1.5px solid #e8eee8", fontSize: "13px",
            background: "#fff", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px", color: "#ccc", fontSize: "13px" }}>
          Loading students…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "#ccc" }}>
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>👤</div>
          <p style={{ fontSize: "13px" }}>No students found</p>
        </div>
      ) : filtered.map(student => (
        <StudentRow
          key={student.id}
          student={student}
          studentAttempts={attempts[student.id] ?? []}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          onProfile={onProfile}
        />
      ))}
    </div>
  );
}

/* ─── Upload Tab ────────────────────────────────────────────────────────── */

const SCHEMA_HINT = `{
  "meta": {
    "title": "Kerala SET 2023 — Paper 2 English",
    "year": 2023,
    "paperType": "PAPER_2",
    "subject": "English Literature",
    "durationMinutes": 120
  },
  "questions": [
    {
      "number": 1,
      "text": "Question text here",
      "options": { "A":"...", "B":"...", "C":"...", "D":"..." },
      "correctAnswer": "A"
    }
  ]
}`;

function UploadTab({ user, onUploaded }) {
  const [dragging,  setDragging]  = useState(false);
  const [parsed,    setParsed]    = useState(null);
  const [errors,    setErrors]    = useState([]);
  const [uploading, setUploading] = useState(false);

  function handleFile(file) {
    if (!file?.name.endsWith(".json")) { alert("Please upload a .json file"); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        const errs = validatePaperJSON(data);
        setErrors(errs);
        setParsed(errs.length === 0 ? data : null);
      } catch {
        setErrors(["Invalid JSON — could not parse file"]);
        setParsed(null);
      }
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!parsed) return;
    setUploading(true);
    try {
      await uploadPaperToFirestore(parsed, user.uid);
      alert(`✅ "${parsed.meta.title}" uploaded!`);
      setParsed(null);
      setErrors([]);
      onUploaded();
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    setUploading(false);
  }

  return (
    <div>
      {/* drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById("json-file-input").click()}
        style={{
          border: `2px dashed ${dragging ? TEAL.mid : "#ddd"}`,
          background: dragging ? TEAL.bg : "#fafafa",
          borderRadius: "14px", padding: "40px",
          textAlign: "center", cursor: "pointer",
          marginBottom: "16px", transition: "all .2s",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "10px" }}>📂</div>
        <div style={{ fontWeight: "700", fontSize: "15px", marginBottom: "5px", color: "#333" }}>
          {parsed ? parsed.meta.title : "Drop JSON file here or click to browse"}
        </div>
        <div style={{ fontSize: "12px", color: "#aaa" }}>
          One file per paper · must follow the Kerala SET JSON schema
        </div>
        <input
          id="json-file-input"
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {/* errors */}
      {errors.length > 0 && (
        <div style={{
          background: RED.bg, border: `1px solid ${RED.border}`,
          borderRadius: "12px", padding: "16px", marginBottom: "16px",
        }}>
          <div style={{ fontWeight: "700", color: RED.text, marginBottom: "8px", fontSize: "13px" }}>
            {errors.length} error{errors.length > 1 ? "s" : ""} — fix the JSON and re-upload
          </div>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#791F1F" }}>• {e}</div>
          ))}
        </div>
      )}

      {/* preview + upload */}
      {parsed && (
        <div style={{
          border: "1.5px solid #eef2ee", borderRadius: "14px",
          padding: "20px", marginBottom: "20px",
        }}>
          <div style={{ fontWeight: "700", fontSize: "13px", color: "#555", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Preview — {parsed.questions.length} questions
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: "18px" }}>
            {[
              ["Paper",     parsed.meta.paperType.replace("PAPER_", "Paper ")],
              ["Subject",   parsed.meta.subject],
              ["Year",      parsed.meta.year],
              ["Questions", parsed.questions.length],
            ].map(([label, val]) => (
              <div key={label} style={{ background: "#f8f8f8", borderRadius: "10px", padding: "10px 12px" }}>
                <div style={{ fontSize: "11px", color: "#aaa", marginBottom: "3px", fontWeight: "600" }}>{label}</div>
                <div style={{ fontWeight: "700", fontSize: "14px", color: "#222" }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Btn
              color="primary"
              disabled={uploading}
              onClick={handleUpload}
              style={{ padding: "10px 22px", fontSize: "13px" }}
            >
              {uploading ? "Uploading…" : `Upload ${parsed.questions.length} questions`}
            </Btn>
            <Btn onClick={() => { setParsed(null); setErrors([]); }}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* schema reference */}
      <div style={{ background: "#1a1a2e", borderRadius: "12px", padding: "20px" }}>
        <div style={{ fontFamily: "sans-serif", fontSize: "11px", fontWeight: "700", color: "#888", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px" }}>
          Expected JSON format
        </div>
        <pre style={{ fontFamily: "monospace", fontSize: "12px", color: "#a8d8a8", lineHeight: "1.8", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {SCHEMA_HINT}
        </pre>
      </div>
    </div>
  );
}

/* ─── Papers Tab ────────────────────────────────────────────────────────── */

function PapersTab({ papers, onToggle, onDelete, onUploadClick }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <span style={{ fontWeight: "700", fontSize: "14px", color: "#333" }}>
          {papers.length} paper{papers.length !== 1 ? "s" : ""}
        </span>
        <Btn color="primary" onClick={onUploadClick} style={{ fontSize: "13px", padding: "9px 18px" }}>
          + Upload paper
        </Btn>
      </div>

      {papers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "52px", color: "#ccc" }}>
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>📄</div>
          <p style={{ fontSize: "13px" }}>No papers yet. Upload one!</p>
        </div>
      ) : papers.map(p => {
        const isP1  = p.paperType === "PAPER_1";
        const tint  = isP1 ? BLUE : TEAL;
        return (
          <div
            key={p.id}
            style={{
              background: "#fff", border: "1px solid #eef2ee",
              borderRadius: "12px", padding: "14px 18px",
              marginBottom: "8px", display: "flex",
              alignItems: "center", gap: "14px",
              opacity: p.isActive ? 1 : 0.55,
              transition: "opacity .2s",
            }}
          >
            {/* paper type chip */}
            <div style={{
              width: "44px", height: "44px", borderRadius: "10px",
              background: tint.bg, border: `1.5px solid ${tint.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: "13px", fontWeight: "800", color: tint.text }}>
                P{isP1 ? "1" : "2"}
              </span>
            </div>

            {/* info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
                <span style={{ fontWeight: "700", fontSize: "14px", color: "#111" }}>{p.subject}</span>
                <span style={{ fontSize: "12px", color: "#bbb" }}>· {p.year}</span>
                {!p.isActive && <Badge scheme={AMBER}>Hidden</Badge>}
              </div>
              <div style={{ fontSize: "12px", color: "#aaa" }}>
                {p.totalQuestions} questions · {p.durationMinutes} min
              </div>
            </div>

            {/* actions */}
            <div style={{ display: "flex", gap: "7px", flexShrink: 0 }}>
              <Btn onClick={() => onToggle(p)}>
                {p.isActive ? "Hide" : "Show"}
              </Btn>
              <Btn color="danger" onClick={() => onDelete(p)}>Delete</Btn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */

export default function AdminHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("students");

  const [students,        setStudents]        = useState([]);
  const [attempts,        setAttempts]        = useState({});
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [papers,          setPapers]          = useState([]);

  useEffect(() => {
    if (tab === "students") loadStudents();
    if (tab === "papers")   loadPapers();
  }, [tab]);

  async function loadStudents() {
    setLoadingStudents(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const all  = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role !== "admin")
        .map(u => ({ ...u, status: u.status ?? "pending" }))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setStudents(all);

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
    } catch (err) {
      console.error("Failed to load students:", err);
    }
    setLoadingStudents(false);
  }

  async function loadPapers() {
    const snap = await getDocs(collection(db, "papers"));
    setPapers(
      snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.year - a.year)
    );
  }

  async function updateStudentStatus(uid, status) {
    try {
      await updateDoc(doc(db, "users", uid), { status });
      setStudents(s => s.map(st => st.id === uid ? { ...st, status } : st));
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
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

  const pendingCount = students.filter(s => s.status === "pending").length;

  const TABS = [
    { key: "students", label: "Students",     badge: pendingCount > 0 ? pendingCount : null },
    { key: "upload",   label: "Upload paper", badge: null },
    { key: "papers",   label: "Papers",       badge: null },
  ];

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif", color: "#111" }}>

      {/* ── tab bar ── */}
      <div style={{
        display: "flex", borderBottom: "1.5px solid #eef2ee",
        marginBottom: "24px", gap: "2px",
      }}>
        {TABS.map(({ key, label, badge }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "10px 18px", border: "none", background: "transparent",
                cursor: "pointer", fontSize: "13px",
                fontWeight: active ? "700" : "400",
                color: active ? TEAL.mid : "#999",
                borderBottom: active ? `2.5px solid ${TEAL.mid}` : "2.5px solid transparent",
                marginBottom: "-1.5px", transition: "color .15s",
              }}
            >
              {label}
              {badge != null && (
                <span style={{
                  background: RED.mid, color: "#fff",
                  fontSize: "10px", fontWeight: "800",
                  padding: "1px 6px", borderRadius: "999px",
                }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── tab content ── */}
      {tab === "students" && (
        <StudentsTab
          students={students}
          attempts={attempts}
          loading={loadingStudents}
          onStatusChange={updateStudentStatus}
          onDelete={deleteStudent}
          onProfile={id => navigate(`/admin/student/${id}`)}
        />
      )}

      {tab === "upload" && (
        <UploadTab
          user={user}
          onUploaded={() => { setTab("papers"); loadPapers(); }}
        />
      )}

      {tab === "papers" && (
        <PapersTab
          papers={papers}
          onToggle={togglePaper}
          onDelete={deletePaper}
          onUploadClick={() => setTab("upload")}
        />
      )}
    </div>
  );
}