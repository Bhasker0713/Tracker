import { useState, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, Cell,
} from "recharts";

/* ─── Design tokens ─────────────────────────────────────────── */
const NAV    = "#0D1B2A";
const TEAL   = "#06D6A0";
const BG     = "#F0F4F8";
const WHITE  = "#FFFFFF";
const TEXT   = "#1C2B3A";
const MUTED  = "#64748B";
const BORDER = "#E2E8F0";

/* ─── Utilization colour scale ──────────────────────────────── */
function utilColor(pct) {
  if (pct === 0)    return { bg:"#F1F5F9", fg:"#94A3B8" };
  if (pct < 50)     return { bg:"#FEE2E2", fg:"#991B1B" };
  if (pct < 75)     return { bg:"#FEF3C7", fg:"#92400E" };
  if (pct <= 100)   return { bg:"#D1FAE5", fg:"#065F46" };
  return              { bg:"#EDE9FE", fg:"#4C1D95" };
}

/* ─── CSV parser ────────────────────────────────────────────── */
function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/);
  if (rows.length < 2) return [];
  const headers = rows[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g,"_"));
  return rows.slice(1).map((row, idx) => {
    const vals = row.split(",").map(v => v.trim().replace(/^"|"$/g,""));
    const obj  = { id: Date.now() + idx };
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
}

/* ─── Map CSV row to Employee shape ─────────────────────────── */
const DEPT_COLORS = {
  "Engineering": "#3B82F6","Design": "#8B5CF6","Product": "#F59E0B",
  "QA": "#10B981","HR": "#EC4899","Finance": "#F97316","Marketing": "#06D6A0",
};
function deptColor(dept) { return DEPT_COLORS[dept] || "#64748B"; }

function rowToEmployee(row, idx) {
  const name = row.name || row.full_name || row.employee_name || ("Employee "+(idx+1));
  const dept = row.department || row.dept || "General";
  return {
    id:       row.id || Date.now()+idx,
    name,
    email:    row.email || row.email_address || "",
    dept,
    role:     row.role || row.job_title || row.title || "Team Member",
    capacity: parseInt(row.weekly_capacity || row.capacity || row.hours || "40", 10) || 40,
    init:     name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase(),
    color:    deptColor(dept),
    active:   true,
  };
}

/* ─── Seed data ──────────────────────────────────────────────── */
const SEED_EMP = [
  { id:1, name:"Alex Chen",    email:"alex@corp.com",   dept:"Engineering", role:"Sr. Engineer",  capacity:40, init:"AC", color:"#3B82F6", active:true },
  { id:2, name:"Sarah Kim",    email:"sarah@corp.com",  dept:"Design",      role:"Lead Designer", capacity:40, init:"SK", color:"#8B5CF6", active:true },
  { id:3, name:"Marcus Wells", email:"marcus@corp.com", dept:"Engineering", role:"Engineer",      capacity:40, init:"MW", color:"#3B82F6", active:true },
  { id:4, name:"Priya Patel",  email:"priya@corp.com",  dept:"Product",     role:"Product Mgr",   capacity:32, init:"PP", color:"#F59E0B", active:true },
  { id:5, name:"Tom Reynolds", email:"tom@corp.com",    dept:"Engineering", role:"Engineer",      capacity:40, init:"TR", color:"#3B82F6", active:true },
  { id:6, name:"Zoe Martinez", email:"zoe@corp.com",    dept:"QA",          role:"QA Lead",       capacity:32, init:"ZM", color:"#10B981", active:true },
];

const SEED_PROJ = [
  { id:1, name:"Platform Redesign",   client:"Internal",    status:"active",   start:"2026-01-01", end:"2026-08-31" },
  { id:2, name:"Mobile App v2.0",     client:"RetailCo",    status:"active",   start:"2026-02-01", end:"2026-09-30" },
  { id:3, name:"Analytics Dashboard", client:"DataCorp",    status:"review",   start:"2026-01-15", end:"2026-06-30" },
  { id:4, name:"API Integration",     client:"FinTech Ltd", status:"planning", start:"2026-05-01", end:"2026-12-31" },
];

/* allocatedHours = hours per week on this project */
const SEED_ALLOC = [
  { id:1, empId:1, projId:2, hoursPerWeek:20 },
  { id:2, empId:1, projId:1, hoursPerWeek:16 },
  { id:3, empId:2, projId:1, hoursPerWeek:32 },
  { id:4, empId:3, projId:2, hoursPerWeek:30 },
  { id:5, empId:3, projId:4, hoursPerWeek:8  },
  { id:6, empId:4, projId:1, hoursPerWeek:16 },
  { id:7, empId:4, projId:3, hoursPerWeek:12 },
  { id:8, empId:5, projId:2, hoursPerWeek:36 },
  { id:9, empId:6, projId:3, hoursPerWeek:24 },
];

/* Weekly time entries  -  week = "YYYY-WNN" */
const WEEKS = ["2026-W18","2026-W19","2026-W20","2026-W21","2026-W22","2026-W23"];
const SEED_ENTRIES = [
  { id:1,  empId:1, projId:2, week:"2026-W21", hours:18, note:"Offline sync"       },
  { id:2,  empId:1, projId:1, week:"2026-W21", hours:16, note:"Component library"  },
  { id:3,  empId:2, projId:1, week:"2026-W21", hours:34, note:"Figma designs"      },
  { id:4,  empId:3, projId:2, week:"2026-W21", hours:28, note:"Push notifications" },
  { id:5,  empId:3, projId:4, week:"2026-W21", hours:6,  note:"API docs"           },
  { id:6,  empId:4, projId:1, week:"2026-W21", hours:14, note:"User research"      },
  { id:7,  empId:5, projId:2, week:"2026-W21", hours:40, note:"Auth module"        },
  { id:8,  empId:6, projId:3, week:"2026-W21", hours:22, note:"Test automation"    },
  { id:9,  empId:1, projId:2, week:"2026-W20", hours:20, note:""                   },
  { id:10, empId:2, projId:1, week:"2026-W20", hours:30, note:""                   },
  { id:11, empId:3, projId:2, week:"2026-W20", hours:32, note:""                   },
  { id:12, empId:5, projId:2, week:"2026-W20", hours:38, note:""                   },
  { id:13, empId:6, projId:3, week:"2026-W20", hours:28, note:""                   },
  { id:14, empId:1, projId:1, week:"2026-W19", hours:15, note:""                   },
  { id:15, empId:2, projId:1, week:"2026-W19", hours:36, note:""                   },
  { id:16, empId:3, projId:2, week:"2026-W19", hours:34, note:""                   },
  { id:17, empId:5, projId:2, week:"2026-W19", hours:40, note:""                   },
];

const SEED_LEAVES = [
  { id:1, empId:2, type:"Annual", from:"2026-06-05", to:"2026-06-09", days:5, status:"pending",  reason:"Family vacation"    },
  { id:2, empId:5, type:"Sick",   from:"2026-05-28", to:"2026-05-28", days:1, status:"approved", reason:"Medical"            },
  { id:3, empId:3, type:"Annual", from:"2026-07-01", to:"2026-07-05", days:5, status:"pending",  reason:"Personal travel"    },
];

/* ─── Helpers ────────────────────────────────────────────────── */
function currentWeek() {
  const now  = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const wk   = Math.ceil(((now - jan1) / 864e5 + jan1.getDay() + 1) / 7);
  return now.getFullYear() + "-W" + String(wk).padStart(2, "0");
}

function empUtil(empId, week, entries, allocs, employees) {
  const emp   = employees.find(e => e.id === empId);
  if (!emp) return 0;
  const logged = entries.filter(e => e.empId === empId && e.week === week).reduce((s, e) => s + e.hours, 0);
  return emp.capacity > 0 ? Math.round((logged / emp.capacity) * 100) : 0;
}

function empLoggedHours(empId, week, entries) {
  return entries.filter(e => e.empId === empId && e.week === week).reduce((s, e) => s + e.hours, 0);
}

function empAllocatedHours(empId, allocs) {
  return allocs.filter(a => a.empId === empId).reduce((s, a) => s + a.hoursPerWeek, 0);
}

/* ─── Shared UI ──────────────────────────────────────────────── */
function Av({ name, color = TEAL, sz = 32 }) {
  const init = (name || "?").split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase();
  return (
    <div style={{ width:sz, height:sz, borderRadius:"50%", background:color+"22", color,
      fontWeight:700, fontSize:sz*0.33, display:"flex", alignItems:"center", justifyContent:"center",
      border:"1.5px solid "+color+"44", flexShrink:0 }}>{init}</div>
  );
}

const STATUS_MAP = {
  active:    { bg:"#D1FAE5", fg:"#065F46", label:"Active"    },
  review:    { bg:"#FEF3C7", fg:"#92400E", label:"In Review" },
  planning:  { bg:"#DBEAFE", fg:"#1E40AF", label:"Planning"  },
  completed: { bg:"#F3F4F6", fg:"#374151", label:"Completed" },
  pending:   { bg:"#FEF3C7", fg:"#92400E", label:"Pending"   },
  approved:  { bg:"#D1FAE5", fg:"#065F46", label:"Approved"  },
  rejected:  { bg:"#FEE2E2", fg:"#991B1B", label:"Rejected"  },
};
function Badge({ s }) {
  const st = STATUS_MAP[s] || { bg:"#F3F4F6", fg:"#374151", label:s };
  return <span style={{ background:st.bg, color:st.fg, borderRadius:999, padding:"2px 10px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{st.label}</span>;
}

function Prog({ val, h = 6 }) {
  const { bg: fill } = utilColor(val);
  return (
    <div style={{ background:BORDER, borderRadius:999, height:h, overflow:"hidden", width:"100%" }}>
      <div style={{ width:Math.min(val,100)+"%", height:"100%", borderRadius:999, background:fill === "#D1FAE5" ? TEAL : fill === "#FEE2E2" ? "#EF4444" : fill === "#FEF3C7" ? "#F59E0B" : fill === "#EDE9FE" ? "#8B5CF6" : BORDER, transition:"width .3s" }} />
    </div>
  );
}

function Card({ children, style = {} }) {
  return <div style={{ background:WHITE, border:"1px solid "+BORDER, borderRadius:12, padding:20, ...style }}>{children}</div>;
}
function SecHd({ title, action }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
      <span style={{ fontSize:14, fontWeight:700, color:TEXT }}>{title}</span>
      {action}
    </div>
  );
}
function Btn({ children, onClick, primary, danger, small, full, disabled, style:s = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display:"flex", alignItems:"center", gap:6, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.55:1,
      padding:small?"5px 12px":"8px 16px", borderRadius:8, fontSize:small?12:13, fontWeight:500,
      width:full?"100%":undefined, justifyContent:full?"center":undefined,
      border:primary?"none":danger?"1px solid #FCA5A5":"1px solid "+BORDER,
      background:primary?TEAL:danger?"#FEE2E2":WHITE,
      color:primary?"#fff":danger?"#991B1B":"#374151", ...s }}>{children}</button>
  );
}
function KPI({ label, value, sub, icon, alert }) {
  return (
    <div style={{ background:WHITE, border:"1px solid "+(alert?"#FCA5A5":BORDER), borderRadius:12, padding:"14px 18px", flex:1, minWidth:140 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:12, color:MUTED, fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:18 }}>{icon}</span>
      </div>
      <div style={{ fontSize:26, fontWeight:800, color:alert?"#EF4444":TEXT, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:MUTED, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

/* ─── DASHBOARD ──────────────────────────────────────────────── */
function Dashboard({ employees, projects, allocs, entries, leaves, setView }) {
  const week = currentWeek();

  const empStats = employees.filter(e => e.active).map(e => {
    const logged    = empLoggedHours(e.id, week, entries);
    const allocated = empAllocatedHours(e.id, allocs);
    const util      = e.capacity > 0 ? Math.round((logged / e.capacity) * 100) : 0;
    return { ...e, logged, allocated, util };
  });

  const overloaded   = empStats.filter(e => e.util > 100).length;
  const underutil    = empStats.filter(e => e.util < 50 && e.util > 0).length;
  const noHours      = empStats.filter(e => e.util === 0).length;
  const avgUtil      = empStats.length ? Math.round(empStats.reduce((s,e) => s+e.util,0)/empStats.length) : 0;

  const weeklyChart = WEEKS.map(w => {
    const totalCap    = employees.filter(e=>e.active).reduce((s,e)=>s+e.capacity,0);
    const totalLogged = entries.filter(en=>en.week===w).reduce((s,en)=>s+en.hours,0);
    return { week:w.replace("2026-",""), logged:totalLogged, capacity:totalCap, util:totalCap>0?Math.round((totalLogged/totalCap)*100):0 };
  });

  const projHours = projects.map(p => ({
    name: p.name.split(" ").slice(0,2).join(" "),
    hours: entries.filter(e=>e.projId===p.id).reduce((s,e)=>s+e.hours,0),
  }));

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:TEXT, margin:"0 0 3px" }}>Dashboard</h1>
        <p style={{ color:MUTED, fontSize:13, margin:0 }}>Current week: {week}  -  Team utilization overview</p>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <KPI label="Avg Utilization"   value={avgUtil+"%"}                sub="This week"           icon="📊" alert={avgUtil<60} />
        <KPI label="Active Employees"  value={employees.filter(e=>e.active).length} sub={employees.length+" total"} icon="👥" />
        <KPI label="Active Projects"   value={projects.filter(p=>p.status==="active").length} sub={projects.length+" total"} icon="📁" />
        <KPI label="Overloaded"        value={overloaded}  sub="Over 100% capacity" icon="🔴" alert={overloaded>0} />
        <KPI label="Under-utilized"    value={underutil}   sub="Below 50%"          icon="🟡" />
        <KPI label="No Hours Logged"   value={noHours}     sub="This week"          icon="⚪" alert={noHours>0} />
      </div>

      {(overloaded > 0 || noHours > 0) && (
        <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#92400E", marginBottom:8 }}>Attention Required</div>
          <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
            {empStats.filter(e=>e.util>100).map(e=>(
              <div key={e.id} style={{ fontSize:12, color:"#C2410C" }}>
                <strong>{e.name}</strong> is at {e.util}% utilization ({e.logged}h logged / {e.capacity}h capacity)
              </div>
            ))}
            {empStats.filter(e=>e.util===0).map(e=>(
              <div key={e.id} style={{ fontSize:12, color:"#92400E" }}>
                <strong>{e.name}</strong> has no hours logged this week
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:14, marginBottom:14 }}>
        <Card>
          <SecHd title="Weekly Team Utilization (last 6 weeks)" />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyChart}>
              <defs>
                <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={TEAL} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={TEAL} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="week" tick={{ fontSize:11, fill:"#94A3B8" }} />
              <YAxis tick={{ fontSize:11, fill:"#94A3B8" }} domain={[0,100]} unit="%" />
              <Tooltip formatter={v => [v+"%","Utilization"]} />
              <Area type="monotone" dataKey="util" stroke={TEAL} fill="url(#ug)" strokeWidth={2} dot={{ r:3, fill:TEAL }} name="Utilization" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SecHd title="Hours by Project" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={projHours} layout="vertical" margin={{ left:0, right:10 }}>
              <XAxis type="number" tick={{ fontSize:11, fill:"#94A3B8" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize:11, fill:"#94A3B8" }} width={100} />
              <Tooltip />
              <Bar dataKey="hours" fill={TEAL} radius={[0,4,4,0]} name="Hours" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SecHd title="This Week  -  Resource Utilization" action={<Btn small onClick={()=>setView("utilization")}>Full Report</Btn>} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {empStats.map(e => {
            const { bg, fg } = utilColor(e.util);
            return (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"#F8FAFC", borderRadius:8, border:"1px solid "+BORDER }}>
                <Av name={e.name} color={e.color} sz={32} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:TEXT, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.name}</div>
                  <div style={{ fontSize:11, color:MUTED }}>{e.dept}</div>
                  <div style={{ marginTop:4 }}>
                    <Prog val={e.util} h={5} />
                  </div>
                </div>
                <div style={{ background:bg, color:fg, borderRadius:6, padding:"3px 8px", fontSize:12, fontWeight:700, whiteSpace:"nowrap" }}>
                  {e.util}%
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ─── EMPLOYEES ──────────────────────────────────────────────── */
function Employees({ employees, setEmployees, allocs }) {
  const [tab, setTab]           = useState("list");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview]   = useState(null);
  const [csvError, setCsvError] = useState("");
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState({ name:"", email:"", dept:"", role:"", capacity:"40" });
  const fileRef                 = useRef();

  const handleFile = file => {
    setCsvError("");
    if (!file || !file.name.endsWith(".csv")) { setCsvError("Please upload a .csv file."); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const rows = parseCSV(e.target.result);
        if (rows.length === 0) { setCsvError("No rows found. Check your file."); return; }
        setPreview(rows.map((r,i) => rowToEmployee(r,i)));
      } catch(err) {
        setCsvError("Parse error: "+err.message);
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    setEmployees(prev => {
      const existingEmails = new Set(prev.map(e=>e.email.toLowerCase()));
      const fresh = preview.filter(p => !existingEmails.has((p.email||"").toLowerCase()));
      return [...prev, ...fresh];
    });
    setPreview(null);
    setTab("list");
  };

  const addOne = () => {
    if (!form.name) return;
    setEmployees(prev => [...prev, rowToEmployee({ ...form, weekly_capacity:form.capacity }, prev.length)]);
    setForm({ name:"", email:"", dept:"", role:"", capacity:"40" });
    setShowAdd(false);
  };

  const depts = [...new Set(employees.map(e=>e.dept))].filter(Boolean);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:TEXT, margin:"0 0 3px" }}>Employees</h1>
          <p style={{ color:MUTED, fontSize:13, margin:0 }}>{employees.filter(e=>e.active).length} active across {depts.length} departments</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={()=>setTab(tab==="upload"?"list":"upload")}>
            {tab==="upload" ? "Back to List" : "Upload CSV"}
          </Btn>
          <Btn primary onClick={()=>setShowAdd(v=>!v)}>+ Add Employee</Btn>
        </div>
      </div>

      {/* Add single employee */}
      {showAdd && (
        <Card style={{ marginBottom:14, border:"1px solid #06D6A033", background:"#F0FDF9" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Add Employee</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:12 }}>
            {[["Full Name","name","text"],["Email","email","email"],["Department","dept","text"],["Role / Title","role","text"],["Weekly Hours","capacity","number"]].map(([lbl,k,t])=>(
              <div key={k}>
                <label style={{ fontSize:11, color:MUTED, display:"block", marginBottom:4 }}>{lbl}</label>
                <input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                  style={{ width:"100%", padding:"7px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13, boxSizing:"border-box" }} />
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn primary small onClick={addOne}>Add</Btn>
            <Btn small onClick={()=>setShowAdd(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* CSV Upload */}
      {tab === "upload" && (
        <div>
          <Card style={{ marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Upload Employee CSV</div>
            <div style={{ fontSize:13, color:MUTED, marginBottom:16 }}>
              Expected columns: <code style={{ background:"#F1F5F9", padding:"1px 6px", borderRadius:4 }}>Name, Email, Department, Role, Weekly_Capacity</code>
            </div>

            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
              onClick={()=>fileRef.current?.click()}
              style={{ border:"2px dashed "+(dragOver?TEAL:"#CBD5E1"), borderRadius:10, padding:"36px 20px",
                textAlign:"center", cursor:"pointer", background:dragOver?"#F0FDF9":BG, transition:"all .2s" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
              <div style={{ fontSize:14, fontWeight:600, color:dragOver?TEAL:TEXT }}>Drop your CSV here or click to browse</div>
              <div style={{ fontSize:12, color:MUTED, marginTop:4 }}>.csv files only</div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }}
                onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);}} />
            </div>

            {csvError && (
              <div style={{ marginTop:12, padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:8, fontSize:13, color:"#DC2626" }}>{csvError}</div>
            )}

            <div style={{ marginTop:16, padding:"12px 14px", background:"#F8FAFC", borderRadius:8, border:"1px solid "+BORDER }}>
              <div style={{ fontSize:12, fontWeight:700, color:MUTED, marginBottom:8 }}>Sample CSV format</div>
              <pre style={{ fontSize:12, color:"#475569", margin:0, fontFamily:"monospace" }}>{`Name,Email,Department,Role,Weekly_Capacity
John Smith,john@company.com,Engineering,Developer,40
Jane Doe,jane@company.com,Design,Designer,40
Bob Jones,bob@company.com,QA,QA Engineer,32`}</pre>
            </div>
          </Card>

          {/* Preview */}
          {preview && (
            <Card>
              <SecHd title={"Preview  -  "+preview.length+" employees found"}
                action={<div style={{display:"flex",gap:8}}>
                  <Btn small onClick={()=>setPreview(null)}>Cancel</Btn>
                  <Btn primary small onClick={confirmImport}>Import All</Btn>
                </div>} />
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:"#F8FAFC" }}>
                      {["Name","Email","Department","Role","Capacity"].map(h=>(
                        <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontWeight:600, color:MUTED, borderBottom:"1px solid "+BORDER }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((e,i)=>(
                      <tr key={i} style={{ borderBottom:"1px solid #F1F5F9" }}>
                        <td style={{ padding:"8px 12px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <Av name={e.name} color={e.color} sz={26} />
                            <span style={{ fontWeight:500 }}>{e.name}</span>
                          </div>
                        </td>
                        <td style={{ padding:"8px 12px", color:MUTED }}>{e.email}</td>
                        <td style={{ padding:"8px 12px" }}>{e.dept}</td>
                        <td style={{ padding:"8px 12px" }}>{e.role}</td>
                        <td style={{ padding:"8px 12px" }}>{e.capacity}h/wk</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Employee list */}
      {tab === "list" && (
        <Card>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["Employee","Department","Role","Capacity","Projects","Status"].map(h=>(
                  <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontWeight:600, color:MUTED, borderBottom:"1px solid "+BORDER }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(e=>{
                const projCount = allocs.filter(a=>a.empId===e.id).length;
                return (
                  <tr key={e.id} style={{ borderBottom:"1px solid #F1F5F9", opacity:e.active?1:0.5 }}>
                    <td style={{ padding:"10px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <Av name={e.name} color={e.color} sz={32} />
                        <div>
                          <div style={{ fontWeight:600 }}>{e.name}</div>
                          <div style={{ fontSize:11, color:MUTED }}>{e.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ background:e.color+"22", color:e.color, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600 }}>{e.dept}</span>
                    </td>
                    <td style={{ padding:"10px 12px", color:MUTED }}>{e.role}</td>
                    <td style={{ padding:"10px 12px", fontWeight:600 }}>{e.capacity}h / wk</td>
                    <td style={{ padding:"10px 12px", color:MUTED }}>{projCount} project{projCount!==1?"s":""}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ background:e.active?"#D1FAE5":"#F3F4F6", color:e.active?"#065F46":"#6B7280",
                        borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600 }}>
                        {e.active?"Active":"Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ─── PROJECTS ───────────────────────────────────────────────── */
function Projects({ projects, setProjects, allocs, setAllocs, employees }) {
  const [showNew, setShowNew]   = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState({ name:"", client:"", status:"planning", start:"", end:"" });
  const [allocForm, setAllocForm] = useState({ empId:"", hoursPerWeek:"" });

  const addProj = () => {
    if (!form.name) return;
    const p = { id:Date.now(), ...form };
    setProjects(prev=>[...prev, p]);
    setShowNew(false);
    setForm({ name:"", client:"", status:"planning", start:"", end:"" });
  };

  const addAlloc = (projId) => {
    if (!allocForm.empId || !allocForm.hoursPerWeek) return;
    const existing = allocs.find(a=>a.empId===+allocForm.empId&&a.projId===projId);
    if (existing) {
      setAllocs(prev=>prev.map(a=>a.id===existing.id?{...a,hoursPerWeek:+allocForm.hoursPerWeek}:a));
    } else {
      setAllocs(prev=>[...prev,{id:Date.now(),empId:+allocForm.empId,projId,hoursPerWeek:+allocForm.hoursPerWeek}]);
    }
    setAllocForm({ empId:"", hoursPerWeek:"" });
  };

  const removeAlloc = (id) => setAllocs(prev=>prev.filter(a=>a.id!==id));

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:TEXT, margin:"0 0 3px" }}>Projects</h1>
          <p style={{ color:MUTED, fontSize:13, margin:0 }}>{projects.length} projects  -  manage teams and allocations</p>
        </div>
        <Btn primary onClick={()=>setShowNew(v=>!v)}>+ New Project</Btn>
      </div>

      {showNew && (
        <Card style={{ marginBottom:14, border:"1px solid #06D6A033", background:"#F0FDF9" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Create Project</div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr", gap:10, marginBottom:12 }}>
            {[["Project Name","name","text"],["Client","client","text"],["Start Date","start","date"],["End Date","end","date"]].map(([lbl,k,t])=>(
              <div key={k}>
                <label style={{ fontSize:11, color:MUTED, display:"block", marginBottom:4 }}>{lbl}</label>
                <input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                  style={{ width:"100%", padding:"7px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13, boxSizing:"border-box" }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize:11, color:MUTED, display:"block", marginBottom:4 }}>Status</label>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                style={{ width:"100%", padding:"7px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13 }}>
                {["planning","active","review","completed"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn primary small onClick={addProj}>Create</Btn>
            <Btn small onClick={()=>setShowNew(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {projects.map(p => {
          const pAllocs = allocs.filter(a=>a.projId===p.id);
          const isOpen  = selected===p.id;
          const totalAllocHrs = pAllocs.reduce((s,a)=>s+a.hoursPerWeek,0);
          const unassigned = employees.filter(e=>e.active && !pAllocs.find(a=>a.empId===e.id));

          return (
            <Card key={p.id} style={{ padding:0, overflow:"hidden" }}>
              <div style={{ padding:"14px 18px", cursor:"pointer" }} onClick={()=>setSelected(isOpen?null:p.id)}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, fontWeight:700, color:TEXT }}>{p.name}</span>
                      <Badge s={p.status} />
                      <span style={{ fontSize:12, color:MUTED }}>{p.client}</span>
                    </div>
                    <div style={{ display:"flex", gap:16, fontSize:12, color:MUTED }}>
                      <span>{pAllocs.length} team members</span>
                      <span>{totalAllocHrs}h allocated/week</span>
                      {p.start && <span>{p.start} to {p.end}</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:-6 }}>
                    {pAllocs.slice(0,5).map(a=>{
                      const emp = employees.find(e=>e.id===a.empId);
                      return emp ? <Av key={a.id} name={emp.name} color={emp.color} sz={28} /> : null;
                    })}
                    {pAllocs.length>5 && <div style={{ width:28,height:28,borderRadius:"50%",background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:MUTED }}>+{pAllocs.length-5}</div>}
                  </div>
                  <span style={{ color:"#CBD5E1", fontSize:12, marginLeft:8 }}>{isOpen?"▲":"▼"}</span>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop:"1px solid #F1F5F9", background:"#FAFBFC", padding:"14px 18px" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:MUTED, marginBottom:10, textTransform:"uppercase", letterSpacing:0.5 }}>Team Allocations</div>
                      {pAllocs.length===0 && <div style={{ color:"#94A3B8", fontSize:13 }}>No team members allocated yet.</div>}
                      {pAllocs.map(a=>{
                        const emp=employees.find(e=>e.id===a.empId);
                        if (!emp) return null;
                        const pct=emp.capacity>0?Math.round((a.hoursPerWeek/emp.capacity)*100):0;
                        return (
                          <div key={a.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #F1F5F9" }}>
                            <Av name={emp.name} color={emp.color} sz={28} />
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:500 }}>{emp.name}</div>
                              <div style={{ fontSize:11, color:MUTED }}>{emp.role}</div>
                            </div>
                            <div style={{ fontSize:13, fontWeight:600, color:TEXT }}>{a.hoursPerWeek}h/wk</div>
                            <div style={{ fontSize:11, background:"#EFF6FF", color:"#1D4ED8", padding:"2px 7px", borderRadius:6 }}>{pct}% of capacity</div>
                            <button onClick={()=>removeAlloc(a.id)} style={{ border:"none",background:"none",color:"#94A3B8",cursor:"pointer",fontSize:16 }}>x</button>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:MUTED, marginBottom:10, textTransform:"uppercase", letterSpacing:0.5 }}>Add Team Member</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        <div>
                          <label style={{ fontSize:11, color:MUTED, display:"block", marginBottom:4 }}>Employee</label>
                          <select value={allocForm.empId} onChange={e=>setAllocForm(f=>({...f,empId:e.target.value}))}
                            style={{ width:"100%", padding:"7px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13 }}>
                            <option value="">Select employee...</option>
                            {unassigned.map(e=><option key={e.id} value={e.id}>{e.name} ({e.capacity}h capacity)</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize:11, color:MUTED, display:"block", marginBottom:4 }}>Hours per week</label>
                          <input type="number" min="1" max="80" value={allocForm.hoursPerWeek}
                            onChange={e=>setAllocForm(f=>({...f,hoursPerWeek:e.target.value}))}
                            style={{ width:"100%", padding:"7px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13, boxSizing:"border-box" }} />
                        </div>
                        <Btn primary small onClick={()=>addAlloc(p.id)}>Add to Project</Btn>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ─── UTILIZATION ────────────────────────────────────────────── */
function Utilization({ employees, allocs, entries }) {
  const [selWeek, setSelWeek] = useState(WEEKS[WEEKS.length-1]);

  const weekStats = employees.filter(e=>e.active).map(e=>{
    const logged    = empLoggedHours(e.id, selWeek, entries);
    const allocated = empAllocatedHours(e.id, allocs);
    const util      = e.capacity > 0 ? Math.round((logged/e.capacity)*100) : 0;
    return { ...e, logged, allocated, util };
  }).sort((a,b)=>b.util-a.util);

  /* heatmap: employees x weeks */
  const heatRows = employees.filter(e=>e.active).map(e=>{
    return {
      emp: e,
      cells: WEEKS.map(w=>({
        week:w, pct:e.capacity>0?Math.round((empLoggedHours(e.id,w,entries)/e.capacity)*100):0
      }))
    };
  });

  const barData = weekStats.map(e=>({ name:e.name.split(" ")[0], logged:e.logged, capacity:e.capacity, util:e.util }));

  return (
    <div>
      <div style={{ marginBottom:18 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:TEXT, margin:"0 0 3px" }}>Utilization</h1>
        <p style={{ color:MUTED, fontSize:13, margin:0 }}>Weekly resource utilization tracking and analysis</p>
      </div>

      {/* Week selector */}
      <div style={{ display:"flex", gap:6, marginBottom:18, flexWrap:"wrap" }}>
        {WEEKS.map(w=>(
          <button key={w} onClick={()=>setSelWeek(w)} style={{
            padding:"6px 14px", borderRadius:8, border:"1px solid "+(selWeek===w?TEAL:BORDER),
            background:selWeek===w?TEAL:WHITE, color:selWeek===w?"#fff":MUTED,
            fontSize:12, fontWeight:600, cursor:"pointer" }}>{w.replace("2026-","")}</button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
        <Card>
          <SecHd title={"Logged vs Capacity  -  "+selWeek.replace("2026-","")} />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize:11, fill:"#94A3B8" }} />
              <YAxis tick={{ fontSize:11, fill:"#94A3B8" }} unit="h" />
              <Tooltip />
              <Legend />
              <Bar dataKey="capacity" name="Capacity" fill="#E2E8F0" radius={[3,3,0,0]} />
              <Bar dataKey="logged"   name="Logged"   radius={[3,3,0,0]}>
                {barData.map((d,i)=>{
                  const clr = d.util>100?"#8B5CF6":d.util>=75?TEAL:d.util>=50?"#F59E0B":"#EF4444";
                  return <Cell key={i} fill={clr} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SecHd title="Utilization Summary" />
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {weekStats.map(e=>{
              const { bg, fg } = utilColor(e.util);
              return (
                <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <Av name={e.name} color={e.color} sz={28} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:13, fontWeight:500 }}>{e.name}</span>
                      <span style={{ fontSize:12, color:MUTED }}>{e.logged}h / {e.capacity}h</span>
                    </div>
                    <Prog val={e.util} h={6} />
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, background:bg, color:fg, borderRadius:6, padding:"2px 8px", minWidth:44, textAlign:"center" }}>{e.util}%</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <SecHd title="6-Week Utilization Heatmap" />
        <div style={{ fontSize:11, color:MUTED, marginBottom:12, display:"flex", gap:16, flexWrap:"wrap" }}>
          {[["No data","#F1F5F9","#94A3B8"],["Under 50%","#FEE2E2","#991B1B"],["50-75%","#FEF3C7","#92400E"],["75-100%","#D1FAE5","#065F46"],["Over 100%","#EDE9FE","#4C1D95"]].map(([lbl,bg,fg])=>(
            <span key={lbl} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ width:14, height:14, borderRadius:3, background:bg, border:"1px solid "+BORDER, display:"inline-block" }} />
              <span style={{ color:fg, fontWeight:600 }}>{lbl}</span>
            </span>
          ))}
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ padding:"6px 12px", textAlign:"left", fontWeight:600, color:MUTED, width:160 }}>Employee</th>
                {WEEKS.map(w=>(
                  <th key={w} style={{ padding:"6px 10px", textAlign:"center", fontWeight:600, color:MUTED, minWidth:80 }}>{w.replace("2026-","")}</th>
                ))}
                <th style={{ padding:"6px 10px", textAlign:"center", fontWeight:600, color:MUTED }}>Avg</th>
              </tr>
            </thead>
            <tbody>
              {heatRows.map(row=>{
                const validPcts = row.cells.filter(c=>c.pct>0).map(c=>c.pct);
                const avg = validPcts.length ? Math.round(validPcts.reduce((s,v)=>s+v,0)/validPcts.length) : 0;
                return (
                  <tr key={row.emp.id}>
                    <td style={{ padding:"6px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Av name={row.emp.name} color={row.emp.color} sz={22} />
                        <span style={{ fontWeight:500 }}>{row.emp.name.split(" ")[0]}</span>
                      </div>
                    </td>
                    {row.cells.map(c=>{
                      const { bg, fg } = utilColor(c.pct);
                      return (
                        <td key={c.week} style={{ padding:"4px 6px", textAlign:"center" }}>
                          <div style={{ background:bg, color:fg, borderRadius:6, padding:"5px 8px", fontWeight:700, fontSize:12 }}>
                            {c.pct > 0 ? c.pct+"%" : "-"}
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding:"4px 10px", textAlign:"center" }}>
                      <div style={{ background:utilColor(avg).bg, color:utilColor(avg).fg, borderRadius:6, padding:"5px 8px", fontWeight:700, fontSize:12 }}>
                        {avg > 0 ? avg+"%" : "-"}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ─── TIMESHEETS ─────────────────────────────────────────────── */
function Timesheets({ entries, setEntries, projects, employees, allocs }) {
  const [selEmp, setSelEmp] = useState(String(employees[0]?.id||""));
  const [week, setWeek]     = useState(WEEKS[WEEKS.length-1]);
  const [hours, setHours]   = useState({});
  const [notes, setNotes]   = useState({});
  const [saved, setSaved]   = useState(false);

  const emp = employees.find(e=>String(e.id)===selEmp);
  const empAllocs = allocs.filter(a=>a.empId===emp?.id);
  const empProjs  = projects.filter(p=>empAllocs.find(a=>a.projId===p.id));

  const totalLogged = Object.values(hours).reduce((s,v)=>s+(+v||0),0);
  const capacity    = emp?.capacity || 40;

  const save = () => {
    const toRemove = entries.filter(e=>String(e.empId)===selEmp&&e.week===week).map(e=>e.id);
    const newEntries = empProjs
      .filter(p=>hours[p.id]&&+hours[p.id]>0)
      .map(p=>({ id:Date.now()+p.id, empId:emp.id, projId:p.id, week, hours:+hours[p.id], note:notes[p.id]||"" }));
    setEntries(prev=>[...prev.filter(e=>!toRemove.includes(e.id)),...newEntries]);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  // Load existing entries when emp/week changes
  const loadExisting = () => {
    const existing = entries.filter(e=>String(e.empId)===selEmp&&e.week===week);
    const h={}, n={};
    existing.forEach(e=>{ h[e.projId]=String(e.hours); n[e.projId]=e.note||""; });
    setHours(h); setNotes(n);
  };

  return (
    <div>
      <div style={{ marginBottom:18 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:TEXT, margin:"0 0 3px" }}>Timesheets</h1>
        <p style={{ color:MUTED, fontSize:13, margin:0 }}>Log weekly hours per project</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:14 }}>
        <div>
          <Card style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Select Employee</div>
            <select value={selEmp} onChange={e=>{setSelEmp(e.target.value);setHours({});setNotes({});}}
              style={{ width:"100%", padding:"8px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13, marginBottom:12 }}>
              {employees.filter(e=>e.active).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </select>

            {emp && (
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:10, background:"#F0FDF9", borderRadius:8, border:"1px solid #06D6A022" }}>
                <Av name={emp.name} color={emp.color} sz={36} />
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>{emp.name}</div>
                  <div style={{ fontSize:12, color:MUTED }}>{emp.role}  -  {emp.dept}</div>
                  <div style={{ fontSize:12, color:MUTED }}>Capacity: {emp.capacity}h/wk</div>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Select Week</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {WEEKS.map(w=>(
                <button key={w} onClick={()=>{setWeek(w);setHours({});setNotes({});}}
                  style={{ padding:"8px 12px", borderRadius:8, border:"1px solid "+(week===w?TEAL:BORDER),
                    background:week===w?TEAL:WHITE, color:week===w?"#fff":TEXT,
                    fontSize:13, fontWeight:week===w?700:400, cursor:"pointer", textAlign:"left" }}>
                  {w}
                  {entries.some(e=>String(e.empId)===selEmp&&e.week===w) && (
                    <span style={{ marginLeft:8, fontSize:10, background:week===w?"#ffffff33":"#D1FAE5",
                      color:week===w?"#fff":"#065F46", borderRadius:4, padding:"1px 6px" }}>logged</span>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700 }}>Hours for {week}</div>
              <div style={{ fontSize:12, color:MUTED, marginTop:2 }}>
                {totalLogged}h logged of {capacity}h capacity
                <span style={{ marginLeft:8, fontWeight:700, color:totalLogged>capacity?"#EF4444":TEAL }}>{capacity>0?Math.round((totalLogged/capacity)*100):0}%</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn small onClick={loadExisting}>Load Saved</Btn>
              <Btn primary small onClick={save}>{saved?"Saved!":"Save Hours"}</Btn>
            </div>
          </div>

          {empProjs.length===0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:MUTED, fontSize:13 }}>
              {emp ? emp.name+" is not allocated to any projects yet." : "Select an employee."}
            </div>
          ) : (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 1fr", gap:10, marginBottom:8, padding:"0 4px" }}>
                <span style={{ fontSize:11, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:0.5 }}>Project</span>
                <span style={{ fontSize:11, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:0.5 }}>Hours</span>
                <span style={{ fontSize:11, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:0.5 }}>Notes</span>
              </div>
              {empProjs.map(p=>{
                const alloc = empAllocs.find(a=>a.projId===p.id);
                return (
                  <div key={p.id} style={{ display:"grid", gridTemplateColumns:"1fr 100px 1fr", gap:10, marginBottom:10, alignItems:"center",
                    padding:"10px 12px", background:"#F8FAFC", borderRadius:8, border:"1px solid "+BORDER }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                      <div style={{ fontSize:11, color:MUTED }}>{p.client}  -  allocated {alloc?.hoursPerWeek||0}h/wk</div>
                    </div>
                    <input type="number" min="0" max="80" placeholder="0" value={hours[p.id]||""}
                      onChange={e=>setHours(h=>({...h,[p.id]:e.target.value}))}
                      style={{ padding:"7px 10px", border:"1px solid "+(hours[p.id]>0?TEAL:BORDER),
                        borderRadius:6, fontSize:14, fontWeight:700, textAlign:"center", boxSizing:"border-box", width:"100%",
                        background:hours[p.id]>0?"#F0FDF9":WHITE }} />
                    <input type="text" placeholder="What did you work on?" value={notes[p.id]||""}
                      onChange={e=>setNotes(n=>({...n,[p.id]:e.target.value}))}
                      style={{ padding:"7px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13, boxSizing:"border-box", width:"100%" }} />
                  </div>
                );
              })}

              <div style={{ marginTop:12, padding:"10px 14px", background:"#F8FAFC", borderRadius:8, border:"1px solid "+(totalLogged>capacity?"#FCA5A5":BORDER) }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>Total hours logged</span>
                  <span style={{ fontSize:18, fontWeight:800, color:totalLogged>capacity?"#EF4444":TEAL }}>{totalLogged}h</span>
                </div>
                {totalLogged>capacity && (
                  <div style={{ fontSize:12, color:"#EF4444", marginTop:4 }}>Warning: {totalLogged-capacity}h over capacity</div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ─── LEAVES ─────────────────────────────────────────────────── */
function Leaves({ leaves, setLeaves, employees, role }) {
  const [form, setForm] = useState({ empId:"", type:"Annual", from:"", to:"", reason:"" });
  const apply = () => {
    if (!form.from||!form.to||!form.empId) return;
    const days=Math.max(1,Math.ceil((new Date(form.to)-new Date(form.from))/864e5)+1);
    setLeaves(p=>[...p,{id:Date.now(),...form,empId:+form.empId,days,status:"pending"}]);
    setForm({empId:"",type:"Annual",from:"",to:"",reason:""});
  };
  const upd=(id,s)=>setLeaves(p=>p.map(l=>l.id===id?{...l,status:s}:l));
  const pending=leaves.filter(l=>l.status==="pending");
  const hist=leaves.filter(l=>l.status!=="pending");

  return (
    <div>
      <div style={{ marginBottom:18 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:TEXT, margin:"0 0 3px" }}>Leave Management</h1>
        <p style={{ color:MUTED, fontSize:13, margin:0 }}>Apply and approve leave requests</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:14 }}>
        <Card>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>Apply for Leave</div>
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:MUTED, display:"block", marginBottom:4, fontWeight:500 }}>Employee</label>
            <select value={form.empId} onChange={e=>setForm(f=>({...f,empId:e.target.value}))}
              style={{ width:"100%", padding:"7px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13 }}>
              <option value="">Select employee...</option>
              {employees.filter(e=>e.active).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          {[["Type","type","sel"],["From","from","date"],["To","to","date"]].map(([lbl,k,t])=>(
            <div key={k} style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:MUTED, display:"block", marginBottom:4, fontWeight:500 }}>{lbl}</label>
              {t==="sel"
                ?<select value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    style={{ width:"100%", padding:"7px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13 }}>
                    {["Annual","Sick","Casual","Maternity","Paternity"].map(x=><option key={x}>{x}</option>)}
                  </select>
                :<input type="date" value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    style={{ width:"100%", padding:"7px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13, boxSizing:"border-box" }} />
              }
            </div>
          ))}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, color:MUTED, display:"block", marginBottom:4, fontWeight:500 }}>Reason</label>
            <textarea value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} rows={2}
              style={{ width:"100%", padding:"7px 10px", border:"1px solid "+BORDER, borderRadius:6, fontSize:13, resize:"none", boxSizing:"border-box" }} />
          </div>
          <Btn primary full onClick={apply}>Submit Request</Btn>
        </Card>

        <div>
          {role==="admin" && pending.length>0 && (
            <Card style={{ marginBottom:14, border:"1px solid #FDE68A" }}>
              <SecHd title={"Pending Approvals ("+pending.length+")"} />
              {pending.map(l=>{
                const e=employees.find(em=>em.id===l.empId);
                return (
                  <div key={l.id} style={{ display:"flex", alignItems:"center", gap:10, padding:12,
                    background:"#FFFBEB", borderRadius:8, border:"1px solid #FDE68A", marginBottom:8 }}>
                    <Av name={e?.name||"?"} color={e?.color||TEAL} sz={30} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{e?.name}</div>
                      <div style={{ fontSize:12, color:MUTED }}>{l.type}  -  {l.from} to {l.to}  -  {l.days} day{l.days>1?"s":""}</div>
                      <div style={{ fontSize:12, color:"#94A3B8" }}>{l.reason}</div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <Btn small onClick={()=>upd(l.id,"approved")} style={{ background:"#D1FAE5",color:"#065F46",border:"none" }}>Approve</Btn>
                      <Btn small danger onClick={()=>upd(l.id,"rejected")}>Reject</Btn>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
          <Card>
            <SecHd title="Leave History" />
            {hist.length===0 && <div style={{ color:"#94A3B8", fontSize:13 }}>No leave history yet.</div>}
            {hist.map(l=>{
              const e=employees.find(em=>em.id===l.empId);
              return (
                <div key={l.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                  background:"#F8FAFC", borderRadius:8, marginBottom:7, border:"1px solid "+BORDER }}>
                  <Av name={e?.name||"?"} color={e?.color||TEAL} sz={26} />
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:13, fontWeight:500 }}>{e?.name}</span>
                    <span style={{ fontSize:12, color:MUTED }}>  -  {l.type} Leave</span>
                    <div style={{ fontSize:12, color:"#94A3B8" }}>{l.from} to {l.to}  -  {l.days} day{l.days>1?"s":""}</div>
                  </div>
                  <Badge s={l.status} />
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── ROOT ───────────────────────────────────────────────────── */
export default function App() {
  const [view,      setView]      = useState("dashboard");
  const [role,      setRole]      = useState("admin");
  const [employees, setEmployees] = useState(SEED_EMP);
  const [projects,  setProjects]  = useState(SEED_PROJ);
  const [allocs,    setAllocs]    = useState(SEED_ALLOC);
  const [entries,   setEntries]   = useState(SEED_ENTRIES);
  const [leaves,    setLeaves]    = useState(SEED_LEAVES);

  const nav = [
    { id:"dashboard",   label:"Dashboard",    icon:"📊" },
    { id:"employees",   label:"Employees",    icon:"👥" },
    { id:"projects",    label:"Projects",     icon:"📁" },
    { id:"utilization", label:"Utilization",  icon:"📈" },
    { id:"timesheets",  label:"Timesheets",   icon:"⏱️" },
    { id:"leaves",      label:"Leaves",       icon:"📅" },
    ...(role==="admin"?[{ id:"jira", label:"Jira (Soon)", icon:"🔗" }]:[]),
  ];

  return (
    <>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{ display:"flex", fontFamily:"'Segoe UI',system-ui,sans-serif", background:BG, minHeight:"100vh" }}>
        <aside style={{ width:220, background:NAV, position:"sticky", top:0, height:"100vh",
          display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto" }}>
          <div style={{ padding:"18px 14px 14px", borderBottom:"1px solid #ffffff14" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:30,height:30,borderRadius:8,background:TEAL,display:"flex",alignItems:"center",
                justifyContent:"center",color:NAV,fontWeight:900,fontSize:15 }}>R</div>
              <span style={{ color:"#fff",fontWeight:800,fontSize:16 }}>ResTrack</span>
            </div>
            <div style={{ fontSize:11, color:"#ffffff50", marginTop:3 }}>Resource Utilization</div>
          </div>

          <div style={{ padding:"10px 14px", borderBottom:"1px solid #ffffff14" }}>
            <div style={{ fontSize:10,color:"#ffffff40",marginBottom:5,textTransform:"uppercase",letterSpacing:1 }}>View As</div>
            <div style={{ display:"flex", background:"#ffffff12", borderRadius:7, padding:2 }}>
              {["admin","user"].map(r=>(
                <button key={r} onClick={()=>setRole(r)} style={{ flex:1,padding:4,border:"none",borderRadius:6,
                  cursor:"pointer",background:role===r?TEAL:"transparent",color:role===r?NAV:"#ffffff70",
                  fontSize:11,fontWeight:600,textTransform:"capitalize",transition:"all .2s" }}>{r}</button>
              ))}
            </div>
          </div>

          <nav style={{ flex:1, padding:"10px 7px" }}>
            {nav.map(item=>(
              <button key={item.id} onClick={()=>setView(item.id)} style={{
                display:"flex",alignItems:"center",gap:9,width:"100%",padding:"8px 10px",borderRadius:8,
                border:"none",cursor:item.id==="jira"?"not-allowed":"pointer",
                background:view===item.id?"#ffffff16":"transparent",
                color:view===item.id?"#fff":item.id==="jira"?"#ffffff30":"#ffffff65",
                fontSize:13,fontWeight:view===item.id?600:400,marginBottom:1,
                transition:"all .15s",textAlign:"left",
                borderLeft:view===item.id?"2.5px solid "+TEAL:"2.5px solid transparent" }}>
                <span style={{ fontSize:15 }}>{item.icon}</span>
                <span style={{ flex:1 }}>{item.label}</span>
              </button>
            ))}
          </nav>

          <div style={{ padding:"12px 14px", borderTop:"1px solid #ffffff14" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <Av name="Alex Chen" color={TEAL} sz={26} />
              <div>
                <div style={{ fontSize:12,color:"#fff",fontWeight:500 }}>Alex Chen</div>
                <div style={{ fontSize:10,color:"#ffffff50" }}>Administrator</div>
              </div>
            </div>
          </div>
        </aside>

        <main style={{ flex:1, padding:24, overflowX:"hidden" }}>
          {view==="dashboard"   && <Dashboard   employees={employees} projects={projects} allocs={allocs} entries={entries} leaves={leaves} setView={setView} />}
          {view==="employees"   && <Employees   employees={employees} setEmployees={setEmployees} allocs={allocs} />}
          {view==="projects"    && <Projects    projects={projects} setProjects={setProjects} allocs={allocs} setAllocs={setAllocs} employees={employees} />}
          {view==="utilization" && <Utilization employees={employees} allocs={allocs} entries={entries} />}
          {view==="timesheets"  && <Timesheets  entries={entries} setEntries={setEntries} projects={projects} employees={employees} allocs={allocs} />}
          {view==="leaves"      && <Leaves      leaves={leaves} setLeaves={setLeaves} employees={employees} role={role} />}
          {view==="jira"        && (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:80 }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🔗</div>
              <h2 style={{ fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 8px" }}>Jira Integration</h2>
              <p style={{ fontSize:14,color:MUTED,margin:"0 0 24px",textAlign:"center",maxWidth:360 }}>
                Jira sync is on the roadmap. Once connected, projects and issues will automatically import into ResTrack.
              </p>
              <span style={{ background:"#FEF3C7",color:"#92400E",borderRadius:999,padding:"6px 18px",fontSize:13,fontWeight:600 }}>Coming Soon</span>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
