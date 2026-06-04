import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";

/* ── Supabase ───────────────────────────────────────────────── */
const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/* ── Design tokens ──────────────────────────────────────────── */
const NAV    = "#0D1B2A";
const TEAL   = "#06D6A0";
const BG     = "#F0F4F8";
const WHITE  = "#FFFFFF";
const TEXT   = "#1C2B3A";
const MUTED  = "#64748B";
const BORDER = "#E2E8F0";

const ROLE_COLORS = { admin:"#8B5CF6", manager:"#3B82F6", user:"#10B981" };
const AVA_COLORS  = ["#06D6A0","#8B5CF6","#3B82F6","#F59E0B","#EF4444","#10B981","#EC4899","#F97316"];

function utilColor(p) {
  if (p===0)    return { bg:"#F1F5F9",fg:"#94A3B8" };
  if (p<50)     return { bg:"#FEE2E2",fg:"#991B1B" };
  if (p<75)     return { bg:"#FEF3C7",fg:"#92400E" };
  if (p<=100)   return { bg:"#D1FAE5",fg:"#065F46" };
  return               { bg:"#EDE9FE",fg:"#4C1D95" };
}

/* ── Shared UI ──────────────────────────────────────────────── */
function Av({ name="?", color=TEAL, sz=32 }) {
  const init=(name).split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();
  return <div style={{ width:sz,height:sz,borderRadius:"50%",background:color+"22",color,fontWeight:700,
    fontSize:sz*.33,display:"flex",alignItems:"center",justifyContent:"center",
    border:"1.5px solid "+color+"44",flexShrink:0 }}>{init}</div>;
}
function RoleBadge({ role }) {
  const c=ROLE_COLORS[role]||MUTED;
  return <span style={{ background:c+"22",color:c,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,textTransform:"capitalize" }}>{role}</span>;
}
const STATUS_MAP={
  active:{bg:"#D1FAE5",fg:"#065F46",label:"Active"},inactive:{bg:"#F3F4F6",fg:"#6B7280",label:"Inactive"},
  pending:{bg:"#FEF3C7",fg:"#92400E",label:"Pending"},approved:{bg:"#D1FAE5",fg:"#065F46",label:"Approved"},
  rejected:{bg:"#FEE2E2",fg:"#991B1B",label:"Rejected"},planning:{bg:"#DBEAFE",fg:"#1E40AF",label:"Planning"},
  review:{bg:"#FEF3C7",fg:"#92400E",label:"In Review"},completed:{bg:"#F3F4F6",fg:"#374151",label:"Completed"},
};
function Badge({ s }) {
  const st=STATUS_MAP[s]||{bg:"#F3F4F6",fg:"#374151",label:s};
  return <span style={{ background:st.bg,color:st.fg,borderRadius:999,padding:"2px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap" }}>{st.label}</span>;
}
function Prog({ val,h=6 }) {
  const clr=val>100?"#8B5CF6":val>=75?TEAL:val>=50?"#F59E0B":"#EF4444";
  return <div style={{ background:BORDER,borderRadius:999,height:h,overflow:"hidden",width:"100%" }}>
    <div style={{ width:Math.min(val,100)+"%",height:"100%",borderRadius:999,background:clr,transition:"width .3s" }}/></div>;
}
function Card({ children,style={} }) {
  return <div style={{ background:WHITE,border:"1px solid "+BORDER,borderRadius:12,padding:20,...style }}>{children}</div>;
}
function SecHd({ title,action }) {
  return <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
    <span style={{ fontSize:14,fontWeight:700,color:TEXT }}>{title}</span>{action}</div>;
}
function Btn({ children,onClick,primary,danger,ghost,small,full,disabled,style:s={} }) {
  return <button onClick={onClick} disabled={disabled} style={{
    display:"flex",alignItems:"center",gap:6,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.55:1,
    padding:small?"5px 12px":"8px 16px",borderRadius:8,fontSize:small?12:13,fontWeight:500,
    width:full?"100%":undefined,justifyContent:full?"center":undefined,
    border:primary?"none":danger?"1px solid #FCA5A5":ghost?"none":"1px solid "+BORDER,
    background:primary?TEAL:danger?"#FEE2E2":ghost?"transparent":WHITE,
    color:primary?"#fff":danger?"#991B1B":TEXT,...s }}>{children}</button>;
}
function Input({ label,type="text",value,onChange,placeholder,required,disabled }) {
  return <div style={{ marginBottom:14 }}>
    {label && <label style={{ fontSize:12,fontWeight:600,color:TEXT,display:"block",marginBottom:5 }}>{label}{required&&<span style={{ color:"#EF4444" }}> *</span>}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} required={required}
      style={{ width:"100%",padding:"10px 14px",border:"1.5px solid "+BORDER,borderRadius:8,fontSize:14,
        color:TEXT,background:disabled?"#F8FAFC":WHITE,boxSizing:"border-box",outline:"none",
        transition:"border-color .2s" }}
      onFocus={e=>e.target.style.borderColor=TEAL}
      onBlur={e=>e.target.style.borderColor=BORDER} /></div>;
}
function Sel({ label,value,onChange,options,required }) {
  return <div style={{ marginBottom:14 }}>
    {label && <label style={{ fontSize:12,fontWeight:600,color:TEXT,display:"block",marginBottom:5 }}>{label}{required&&<span style={{ color:"#EF4444" }}> *</span>}</label>}
    <select value={value} onChange={onChange} style={{ width:"100%",padding:"10px 14px",border:"1.5px solid "+BORDER,
      borderRadius:8,fontSize:14,color:TEXT,background:WHITE,boxSizing:"border-box" }}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select></div>;
}
function Spinner({ dark }) {
  return <span style={{ display:"inline-block",width:16,height:16,
    border:"2px solid "+(dark?"#E2E8F0":"#ffffff44"),
    borderTop:"2px solid "+(dark?TEAL:"#fff"),
    borderRadius:"50%",animation:"spin .7s linear infinite" }}/>;
}
function Modal({ title,onClose,children,width=480 }) {
  return <div style={{ position:"fixed",inset:0,background:"#00000066",display:"flex",alignItems:"center",
    justifyContent:"center",zIndex:1000,padding:20 }}>
    <div style={{ background:WHITE,borderRadius:14,padding:28,width:"100%",maxWidth:width,
      maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px #0000002a" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
        <span style={{ fontSize:17,fontWeight:700,color:TEXT }}>{title}</span>
        <button onClick={onClose} style={{ border:"none",background:"none",fontSize:22,cursor:"pointer",color:MUTED,lineHeight:1 }}>x</button>
      </div>
      {children}
    </div></div>;
}
function KPI({ label,value,sub,icon,alert }) {
  return <div style={{ background:WHITE,border:"1px solid "+(alert?"#FCA5A5":BORDER),borderRadius:12,
    padding:"14px 18px",flex:1,minWidth:140 }}>
    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
      <span style={{ fontSize:12,color:MUTED,fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:18 }}>{icon}</span>
    </div>
    <div style={{ fontSize:26,fontWeight:800,color:alert?"#EF4444":TEXT,lineHeight:1 }}>{value}</div>
    {sub&&<div style={{ fontSize:12,color:MUTED,marginTop:3 }}>{sub}</div>}</div>;
}

/* ── LOGIN PAGE ─────────────────────────────────────────────── */
function LoginPage({ onLogin }) {
  const [mode,    setMode]    = useState("login"); // login | forgot | setpwd
  const [email,   setEmail]   = useState("");
  const [pwd,     setPwd]     = useState("");
  const [newPwd,  setNewPwd]  = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState({ type:"", text:"" });

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=invite") || hash.includes("type=recovery")) setMode("setpwd");
  }, []);

  const showErr = t => setMsg({ type:"error",   text:t });
  const showOk  = t => setMsg({ type:"success", text:t });

  const doLogin = async e => {
    e.preventDefault();
    if (!email||!pwd) return showErr("Email and password are required.");
    setLoading(true); setMsg({ type:"",text:"" });
    const { error } = await sb.auth.signInWithPassword({ email, password:pwd });
    setLoading(false);
    if (error) showErr(error.message);
  };

  const doForgot = async e => {
    e.preventDefault();
    if (!email) return showErr("Enter your work email.");
    setLoading(true);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    setLoading(false);
    if (error) showErr(error.message);
    else { showOk("Password reset email sent. Check your inbox."); setTimeout(()=>setMode("login"),3000); }
  };

  const doSetPwd = async e => {
    e.preventDefault();
    if (!newPwd||newPwd.length<8) return showErr("Password must be at least 8 characters.");
    if (newPwd!==confirm)         return showErr("Passwords do not match.");
    setLoading(true);
    const { error } = await sb.auth.updateUser({ password:newPwd });
    setLoading(false);
    if (error) showErr(error.message);
    else { showOk("Password set! Signing you in..."); window.location.hash=""; }
  };

  const features = ["Track team utilization weekly","Manage timesheets and approvals","Team-based resource planning","Leave management with workflows","Role-based access control"];

  return (
    <div style={{ display:"flex",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      {/* Left branding panel */}
      <div style={{ width:"45%",background:NAV,display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 52px",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:48 }}>
          <div style={{ width:44,height:44,borderRadius:12,background:TEAL,display:"flex",alignItems:"center",
            justifyContent:"center",fontWeight:900,fontSize:22,color:NAV }}>R</div>
          <div>
            <div style={{ fontSize:24,fontWeight:800,color:WHITE }}>ResTrack</div>
            <div style={{ fontSize:13,color:"#ffffff60" }}>Resource Management Platform</div>
          </div>
        </div>
        <h1 style={{ fontSize:34,fontWeight:800,color:WHITE,margin:"0 0 16px",lineHeight:1.2 }}>
          Manage your team<br/>with full visibility
        </h1>
        <p style={{ fontSize:15,color:"#ffffff80",margin:"0 0 40px",lineHeight:1.7 }}>
          One platform for timesheets, resource tracking, leave management and team collaboration.
        </p>
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          {features.map((f,i)=>(
            <div key={i} style={{ display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ width:22,height:22,borderRadius:"50%",background:TEAL+"33",display:"flex",
                alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <span style={{ color:TEAL,fontSize:12,fontWeight:700 }}>✓</span>
              </div>
              <span style={{ fontSize:14,color:"#ffffffcc" }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#F8FAFC",padding:40 }}>
        <div style={{ width:"100%",maxWidth:400 }}>
          {mode==="login" && (
            <>
              <h2 style={{ fontSize:26,fontWeight:800,color:TEXT,margin:"0 0 6px" }}>Welcome back</h2>
              <p style={{ fontSize:14,color:MUTED,margin:"0 0 32px" }}>Sign in to your ResTrack account</p>
              {msg.text && (
                <div style={{ padding:"10px 14px",borderRadius:8,marginBottom:16,fontSize:13,
                  background:msg.type==="error"?"#FEF2F2":"#F0FDF9",
                  color:msg.type==="error"?"#DC2626":"#065F46",
                  border:"1px solid "+(msg.type==="error"?"#FCA5A5":"#6EE7B7") }}>{msg.text}</div>
              )}
              <form onSubmit={doLogin}>
                <Input label="Work Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required />
                <Input label="Password"   type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Enter your password" required />
                <Btn primary full disabled={loading} style={{ marginTop:4,padding:"13px",fontSize:15 }}>
                  {loading?<><Spinner/>Signing in...</>:"Sign In"}
                </Btn>
              </form>
              <button onClick={()=>{setMode("forgot");setMsg({type:"",text:""}); }} style={{ marginTop:16,fontSize:13,color:MUTED,background:"none",border:"none",cursor:"pointer",display:"block",width:"100%",textAlign:"center" }}>
                Forgot your password?
              </button>
              <div style={{ marginTop:32,padding:"14px 16px",background:WHITE,borderRadius:10,border:"1px solid "+BORDER,fontSize:13,color:MUTED,textAlign:"center",lineHeight:1.6 }}>
                New to ResTrack? Check your email for an invite<br/>from your administrator.
              </div>
            </>
          )}

          {mode==="forgot" && (
            <>
              <button onClick={()=>setMode("login")} style={{ fontSize:13,color:MUTED,background:"none",border:"none",cursor:"pointer",marginBottom:24,display:"flex",alignItems:"center",gap:4 }}>← Back to sign in</button>
              <h2 style={{ fontSize:24,fontWeight:800,color:TEXT,margin:"0 0 6px" }}>Reset password</h2>
              <p style={{ fontSize:14,color:MUTED,margin:"0 0 28px" }}>Enter your work email and we will send a reset link.</p>
              {msg.text && <div style={{ padding:"10px 14px",borderRadius:8,marginBottom:16,fontSize:13,
                background:msg.type==="error"?"#FEF2F2":"#F0FDF9",color:msg.type==="error"?"#DC2626":"#065F46",
                border:"1px solid "+(msg.type==="error"?"#FCA5A5":"#6EE7B7") }}>{msg.text}</div>}
              <form onSubmit={doForgot}>
                <Input label="Work Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required />
                <Btn primary full disabled={loading}>
                  {loading?<><Spinner/>Sending...</>:"Send Reset Link"}
                </Btn>
              </form>
            </>
          )}

          {mode==="setpwd" && (
            <>
              <h2 style={{ fontSize:24,fontWeight:800,color:TEXT,margin:"0 0 6px" }}>Set your password</h2>
              <p style={{ fontSize:14,color:MUTED,margin:"0 0 28px" }}>Choose a secure password to complete your account setup.</p>
              {msg.text && <div style={{ padding:"10px 14px",borderRadius:8,marginBottom:16,fontSize:13,
                background:msg.type==="error"?"#FEF2F2":"#F0FDF9",color:msg.type==="error"?"#DC2626":"#065F46",
                border:"1px solid "+(msg.type==="error"?"#FCA5A5":"#6EE7B7") }}>{msg.text}</div>}
              <form onSubmit={doSetPwd}>
                <Input label="New Password" type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="At least 8 characters" required />
                <Input label="Confirm Password" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password" required />
                <Btn primary full disabled={loading}>
                  {loading?<><Spinner/>Setting password...</>:"Set Password & Sign In"}
                </Btn>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── DASHBOARD ──────────────────────────────────────────────── */
function Dashboard({ user, employees, projects, allocs, entries, leaves, teams, setView }) {
  const isAdmin   = user.role==="admin";
  const isManager = user.role==="manager";

  /* filter data by role */
  const visibleEmps = isAdmin ? employees
    : isManager ? employees.filter(e=>e.teamId===user.teamId||e.managerId===user.employeeId)
    : employees.filter(e=>e.id===user.employeeId);

  const week  = currentWeek();
  const stats = visibleEmps.filter(e=>e.active).map(e=>{
    const logged = entries.filter(en=>en.empId===e.id&&en.week===week).reduce((s,en)=>s+en.hours,0);
    const util   = e.capacity>0?Math.round((logged/e.capacity)*100):0;
    return { ...e,logged,util };
  });

  const avgUtil    = stats.length?Math.round(stats.reduce((s,e)=>s+e.util,0)/stats.length):0;
  const overloaded = stats.filter(e=>e.util>100).length;
  const pendingLeaves = leaves.filter(l=>l.status==="pending"&&
    (isAdmin||visibleEmps.find(e=>e.id===l.empId))).length;

  const weeklyData = ["W18","W19","W20","W21","W22","W23"].map(w=>{
    const wk  = "2026-"+w;
    const cap = visibleEmps.reduce((s,e)=>s+e.capacity,0);
    const log = entries.filter(en=>en.week===wk&&visibleEmps.find(e=>e.id===en.empId)).reduce((s,en)=>s+en.hours,0);
    return { week:w, util:cap>0?Math.round((log/cap)*100):0 };
  });

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px" }}>
          {isAdmin?"Company Overview":isManager?"My Team Overview":"My Dashboard"}
        </h1>
        <p style={{ color:MUTED,fontSize:13,margin:0 }}>Week {week} - Good to see you, {user.name?.split(" ")[0]}</p>
      </div>

      <div style={{ display:"flex",gap:10,marginBottom:16,flexWrap:"wrap" }}>
        <KPI label={isAdmin?"All Employees":isManager?"Team Members":"My Projects"}
          value={isAdmin||isManager?visibleEmps.length:projects.filter(p=>allocs.find(a=>a.empId===user.employeeId&&a.projId===p.id)).length}
          icon="👥" />
        <KPI label="Avg Utilization" value={avgUtil+"%"} sub="This week" icon="📊" alert={avgUtil<60} />
        <KPI label="Overloaded"      value={overloaded}  sub="Over capacity" icon="🔴" alert={overloaded>0} />
        <KPI label="Pending Leaves"  value={pendingLeaves} sub="Need approval" icon="📅" alert={pendingLeaves>0} />
        {isAdmin&&<KPI label="Active Projects" value={projects.filter(p=>p.status==="active").length} sub={projects.length+" total"} icon="📁" />}
        {isAdmin&&<KPI label="Teams"           value={teams.length} sub="Across company" icon="🏢" />}
      </div>

      {(overloaded>0) && (
        <div style={{ background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,padding:"12px 16px",marginBottom:16 }}>
          <div style={{ fontSize:13,fontWeight:700,color:"#92400E",marginBottom:6 }}>Action Required</div>
          {stats.filter(e=>e.util>100).map(e=>(
            <div key={e.id} style={{ fontSize:12,color:"#C2410C",marginBottom:3 }}>
              <strong>{e.name}</strong> is at {e.util}% utilization this week
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:14 }}>
        <Card>
          <SecHd title="Utilization Trend" />
          <ResponsiveContainer width="100%" height={185}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={TEAL} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={TEAL} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
              <XAxis dataKey="week" tick={{ fontSize:11,fill:"#94A3B8" }}/>
              <YAxis tick={{ fontSize:11,fill:"#94A3B8" }} domain={[0,100]} unit="%"/>
              <Tooltip formatter={v=>[v+"%","Utilization"]}/>
              <Area type="monotone" dataKey="util" stroke={TEAL} fill="url(#ug)" strokeWidth={2} dot={{ r:3,fill:TEAL }}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SecHd title="This Week" />
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {stats.slice(0,6).map(e=>{
              const { bg,fg }=utilColor(e.util);
              return (
                <div key={e.id} style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <Av name={e.name} color={e.color||TEAL} sz={26}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:500,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.name}</div>
                    <Prog val={e.util} h={4}/>
                  </div>
                  <span style={{ fontSize:11,fontWeight:700,background:bg,color:fg,borderRadius:6,padding:"2px 6px",whiteSpace:"nowrap" }}>{e.util}%</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {pendingLeaves>0 && (
        <Card style={{ border:"1px solid #FDE68A",background:"#FFFBEB" }}>
          <SecHd title={"Pending Leave Approvals ("+pendingLeaves+")"}
            action={<Btn small onClick={()=>setView("leaves")}>Review All</Btn>} />
          {leaves.filter(l=>l.status==="pending").slice(0,3).map(l=>{
            const emp=employees.find(e=>e.id===l.empId);
            return (
              <div key={l.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #FEF3C7" }}>
                <Av name={emp?.name||"?"} color={emp?.color||TEAL} sz={26}/>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:13,fontWeight:500 }}>{emp?.name}</span>
                  <span style={{ fontSize:12,color:MUTED }}> - {l.type} - {l.days} day{l.days>1?"s":""}</span>
                  <div style={{ fontSize:11,color:"#94A3B8" }}>{l.from} to {l.to}</div>
                </div>
                <Badge s="pending"/>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/* ── EMPLOYEES (Admin only) ─────────────────────────────────── */
function Employees({ user, employees, setEmployees, allocs, teams }) {
  const [showInvite,  setShowInvite]  = useState(false);
  const [showEdit,    setShowEdit]    = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [delTarget,   setDelTarget]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState("");
  const [ok,          setOk]          = useState("");
  const [search,      setSearch]      = useState("");
  const [filterDept,  setFilterDept]  = useState("");

  const blank = { name:"",email:"",role:"user",department:"",jobTitle:"",capacity:"40",teamId:"",phone:"" };
  const [form, setForm] = useState(blank);
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const depts = [...new Set(employees.map(e=>e.dept))].filter(Boolean);

  const filtered = employees.filter(e=>{
    const q=search.toLowerCase();
    return (!q||(e.name||"").toLowerCase().includes(q)||(e.email||"").toLowerCase().includes(q))
      && (!filterDept||e.dept===filterDept);
  });

  const sendInvite = async () => {
    if (!form.name||!form.email) { setErr("Name and email are required."); return; }
    setLoading(true); setErr(""); setOk("");
    try {
      const res = await fetch("/api/invite", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({
          name:form.name, email:form.email, role:form.role,
          department:form.department, jobTitle:form.jobTitle,
          capacity:+form.capacity||40, teamId:form.teamId||null, phone:form.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Invite failed");
      const newEmp = {
        id:data.employeeId||Date.now(), name:form.name, email:form.email,
        dept:form.department, role:form.jobTitle, capacity:+form.capacity||40,
        active:true, teamId:form.teamId||null,
        color:AVA_COLORS[employees.length%AVA_COLORS.length],
        init:form.name.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase(),
      };
      setEmployees(prev=>[...prev,newEmp]);
      setOk("Invite sent to "+form.email);
      setForm(blank);
      setShowInvite(false);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const { error } = await sb.from("employees").update({
      name:form.name, department:form.department, role:form.jobTitle,
      capacity:+form.capacity||40, active:form.active!=="false", phone:form.phone,
    }).eq("id",editTarget.id);
    if (error) { setErr(error.message); return; }
    setEmployees(prev=>prev.map(e=>e.id===editTarget.id?{...e,
      name:form.name,dept:form.department,role:form.jobTitle,
      capacity:+form.capacity||40,active:form.active!=="false",phone:form.phone,
    }:e));
    setShowEdit(false); setEditTarget(null); setOk("Employee updated.");
  };

  const toggleActive = async (emp) => {
    const { error } = await sb.from("employees").update({ active:!emp.active }).eq("id",emp.id);
    if (!error) setEmployees(prev=>prev.map(e=>e.id===emp.id?{...e,active:!e.active}:e));
  };

  const deleteEmp = async (emp) => {
    const { error } = await sb.from("employees").delete().eq("id",emp.id);
    if (!error) { setEmployees(prev=>prev.filter(e=>e.id!==emp.id)); setDelTarget(null); }
    else setErr(error.message);
  };

  const openEdit = emp => {
    setForm({ name:emp.name,email:emp.email,role:emp.appRole||"user",department:emp.dept,
      jobTitle:emp.role,capacity:String(emp.capacity),teamId:emp.teamId||"",
      phone:emp.phone||"",active:String(emp.active) });
    setEditTarget(emp); setShowEdit(true);
  };

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px" }}>Employees</h1>
          <p style={{ color:MUTED,fontSize:13,margin:0 }}>{employees.filter(e=>e.active).length} active / {employees.length} total</p>
        </div>
        <Btn primary onClick={()=>{setForm(blank);setErr("");setOk("");setShowInvite(true);}}>+ Invite Employee</Btn>
      </div>

      {ok && <div style={{ padding:"10px 14px",background:"#F0FDF9",border:"1px solid #6EE7B7",borderRadius:8,fontSize:13,color:"#065F46",marginBottom:14 }}>{ok}</div>}

      {/* Search + filter */}
      <div style={{ display:"flex",gap:10,marginBottom:14 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employees..."
          style={{ flex:1,padding:"8px 14px",border:"1px solid "+BORDER,borderRadius:8,fontSize:13 }}/>
        <select value={filterDept} onChange={e=>setFilterDept(e.target.value)}
          style={{ padding:"8px 14px",border:"1px solid "+BORDER,borderRadius:8,fontSize:13,minWidth:160 }}>
          <option value="">All Departments</option>
          {depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <Card style={{ padding:0,overflow:"hidden" }}>
        <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["Employee","Department","Job Title","Capacity","Team","Role","Status","Actions"].map(h=>(
                <th key={h} style={{ padding:"10px 14px",textAlign:"left",fontWeight:600,color:MUTED,borderBottom:"1px solid "+BORDER }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e=>{
              const team=teams.find(t=>t.id===e.teamId);
              return (
                <tr key={e.id} style={{ borderBottom:"1px solid #F1F5F9",opacity:e.active?1:0.55 }}>
                  <td style={{ padding:"10px 14px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <Av name={e.name} color={e.color||TEAL} sz={32}/>
                      <div>
                        <div style={{ fontWeight:600,color:TEXT }}>{e.name}</div>
                        <div style={{ fontSize:11,color:MUTED }}>{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"10px 14px" }}>
                    <span style={{ background:(e.color||TEAL)+"22",color:e.color||TEAL,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600 }}>{e.dept||"-"}</span>
                  </td>
                  <td style={{ padding:"10px 14px",color:MUTED }}>{e.role||"-"}</td>
                  <td style={{ padding:"10px 14px",fontWeight:600 }}>{e.capacity}h/wk</td>
                  <td style={{ padding:"10px 14px",color:MUTED }}>{team?.name||"-"}</td>
                  <td style={{ padding:"10px 14px" }}><RoleBadge role={e.appRole||"user"}/></td>
                  <td style={{ padding:"10px 14px" }}><Badge s={e.active?"active":"inactive"}/></td>
                  <td style={{ padding:"10px 14px" }}>
                    <div style={{ display:"flex",gap:6 }}>
                      <Btn small onClick={()=>openEdit(e)}>Edit</Btn>
                      <Btn small onClick={()=>toggleActive(e)} style={{ background:e.active?"#FEF3C7":"#F0FDF9",color:e.active?"#92400E":"#065F46",border:"none" }}>
                        {e.active?"Deactivate":"Activate"}
                      </Btn>
                      <Btn small danger onClick={()=>setDelTarget(e)}>Delete</Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length===0&&(
              <tr><td colSpan={8} style={{ padding:"32px",textAlign:"center",color:MUTED }}>No employees found.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Invite modal */}
      {showInvite && (
        <Modal title="Invite New Employee" onClose={()=>setShowInvite(false)} width={540}>
          {err&&<div style={{ padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:8,fontSize:13,color:"#DC2626",marginBottom:14 }}>{err}</div>}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:0 }}>
            <div style={{ paddingRight:12 }}>
              <Input label="Full Name"    value={form.name}       onChange={f("name")}       required placeholder="John Smith"/>
              <Input label="Work Email"   type="email" value={form.email} onChange={f("email")} required placeholder="john@company.com"/>
              <Input label="Phone"        value={form.phone}      onChange={f("phone")}      placeholder="+1 555 000 0000"/>
              <Input label="Weekly Capacity (hours)" type="number" value={form.capacity} onChange={f("capacity")} placeholder="40"/>
            </div>
            <div style={{ paddingLeft:12 }}>
              <Input label="Department"   value={form.department} onChange={f("department")} placeholder="Engineering"/>
              <Input label="Job Title"    value={form.jobTitle}   onChange={f("jobTitle")}   placeholder="Senior Developer"/>
              <Sel label="Role" value={form.role} onChange={f("role")} options={[
                {value:"user",label:"User"},
                {value:"manager",label:"Manager"},
                {value:"admin",label:"Admin"},
              ]}/>
              <Sel label="Assign to Team" value={form.teamId} onChange={f("teamId")} options={[
                {value:"",label:"No team yet"},
                ...teams.map(t=>({value:t.id,label:t.name})),
              ]}/>
            </div>
          </div>
          <div style={{ display:"flex",gap:10,marginTop:8,paddingTop:16,borderTop:"1px solid "+BORDER }}>
            <Btn primary full disabled={loading} onClick={sendInvite}>
              {loading?<><Spinner/>Sending invite...</>:"Send Invite Email"}
            </Btn>
            <Btn full onClick={()=>setShowInvite(false)}>Cancel</Btn>
          </div>
          <div style={{ marginTop:14,fontSize:12,color:MUTED,background:"#F8FAFC",borderRadius:8,padding:"10px 12px" }}>
            An email will be sent to the employee with a link to set their password and access ResTrack.
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {showEdit && editTarget && (
        <Modal title={"Edit - "+editTarget.name} onClose={()=>{setShowEdit(false);setEditTarget(null);}}>
          {err&&<div style={{ padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:8,fontSize:13,color:"#DC2626",marginBottom:14 }}>{err}</div>}
          <Input label="Full Name"   value={form.name}       onChange={f("name")}       required/>
          <Input label="Department"  value={form.department} onChange={f("department")} />
          <Input label="Job Title"   value={form.jobTitle}   onChange={f("jobTitle")}   />
          <Input label="Phone"       value={form.phone}      onChange={f("phone")}      />
          <Input label="Weekly Capacity" type="number" value={form.capacity} onChange={f("capacity")}/>
          <Sel label="Status" value={form.active} onChange={f("active")} options={[{value:"true",label:"Active"},{value:"false",label:"Inactive"}]}/>
          <div style={{ display:"flex",gap:10,marginTop:8 }}>
            <Btn primary full onClick={saveEdit}>Save Changes</Btn>
            <Btn full onClick={()=>{setShowEdit(false);setEditTarget(null);}}>Cancel</Btn>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <Modal title="Delete Employee" onClose={()=>setDelTarget(null)} width={400}>
          <p style={{ fontSize:14,color:TEXT,marginBottom:20 }}>
            Are you sure you want to permanently delete <strong>{delTarget.name}</strong>? This cannot be undone.
          </p>
          <div style={{ display:"flex",gap:10 }}>
            <Btn danger full onClick={()=>deleteEmp(delTarget)}>Yes, Delete</Btn>
            <Btn full onClick={()=>setDelTarget(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── TEAMS ──────────────────────────────────────────────────── */
function Teams({ user, teams, setTeams, employees, setEmployees }) {
  const isAdmin   = user.role==="admin";
  const [showNew, setShowNew] = useState(false);
  const [selTeam, setSelTeam] = useState(null);
  const [form,    setForm]    = useState({ name:"",description:"",managerId:"",color:TEAL });
  const [loading, setLoading] = useState(false);

  const visibleTeams = isAdmin ? teams : teams.filter(t=>t.managerId===user.employeeId);

  const createTeam = async () => {
    if (!form.name) return;
    setLoading(true);
    const { data,error } = await sb.from("teams").insert({
      name:form.name, description:form.description,
      manager_id:form.managerId||null, color:form.color,
    }).select().single();
    setLoading(false);
    if (error) { alert(error.message); return; }
    const newTeam = { id:data.id,name:data.name,description:data.description,
      managerId:data.manager_id,color:data.color,members:[] };
    setTeams(prev=>[...prev,newTeam]);
    setForm({ name:"",description:"",managerId:"",color:TEAL });
    setShowNew(false);
  };

  const addMember = async (teamId, empId) => {
    const { error } = await sb.from("team_members")
      .upsert({ team_id:teamId,employee_id:empId },{ onConflict:"team_id,employee_id" });
    if (!error) {
      setTeams(prev=>prev.map(t=>t.id===teamId?{...t,members:[...t.members,empId]}:t));
      setEmployees(prev=>prev.map(e=>e.id===empId?{...e,teamId}:e));
    }
  };

  const removeMember = async (teamId, empId) => {
    const { error } = await sb.from("team_members")
      .delete().eq("team_id",teamId).eq("employee_id",empId);
    if (!error) setTeams(prev=>prev.map(t=>t.id===teamId?{...t,members:t.members.filter(m=>m!==empId)}:t));
  };

  const TEAM_COLORS = [TEAL,"#8B5CF6","#3B82F6","#F59E0B","#EF4444","#10B981","#EC4899"];

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px" }}>Teams</h1>
          <p style={{ color:MUTED,fontSize:13,margin:0 }}>{visibleTeams.length} teams</p>
        </div>
        {isAdmin&&<Btn primary onClick={()=>setShowNew(v=>!v)}>+ Create Team</Btn>}
      </div>

      {showNew && (
        <Card style={{ marginBottom:14,border:"1px solid #06D6A033",background:"#F0FDF9" }}>
          <div style={{ fontSize:14,fontWeight:700,marginBottom:14 }}>New Team</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:0 }}>
            <div style={{ paddingRight:12 }}>
              <Input label="Team Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Frontend Squad" required/>
              <Input label="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Optional"/>
            </div>
            <div style={{ paddingLeft:12 }}>
              <Sel label="Team Manager" value={form.managerId} onChange={e=>setForm(f=>({...f,managerId:e.target.value}))} options={[
                {value:"",label:"No manager yet"},
                ...employees.filter(e=>e.active).map(e=>({value:e.id,label:e.name}))
              ]}/>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12,fontWeight:600,color:TEXT,display:"block",marginBottom:8 }}>Team Color</label>
                <div style={{ display:"flex",gap:8 }}>
                  {TEAM_COLORS.map(c=>(
                    <div key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                      style={{ width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",
                        border:form.color===c?"3px solid "+TEXT:"3px solid transparent",transition:"border .15s" }}/>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <Btn primary small disabled={loading} onClick={createTeam}>{loading?<Spinner/>:"Create Team"}</Btn>
            <Btn small onClick={()=>setShowNew(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12 }}>
        {visibleTeams.map(t=>{
          const members  = employees.filter(e=>t.members?.includes(e.id));
          const manager  = employees.find(e=>e.id===t.managerId);
          const isOpen   = selTeam===t.id;
          const unassigned = employees.filter(e=>e.active&&!t.members?.includes(e.id));
          return (
            <Card key={t.id} style={{ border:"1px solid "+BORDER }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                <div style={{ width:40,height:40,borderRadius:10,background:t.color+"22",display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:18 }}>🏢</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15,fontWeight:700,color:TEXT }}>{t.name}</div>
                  {t.description&&<div style={{ fontSize:12,color:MUTED }}>{t.description}</div>}
                </div>
                <button onClick={()=>setSelTeam(isOpen?null:t.id)}
                  style={{ background:"none",border:"none",cursor:"pointer",fontSize:13,color:MUTED }}>
                  {isOpen?"▲":"▼"}
                </button>
              </div>

              {manager&&(
                <div style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#F8FAFC",borderRadius:8,marginBottom:10 }}>
                  <Av name={manager.name} color={manager.color||TEAL} sz={24}/>
                  <div>
                    <div style={{ fontSize:12,fontWeight:600,color:TEXT }}>{manager.name}</div>
                    <div style={{ fontSize:11,color:MUTED }}>Team Manager</div>
                  </div>
                </div>
              )}

              <div style={{ display:"flex",gap:-6,marginBottom:6 }}>
                {members.slice(0,6).map(m=><Av key={m.id} name={m.name} color={m.color||TEAL} sz={28}/>)}
                {members.length>6&&<div style={{ width:28,height:28,borderRadius:"50%",background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:MUTED }}>+{members.length-6}</div>}
              </div>
              <div style={{ fontSize:12,color:MUTED }}>{members.length} member{members.length!==1?"s":""}</div>

              {isOpen&&isAdmin&&(
                <div style={{ marginTop:14,borderTop:"1px solid "+BORDER,paddingTop:14 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5 }}>Members</div>
                  {members.map(m=>(
                    <div key={m.id} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:7 }}>
                      <Av name={m.name} color={m.color||TEAL} sz={24}/>
                      <span style={{ flex:1,fontSize:13,fontWeight:500 }}>{m.name}</span>
                      <button onClick={()=>removeMember(t.id,m.id)}
                        style={{ border:"none",background:"#FEE2E2",color:"#991B1B",borderRadius:6,
                          padding:"3px 8px",fontSize:11,cursor:"pointer",fontWeight:600 }}>Remove</button>
                    </div>
                  ))}
                  {unassigned.length>0&&(
                    <div style={{ marginTop:10 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6 }}>Add Member</div>
                      <select defaultValue="" onChange={e=>{if(e.target.value)addMember(t.id,e.target.value);}}
                        style={{ width:"100%",padding:"7px 10px",border:"1px solid "+BORDER,borderRadius:6,fontSize:13 }}>
                        <option value="">Select employee to add...</option>
                        {unassigned.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {visibleTeams.length===0&&(
          <div style={{ gridColumn:"1/-1",textAlign:"center",padding:"60px 0",color:MUTED,fontSize:14 }}>
            {isAdmin?"No teams yet. Create your first team above.":"You are not managing any teams yet."}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── PROFILE ────────────────────────────────────────────────── */
function Profile({ user, setUser }) {
  const [form,    setForm]    = useState({ name:user.name||"",phone:user.phone||"" });
  const [pwdForm, setPwdForm] = useState({ current:"",newpwd:"",confirm:"" });
  const [saving,  setSaving]  = useState(false);
  const [pwdSaving,setPwdSaving]=useState(false);
  const [msg,     setMsg]     = useState({ type:"",text:"" });
  const [pwdMsg,  setPwdMsg]  = useState({ type:"",text:"" });

  const saveProfile = async () => {
    setSaving(true); setMsg({ type:"",text:"" });
    const { error } = await sb.from("app_users").update({ name:form.name,phone:form.phone }).eq("id",user.id);
    setSaving(false);
    if (error) setMsg({ type:"error",text:error.message });
    else { setUser(u=>({...u,name:form.name,phone:form.phone})); setMsg({ type:"ok",text:"Profile updated." }); }
  };

  const changePwd = async () => {
    if (!pwdForm.newpwd||pwdForm.newpwd.length<8) { setPwdMsg({ type:"error",text:"Password must be at least 8 characters." }); return; }
    if (pwdForm.newpwd!==pwdForm.confirm)          { setPwdMsg({ type:"error",text:"Passwords do not match." }); return; }
    setPwdSaving(true); setPwdMsg({ type:"",text:"" });
    const { error } = await sb.auth.updateUser({ password:pwdForm.newpwd });
    setPwdSaving(false);
    if (error) setPwdMsg({ type:"error",text:error.message });
    else { setPwdMsg({ type:"ok",text:"Password changed successfully." }); setPwdForm({ current:"",newpwd:"",confirm:"" }); }
  };

  const msgBox = (m) => m.text?(
    <div style={{ padding:"10px 14px",borderRadius:8,marginBottom:14,fontSize:13,
      background:m.type==="error"?"#FEF2F2":"#F0FDF9",
      color:m.type==="error"?"#DC2626":"#065F46",
      border:"1px solid "+(m.type==="error"?"#FCA5A5":"#6EE7B7") }}>{m.text}</div>
  ):null;

  return (
    <div style={{ maxWidth:700 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px" }}>My Profile</h1>
        <p style={{ color:MUTED,fontSize:13,margin:0 }}>Manage your personal information and account settings</p>
      </div>

      <Card style={{ marginBottom:16 }}>
        <div style={{ display:"flex",alignItems:"center",gap:16,marginBottom:24,padding:"16px",background:"#F8FAFC",borderRadius:10 }}>
          <div style={{ width:64,height:64,borderRadius:"50%",background:(user.avatarColor||TEAL)+"22",
            color:user.avatarColor||TEAL,fontWeight:800,fontSize:24,display:"flex",alignItems:"center",
            justifyContent:"center",border:"2px solid "+(user.avatarColor||TEAL)+"44" }}>
            {(user.name||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:18,fontWeight:700,color:TEXT }}>{user.name}</div>
            <div style={{ fontSize:13,color:MUTED }}>{user.email}</div>
            <div style={{ marginTop:6,display:"flex",gap:8 }}>
              <RoleBadge role={user.role}/>
            </div>
          </div>
        </div>

        <div style={{ fontSize:15,fontWeight:700,marginBottom:16 }}>Personal Information</div>
        {msgBox(msg)}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
          <Input label="Full Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
          <Input label="Phone" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+1 555 000 0000"/>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
          <Input label="Email" value={user.email||""} disabled/>
          <Input label="Role" value={user.role||""} disabled/>
        </div>
        <Btn primary disabled={saving} onClick={saveProfile}>
          {saving?<><Spinner/>Saving...</>:"Save Changes"}
        </Btn>
      </Card>

      <Card>
        <div style={{ fontSize:15,fontWeight:700,marginBottom:16 }}>Change Password</div>
        {msgBox(pwdMsg)}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
          <Input label="New Password" type="password" value={pwdForm.newpwd}
            onChange={e=>setPwdForm(f=>({...f,newpwd:e.target.value}))} placeholder="At least 8 characters"/>
          <Input label="Confirm Password" type="password" value={pwdForm.confirm}
            onChange={e=>setPwdForm(f=>({...f,confirm:e.target.value}))} placeholder="Repeat new password"/>
        </div>
        <Btn primary disabled={pwdSaving} onClick={changePwd}>
          {pwdSaving?<><Spinner/>Updating...</>:"Update Password"}
        </Btn>
      </Card>
    </div>
  );
}

/* ── LEAVES ─────────────────────────────────────────────────── */
function Leaves({ user, employees, leaves, setLeaves }) {
  const isAdmin   = user.role==="admin";
  const isManager = user.role==="manager";
  const [form,    setForm]   = useState({ empId:user.employeeId||"",type:"Annual",from:"",to:"",reason:"" });
  const [saving,  setSaving] = useState(false);

  const canApprove = isAdmin||isManager;

  const visibleLeaves = isAdmin ? leaves
    : isManager ? leaves.filter(l=>employees.find(e=>e.id===l.empId&&(e.teamId===user.teamId||e.managerId===user.employeeId))||l.empId===user.employeeId)
    : leaves.filter(l=>l.empId===user.employeeId);

  const apply = async () => {
    if (!form.from||!form.to||!form.empId) return;
    const days=Math.max(1,Math.ceil((new Date(form.to)-new Date(form.from))/864e5)+1);
    setSaving(true);
    const { data,error } = await sb.from("leaves").insert({
      employee_id:form.empId,type:form.type,from_date:form.from,
      to_date:form.to,days,reason:form.reason,status:"pending",
    }).select().single();
    setSaving(false);
    if (!error&&data) {
      setLeaves(prev=>[{ id:data.id,empId:data.employee_id,type:data.type,from:data.from_date,
        to:data.to_date,days:data.days,status:data.status,reason:data.reason },...prev]);
      setForm(f=>({...f,from:"",to:"",reason:""}));
    }
  };

  const updateStatus = async (id,status) => {
    const { error } = await sb.from("leaves").update({ status }).eq("id",id);
    if (!error) setLeaves(prev=>prev.map(l=>l.id===id?{...l,status}:l));
  };

  const pending = visibleLeaves.filter(l=>l.status==="pending");
  const hist    = visibleLeaves.filter(l=>l.status!=="pending");

  return (
    <div>
      <div style={{ marginBottom:18 }}>
        <h1 style={{ fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px" }}>Leave Management</h1>
        <p style={{ color:MUTED,fontSize:13,margin:0 }}>Submit and track leave requests</p>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"320px 1fr",gap:14 }}>
        <Card style={{ height:"fit-content" }}>
          <div style={{ fontSize:14,fontWeight:700,marginBottom:14 }}>Apply for Leave</div>
          {(isAdmin||isManager)&&(
            <Sel label="Employee" value={form.empId} onChange={e=>setForm(f=>({...f,empId:e.target.value}))} options={[
              {value:"",label:"Select employee..."},
              ...employees.filter(e=>e.active).map(e=>({value:e.id,label:e.name}))
            ]}/>
          )}
          <Sel label="Leave Type" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} options={
            ["Annual","Sick","Casual","Maternity","Paternity"].map(t=>({value:t,label:t}))
          }/>
          <Input label="From" type="date" value={form.from} onChange={e=>setForm(f=>({...f,from:e.target.value}))} required/>
          <Input label="To"   type="date" value={form.to}   onChange={e=>setForm(f=>({...f,to:e.target.value}))}   required/>
          <Input label="Reason" value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Optional"/>
          <Btn primary full disabled={saving} onClick={apply}>
            {saving?<><Spinner/>Submitting...</>:"Submit Request"}
          </Btn>
        </Card>
        <div>
          {canApprove&&pending.length>0&&(
            <Card style={{ marginBottom:14,border:"1px solid #FDE68A" }}>
              <SecHd title={"Pending Approvals ("+pending.length+")"}/>
              {pending.map(l=>{
                const e=employees.find(em=>em.id===l.empId);
                return (
                  <div key={l.id} style={{ display:"flex",alignItems:"center",gap:10,padding:12,
                    background:"#FFFBEB",borderRadius:8,border:"1px solid #FDE68A",marginBottom:8 }}>
                    <Av name={e?.name||"?"} color={e?.color||TEAL} sz={30}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:600 }}>{e?.name}</div>
                      <div style={{ fontSize:12,color:MUTED }}>{l.type} - {l.from} to {l.to} - {l.days} day{l.days>1?"s":""}</div>
                      {l.reason&&<div style={{ fontSize:12,color:"#94A3B8" }}>{l.reason}</div>}
                    </div>
                    <div style={{ display:"flex",gap:6 }}>
                      <Btn small onClick={()=>updateStatus(l.id,"approved")} style={{ background:"#D1FAE5",color:"#065F46",border:"none" }}>Approve</Btn>
                      <Btn small danger onClick={()=>updateStatus(l.id,"rejected")}>Reject</Btn>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
          <Card>
            <SecHd title={canApprove?"All Leave History":"My Leave History"}/>
            {hist.length===0&&<div style={{ color:"#94A3B8",fontSize:13,textAlign:"center",padding:"24px 0" }}>No leave history yet.</div>}
            {hist.map(l=>{
              const e=employees.find(em=>em.id===l.empId);
              return (
                <div key={l.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                  background:"#F8FAFC",borderRadius:8,marginBottom:7,border:"1px solid "+BORDER }}>
                  <Av name={e?.name||"?"} color={e?.color||TEAL} sz={26}/>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:13,fontWeight:500 }}>{e?.name}</span>
                    <span style={{ fontSize:12,color:MUTED }}> - {l.type} Leave</span>
                    <div style={{ fontSize:12,color:"#94A3B8" }}>{l.from} to {l.to} - {l.days} day{l.days>1?"s":""}</div>
                  </div>
                  <Badge s={l.status}/>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── HELPERS ────────────────────────────────────────────────── */
function currentWeek() {
  const now=new Date();
  const jan1=new Date(now.getFullYear(),0,1);
  const wk=Math.ceil(((now-jan1)/864e5+jan1.getDay()+1)/7);
  return now.getFullYear()+"-W"+String(wk).padStart(2,"0");
}

const DEPT_COLORS={ Engineering:"#3B82F6",Design:"#8B5CF6",Product:"#F59E0B",QA:"#10B981",HR:"#EC4899",Finance:"#F97316",Marketing:"#06D6A0" };
const deptColor=d=>DEPT_COLORS[d]||"#64748B";

const toEmp=r=>({
  id:r.id,name:r.name||"",email:r.email||"",dept:r.department||"",
  role:r.role||"",capacity:r.capacity||40,active:r.active!==false,
  teamId:r.team_id||null,managerId:r.manager_id||null,phone:r.phone||"",
  appRole:"user",color:deptColor(r.department),
  init:(r.name||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase(),
});
const toLeave=r=>({ id:r.id,empId:r.employee_id,type:r.type,from:r.from_date,
  to:r.to_date,days:r.days,status:r.status,reason:r.reason||"" });
const toAlloc=r=>({ id:r.id,empId:r.employee_id,projId:r.project_id,hoursPerWeek:r.hours_per_week });
const toEntry=r=>({ id:r.id,empId:r.employee_id,projId:r.project_id,week:r.week,hours:Number(r.hours),note:r.note||"" });
const toTeam=r=>({ id:r.id,name:r.name,description:r.description||"",managerId:r.manager_id||null,color:r.color||TEAL,members:[] });

/* ── ROOT APP ───────────────────────────────────────────────── */
export default function App() {
  const [session,   setSession]   = useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [user,      setUser]      = useState(null);
  const [view,      setView]      = useState("dashboard");
  const [dataLoading,setDataLoading]=useState(false);
  const [employees, setEmployees] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [allocs,    setAllocs]    = useState([]);
  const [entries,   setEntries]   = useState([]);
  const [leaves,    setLeaves]    = useState([]);
  const [teams,     setTeams]     = useState([]);
  const [notifCount,setNotifCount]= useState(0);

  /* Auth listener */
  useEffect(()=>{
    sb.auth.getSession().then(({ data:{ session:s } })=>{
      setSession(s); setAuthLoading(false);
    });
    const { data:{ subscription } } = sb.auth.onAuthStateChange((_event,s)=>{
      setSession(s);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  /* Load user profile + data when session changes */
  useEffect(()=>{
    if (!session) { setUser(null); return; }
    loadUserAndData(session.user);
  },[session]);

  async function loadUserAndData(authUser) {
    setDataLoading(true);
    /* Load profile */
    const { data:profile } = await sb.from("app_users").select("*").eq("id",authUser.id).single();
    const userObj = {
      id:        authUser.id,
      email:     authUser.email,
      name:      profile?.name || authUser.user_metadata?.name || authUser.email?.split("@")[0] || "User",
      role:      profile?.role || authUser.user_metadata?.role || "user",
      teamId:    profile?.team_id || null,
      employeeId:profile?.employee_id || null,
      avatarColor:profile?.avatar_color || TEAL,
      phone:     profile?.phone || "",
    };
    setUser(userObj);

    /* Load data based on role */
    const isAdmin   = userObj.role==="admin";
    const isManager = userObj.role==="manager";

    const [empRes,projRes,allocRes,entryRes,leaveRes,teamRes,memberRes] = await Promise.all([
      sb.from("employees").select("*").order("name"),
      sb.from("projects").select("*").order("name"),
      sb.from("allocations").select("*"),
      sb.from("time_entries").select("*"),
      sb.from("leaves").select("*").order("created_at",{ ascending:false }),
      sb.from("teams").select("*").order("name"),
      sb.from("team_members").select("*"),
    ]);

    const allEmps   = (empRes.data||[]).map(toEmp);
    const allLeaves = (leaveRes.data||[]).map(toLeave);
    const allTeams  = (teamRes.data||[]).map(toTeam);
    const members   = memberRes.data||[];

    /* Attach members to teams */
    allTeams.forEach(t=>{ t.members=members.filter(m=>m.team_id===t.id).map(m=>m.employee_id); });

    /* Attach app role to employees by cross-referencing app_users */
    const { data:appUsers } = await sb.from("app_users").select("id,role,employee_id");
    allEmps.forEach(e=>{
      const au=appUsers?.find(u=>u.employee_id===e.id);
      if (au) e.appRole=au.role;
    });

    /* Role-filter */
    let visEmps = allEmps;
    if (!isAdmin&&!isManager) visEmps=allEmps.filter(e=>e.id===userObj.employeeId);

    const visEntries = isAdmin ? (entryRes.data||[]).map(toEntry)
      : (entryRes.data||[]).map(toEntry).filter(e=>visEmps.find(em=>em.id===e.empId));

    const visLeaves  = isAdmin ? allLeaves
      : allLeaves.filter(l=>visEmps.find(e=>e.id===l.empId));

    setEmployees(visEmps);
    setProjects((projRes.data||[]).map(p=>({ id:p.id,name:p.name,client:p.client||"",
      status:p.status||"planning",start:p.start_date||"",end:p.end_date||"",budgetHours:p.budget_hours||0 })));
    setAllocs((allocRes.data||[]).map(toAlloc));
    setEntries(visEntries);
    setLeaves(visLeaves);
    setTeams(allTeams);

    /* Notification count */
    const { count } = await sb.from("notifications").select("id",{ count:"exact",head:true })
      .eq("user_id",authUser.id).eq("read",false);
    setNotifCount(count||0);

    setDataLoading(false);
  }

  const logout = async () => {
    await sb.auth.signOut();
    setSession(null); setUser(null);
  };

  /* Nav by role */
  const isAdmin   = user?.role==="admin";
  const isManager = user?.role==="manager";

  const nav = [
    { id:"dashboard", label:"Dashboard",  icon:"📊" },
    ...(isAdmin||isManager?[{ id:"teams",     label:"Teams",      icon:"🏢" }]:[]),
    ...(isAdmin           ?[{ id:"employees", label:"Employees",  icon:"👥" }]:[]),
    { id:"leaves",    label:"Leaves",     icon:"📅", badge:isAdmin||isManager?leaves.filter(l=>l.status==="pending").length:0 },
    { id:"timesheets",label:"Timesheets", icon:"⏱️" },
    { id:"profile",   label:"My Profile", icon:"👤" },
  ];

  /* Loading states */
  if (authLoading) return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:BG,flexDirection:"column",gap:12,fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <Spinner dark/><div style={{ fontSize:14,color:MUTED }}>Loading...</div>
    </div>
  );

  if (!session || !user) return (
    <>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <LoginPage onLogin={()=>{}} />
    </>
  );

  if (dataLoading) return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:BG,flexDirection:"column",gap:12,fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <Spinner dark/><div style={{ fontSize:14,color:MUTED }}>Loading your data...</div>
    </div>
  );

  return (
    <>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{ display:"flex",fontFamily:"'Segoe UI',system-ui,sans-serif",background:BG,minHeight:"100vh" }}>

        {/* Sidebar */}
        <aside style={{ width:230,background:NAV,position:"sticky",top:0,height:"100vh",
          display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto" }}>
          <div style={{ padding:"18px 16px 14px",borderBottom:"1px solid #ffffff14" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:32,height:32,borderRadius:9,background:TEAL,display:"flex",alignItems:"center",
                justifyContent:"center",color:NAV,fontWeight:900,fontSize:16 }}>R</div>
              <div>
                <div style={{ color:"#fff",fontWeight:800,fontSize:16 }}>ResTrack</div>
                <div style={{ fontSize:10,color:"#ffffff50" }}>Resource Management</div>
              </div>
            </div>
          </div>

          {/* User pill */}
          <div style={{ padding:"12px 16px",borderBottom:"1px solid #ffffff14" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",
              background:"#ffffff0e",borderRadius:10 }}>
              <div style={{ width:32,height:32,borderRadius:"50%",background:(user.avatarColor||TEAL)+"33",
                color:user.avatarColor||TEAL,fontWeight:700,fontSize:12,display:"flex",alignItems:"center",
                justifyContent:"center",flexShrink:0,border:"1.5px solid "+(user.avatarColor||TEAL)+"44" }}>
                {(user.name||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:12,color:"#fff",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.name}</div>
                <div style={{ fontSize:10,color:"#ffffff50",textTransform:"capitalize" }}>{user.role}</div>
              </div>
            </div>
          </div>

          <nav style={{ flex:1,padding:"10px 8px" }}>
            {nav.map(item=>(
              <button key={item.id} onClick={()=>setView(item.id)} style={{
                display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 10px",
                borderRadius:9,border:"none",cursor:"pointer",
                background:view===item.id?"#ffffff18":"transparent",
                color:view===item.id?"#fff":"#ffffff60",
                fontSize:13,fontWeight:view===item.id?600:400,marginBottom:2,
                transition:"all .15s",textAlign:"left",
                borderLeft:view===item.id?"2.5px solid "+TEAL:"2.5px solid transparent" }}>
                <span style={{ fontSize:16 }}>{item.icon}</span>
                <span style={{ flex:1 }}>{item.label}</span>
                {item.badge>0&&<span style={{ background:"#EF4444",color:"#fff",borderRadius:999,
                  padding:"1px 6px",fontSize:10,fontWeight:700 }}>{item.badge}</span>}
              </button>
            ))}
          </nav>

          <div style={{ padding:"12px 16px",borderTop:"1px solid #ffffff14" }}>
            <button onClick={logout} style={{ display:"flex",alignItems:"center",gap:8,width:"100%",
              padding:"8px 10px",borderRadius:9,border:"none",cursor:"pointer",
              background:"transparent",color:"#ffffff50",fontSize:13,textAlign:"left",
              transition:"all .15s" }}
              onMouseEnter={e=>e.currentTarget.style.color="#fff"}
              onMouseLeave={e=>e.currentTarget.style.color="#ffffff50"}>
              <span style={{ fontSize:16 }}>🚪</span>Sign Out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex:1,padding:28,overflowX:"hidden",maxWidth:"calc(100vw - 230px)" }}>
          {view==="dashboard"  && <Dashboard  user={user} employees={employees} projects={projects} allocs={allocs} entries={entries} leaves={leaves} teams={teams} setView={setView}/>}
          {view==="employees"  && <Employees  user={user} employees={employees} setEmployees={setEmployees} allocs={allocs} teams={teams}/>}
          {view==="teams"      && <Teams      user={user} teams={teams} setTeams={setTeams} employees={employees} setEmployees={setEmployees}/>}
          {view==="leaves"     && <Leaves     user={user} employees={employees} leaves={leaves} setLeaves={setLeaves}/>}
          {view==="timesheets" && (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:80 }}>
              <div style={{ fontSize:48,marginBottom:16 }}>⏱️</div>
              <h2 style={{ fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 8px" }}>Timesheets</h2>
              <p style={{ fontSize:14,color:MUTED,textAlign:"center",maxWidth:380 }}>
                Full timesheet workflow with submission and approval is coming in Phase 2. Stay tuned!
              </p>
              <span style={{ background:"#DBEAFE",color:"#1E40AF",borderRadius:999,padding:"6px 18px",fontSize:13,fontWeight:600,marginTop:16 }}>Phase 2</span>
            </div>
          )}
          {view==="profile"    && <Profile    user={user} setUser={setUser}/>}
        </main>
      </div>
    </>
  );
}
