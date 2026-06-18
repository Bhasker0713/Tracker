import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell, LineChart, Line } from "recharts";

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

/* ── Invite / password-recovery detection ─────────────────────
   Run SYNCHRONOUSLY at module load time, before Supabase can
   process and clear the URL hash.  We persist the flag in
   sessionStorage so it survives the SIGNED_IN re-render.     */
(function detectAuthRedirect(){
  try{
    const h=window.location.hash, q=window.location.search;
    if(h.includes("type=invite")||q.includes("type=invite")||
       h.includes("type=recovery")||q.includes("type=recovery")){
      sessionStorage.setItem("rt_needs_pwd","1");
    }
  }catch(_){}
})();

/* ── Font & Design System ─────────────────────────────────── */
const FONT    = "'Aptos','Segoe UI','Inter',system-ui,sans-serif";
const NAV     = "#0F2D6E";   // darker navy blue sidebar
const BLUE    = "#1251A1";   // primary blue
const TEAL    = "#1251A1";   // alias - keeps existing code working
const BG      = "#F1F5F9";
const WHITE   = "#FFFFFF";
const TEXT    = "#000000";
const MUTED   = "#64748B";
const BORDER  = "#E2E8F0";
const SUCCESS = "#059669";
const WARN    = "#D97706";
const DANGER  = "#DC2626";

const DEPT_C  = { Engineering:"#3B82F6",Design:"#8B5CF6",Product:"#F59E0B",QA:"#10B981",HR:"#EC4899",Finance:"#F97316",Marketing:"#06D6A0" };
const ROLE_C  = { admin:"#7C3AED",manager:"#2563EB",user:"#059669" };
const TS_STATUS = {
  draft:     { bg:"#F8FAFC",fg:"#64748B",label:"Draft",     icon:"📝" },
  submitted: { bg:"#FFFBEB",fg:"#92400E",label:"Submitted", icon:"⏳" },
  approved:  { bg:"#ECFDF5",fg:"#065F46",label:"Approved",  icon:"✅" },
  rejected:  { bg:"#FEF2F2",fg:"#991B1B",label:"Returned",  icon:"↩️" },
};
const deptColor = d => DEPT_C[d]||"#64748B";

/* ── Calendar helpers ─────────────────────────────────────── */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function currentWeek() {
  const now=new Date(), jan4=new Date(now.getFullYear(),0,4);
  const w1=new Date(jan4); w1.setDate(jan4.getDate()-((jan4.getDay()+6)%7));
  const wk=Math.floor((now-w1)/(7*864e5))+1;
  return now.getFullYear()+"-W"+String(wk).padStart(2,"0");
}
function addWeeks(w,n){
  const [yr,wn]=w.split("-W");
  const jan4=new Date(+yr,0,4);
  const w1=new Date(jan4); w1.setDate(jan4.getDate()-((jan4.getDay()+6)%7));
  const target=new Date(w1.getTime()+(+wn-1+n)*7*864e5);
  const jan4t=new Date(target.getFullYear(),0,4);
  const w1t=new Date(jan4t); w1t.setDate(jan4t.getDate()-((jan4t.getDay()+6)%7));
  const wkt=Math.floor((target-w1t)/(7*864e5))+1;
  return target.getFullYear()+"-W"+String(wkt).padStart(2,"0");
}
function weekMonday(w){
  const [yr,wn]=w.split("-W");
  const jan4=new Date(+yr,0,4);
  const mon=new Date(jan4); mon.setDate(jan4.getDate()-((jan4.getDay()+6)%7)+(+wn-1)*7);
  return mon;
}
function weekDates(w){
  const mon=weekMonday(w);
  return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
}
function weekLabel(w){
  const ds=weekDates(w),s=ds[0],e=ds[6];
  const sf=MONTHS[s.getMonth()]+" "+s.getDate();
  const ef=MONTHS[e.getMonth()]+" "+e.getDate()+", "+e.getFullYear();
  return sf+" - "+ef;
}
function dayLabel(d){ return DAYS[(d.getDay()+6)%7]+" "+d.getDate(); }
function recentWeeks(n){ return Array.from({length:n},(_,i)=>addWeeks(currentWeek(),-(n-1-i))); }

async function notifyEmp(empId,message,type){
  const{data}=await sb.from("app_users").select("id").eq("employee_id",empId).single();
  if(data)await sb.from("notifications").insert({user_id:data.id,message,type:type||"info",read:false});
}
function csvDownload(rows,filename){
  const keys=Object.keys(rows[0]||{});
  const lines=[keys.join(","),...rows.map(r=>keys.map(k=>JSON.stringify(r[k]??"")).join(","))];
  const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(lines.join("\n"));a.download=filename;a.click();
}
function utilColor(p){
  if(p===0)  return{bg:"#F1F5F9",fg:"#94A3B8"};
  if(p<50)   return{bg:"#FEF2F2",fg:"#991B1B"};
  if(p<75)   return{bg:"#FFFBEB",fg:"#92400E"};
  if(p<=100) return{bg:"#ECFDF5",fg:"#065F46"};
  return            {bg:"#EDE9FE",fg:"#4C1D95"};
}

/* ── DB mappers ───────────────────────────────────────────── */
const toEmp  =r=>({id:r.id,name:r.name||"",email:r.email||"",dept:r.department||"",role:r.role||"",capacity:r.capacity||40,active:r.active!==false,teamId:r.team_id||null,managerId:r.manager_id||null,phone:r.phone||"",billingRate:+(r.billing_rate||0),appRole:"user",color:deptColor(r.department)});
const toProj =r=>({id:r.id,name:r.name,client:r.client||"",status:r.status||"planning",start:r.start_date||"",end:r.end_date||"",budgetHours:r.budget_hours||0,billable:r.billable!==false,costBudget:+(r.cost_budget||0)});
const toTask =r=>({id:r.id,projId:r.project_id,name:r.name,desc:r.description||"",estHrs:+(r.estimated_hours||0),billable:r.billable!==false,status:r.status||"active"});
const toCost =r=>({id:r.id,projId:r.project_id,desc:r.description,amount:+(r.amount||0),category:r.category||"Material",date:r.date||""});
const toAlloc=r=>({id:r.id,empId:r.employee_id,projId:r.project_id,hoursPerWeek:r.hours_per_week});
const toEntry=r=>({id:r.id,empId:r.employee_id,projId:r.project_id,taskId:r.task_id||null,week:r.week,hours:Number(r.hours),note:r.note||"",day:r.day||null,tsId:r.timesheet_id||null});
const toLeave=r=>({id:r.id,empId:r.employee_id,type:r.type,from:r.from_date,to:r.to_date,days:r.days,status:r.status,reason:r.reason||""});
const toTeam =r=>({id:r.id,name:r.name,description:r.description||"",managerId:r.manager_id||null,color:r.color||BLUE,members:[]});
const toTs   =r=>({id:r.id,empId:r.employee_id,week:r.week,status:r.status||"draft",totalHours:Number(r.total_hours||0),comment:r.comment||"",reviewedBy:r.reviewed_by||null,submittedAt:r.submitted_at||null,reviewedAt:r.reviewed_at||null});
const toNotif=r=>({id:r.id,message:r.message,type:r.type||"info",read:r.read||false,createdAt:r.created_at});

/* ── Shared UI components ─────────────────────────────────── */
const S = { fontFamily:FONT }; // base style

function Av({name="?",color=BLUE,sz=32}){
  const i=(name).split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();
  return <div style={{width:sz,height:sz,borderRadius:"50%",background:color+"1A",color,fontWeight:700,fontSize:sz*.35,display:"flex",alignItems:"center",justifyContent:"center",border:"1.5px solid "+color+"33",flexShrink:0,fontFamily:FONT}}>{i}</div>;
}
function Badge({s}){
  const MAP={active:{bg:"#ECFDF5",fg:"#065F46",t:"Active"},inactive:{bg:"#F1F5F9",fg:"#64748B",t:"Inactive"},pending:{bg:"#FFFBEB",fg:"#92400E",t:"Pending"},approved:{bg:"#ECFDF5",fg:"#065F46",t:"Approved"},rejected:{bg:"#FEF2F2",fg:"#991B1B",t:"Rejected"},planning:{bg:"#EFF6FF",fg:"#1D4ED8",t:"Planning"},active_proj:{bg:"#ECFDF5",fg:"#065F46",t:"Active"},review:{bg:"#FFFBEB",fg:"#92400E",t:"In Review"},completed:{bg:"#F1F5F9",fg:"#475569",t:"Done"},submitted:{bg:"#FFFBEB",fg:"#92400E",t:"Submitted"}};
  const st=MAP[s]||{bg:"#F1F5F9",fg:"#374151",t:s};
  return <span style={{background:st.bg,color:st.fg,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",fontFamily:FONT}}>{st.t}</span>;
}
function RoleBadge({role}){
  const c=ROLE_C[role]||MUTED;
  return <span style={{background:c+"1A",color:c,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600,textTransform:"capitalize",fontFamily:FONT}}>{role}</span>;
}
function Prog({val,h=6}){
  const c=val>100?"#7C3AED":val>=75?BLUE:val>=50?WARN:DANGER;
  return <div style={{background:"#E2E8F0",borderRadius:999,height:h,overflow:"hidden",width:"100%"}}>
    <div style={{width:Math.min(val,100)+"%",height:"100%",background:c,borderRadius:999,transition:"width .3s"}}/></div>;
}
function Card({children,style={}}){
  return <div style={{background:WHITE,border:"1px solid "+BORDER,borderRadius:10,padding:20,boxShadow:"0 1px 3px #0000000a",...style,fontFamily:FONT}}>{children}</div>;
}
function SecHd({title,action}){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
    <span style={{fontSize:14,fontWeight:600,color:TEXT,fontFamily:FONT}}>{title}</span>{action}</div>;
}
function Btn({children,onClick,primary,danger,ghost,small,full,disabled,style:s={}}){
  return <button onClick={onClick} disabled={disabled} style={{
    display:"flex",alignItems:"center",gap:5,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,
    padding:small?"5px 12px":"8px 18px",borderRadius:7,fontSize:small?12:13,fontWeight:500,fontFamily:FONT,
    width:full?"100%":undefined,justifyContent:full?"center":undefined,transition:"all .15s",
    border:primary?"none":danger?"1px solid #FCA5A5":ghost?"none":"1px solid "+BORDER,
    background:primary?BLUE:danger?"#FEF2F2":ghost?"transparent":WHITE,
    color:primary?"#fff":danger?"#DC2626":TEXT,...s}}>{children}</button>;
}
function Inp({label,type="text",value,onChange,placeholder,required,disabled,small}){
  const fs=small?12:14;
  return <div style={{marginBottom:14,fontFamily:FONT}}>
    {label&&<label style={{fontSize:12,fontWeight:500,color:TEXT,display:"block",marginBottom:5}}>{label}{required&&<span style={{color:DANGER}}> *</span>}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
      style={{width:"100%",padding:small?"7px 10px":"10px 14px",border:"1.5px solid "+BORDER,borderRadius:7,fontSize:fs,color:TEXT,background:disabled?"#F8FAFC":WHITE,boxSizing:"border-box",fontFamily:FONT,outline:"none"}}
      onFocus={e=>e.target.style.borderColor=BLUE} onBlur={e=>e.target.style.borderColor=BORDER}/></div>;
}
function SelF({label,value,onChange,options,required,small}){
  const fs=small?12:14;
  return <div style={{marginBottom:14,fontFamily:FONT}}>
    {label&&<label style={{fontSize:12,fontWeight:500,color:TEXT,display:"block",marginBottom:5}}>{label}{required&&<span style={{color:DANGER}}> *</span>}</label>}
    <select value={value} onChange={onChange} style={{width:"100%",padding:small?"7px 10px":"10px 14px",border:"1.5px solid "+BORDER,borderRadius:7,fontSize:fs,color:TEXT,background:WHITE,boxSizing:"border-box",fontFamily:FONT}}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
}
function Spin({dark}){return <span style={{display:"inline-block",width:14,height:14,border:"2px solid "+(dark?"#CBD5E1":"rgba(255,255,255,.4)"),borderTop:"2px solid "+(dark?BLUE:"#fff"),borderRadius:"50%",animation:"spin .7s linear infinite"}}/>;}
function Modal({title,onClose,children,width=480}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
    <div style={{background:WHITE,borderRadius:12,padding:28,width:"100%",maxWidth:width,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.18)",fontFamily:FONT}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <span style={{fontSize:17,fontWeight:700,color:TEXT}}>{title}</span>
        <button onClick={onClose} style={{border:"none",background:"none",fontSize:20,cursor:"pointer",color:MUTED,lineHeight:1}}>x</button>
      </div>{children}</div></div>;
}
function KPI({label,value,sub,icon,alert}){
  return <div style={{background:WHITE,border:"1px solid "+(alert?"#FCA5A5":BORDER),borderRadius:10,padding:"14px 18px",flex:1,minWidth:140,boxShadow:"0 1px 3px #0000000a",fontFamily:FONT}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
      <span style={{fontSize:11,color:MUTED,fontWeight:500,textTransform:"uppercase",letterSpacing:.5}}>{label}</span>
      <span style={{fontSize:18}}>{icon}</span></div>
    <div style={{fontSize:26,fontWeight:700,color:alert?DANGER:TEXT,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:MUTED,marginTop:3}}>{sub}</div>}</div>;
}
function Tabs({items,active,onChange}){
  return <div style={{display:"flex",gap:2,background:"#F1F5F9",borderRadius:9,padding:3,marginBottom:20,fontFamily:FONT}}>
    {items.map(t=><button key={t.id} onClick={()=>onChange(t.id)} style={{flex:1,padding:"8px 16px",borderRadius:7,border:"none",cursor:"pointer",background:active===t.id?WHITE:"transparent",color:active===t.id?TEXT:MUTED,fontSize:13,fontWeight:active===t.id?600:400,boxShadow:active===t.id?"0 1px 3px #0000000e":"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:FONT}}>
      {t.label}{t.badge>0&&<span style={{background:DANGER,color:"#fff",borderRadius:999,padding:"1px 6px",fontSize:10,fontWeight:700}}>{t.badge}</span>}
    </button>)}</div>;
}
function Alrt({type,msg}){
  if(!msg)return null;
  const M={error:{bg:"#FEF2F2",b:"#FCA5A5",c:DANGER},ok:{bg:"#ECFDF5",b:"#6EE7B7",c:"#065F46"},warn:{bg:"#FFFBEB",b:"#FCD34D",c:"#92400E"},info:{bg:"#EFF6FF",b:"#BFDBFE",c:"#1D4ED8"}}[type]||{bg:"#ECFDF5",b:"#6EE7B7",c:"#065F46"};
  return <div style={{padding:"10px 14px",background:M.bg,border:"1px solid "+M.b,borderRadius:8,fontSize:13,color:M.c,marginBottom:14,fontFamily:FONT}}>{msg}</div>;
}

/* ── SetPasswordScreen ────────────────────────────────────── */
function SetPasswordScreen({onDone}){
  const [pwd,setPwd]=useState(""),[conf,setConf]=useState(""),[loading,setLoading]=useState(false),[msg,setMsg]=useState({type:"",text:""});
  const handle=async()=>{
    if(!pwd||pwd.length<8)return setMsg({type:"error",text:"Min 8 characters."});
    if(pwd!==conf)return setMsg({type:"error",text:"Passwords do not match."});
    setLoading(true);const{error}=await sb.auth.updateUser({password:pwd});setLoading(false);
    if(error)setMsg({type:"error",text:error.message});
    else{window.history.replaceState({},"",window.location.pathname);onDone();}
  };
  return(
    <div style={{display:"flex",height:"100vh",alignItems:"center",justifyContent:"center",background:"#EFF6FF",fontFamily:FONT}}>
      <div style={{width:440,background:WHITE,borderRadius:14,padding:44,boxShadow:"0 8px 40px rgba(0,0,0,.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:32}}>
          <div style={{width:44,height:44,borderRadius:12,background:BLUE,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:20,fontFamily:FONT}}>R</div>
          <div><div style={{fontSize:18,fontWeight:700,color:TEXT}}>ResTrack</div><div style={{fontSize:12,color:MUTED}}>Resource Management Platform</div></div>
        </div>
        <div style={{padding:"12px 16px",background:"#ECFDF5",border:"1px solid #6EE7B7",borderRadius:10,marginBottom:24,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>🎉</span>
          <div style={{fontSize:13,color:"#065F46",fontWeight:500}}>You have been invited to ResTrack. Set a password to activate your account.</div>
        </div>
        <h2 style={{fontSize:20,fontWeight:700,color:TEXT,margin:"0 0 6px"}}>Set your password</h2>
        <p style={{fontSize:14,color:MUTED,margin:"0 0 22px"}}>Choose a secure password to complete setup.</p>
        <Alrt type={msg.type} msg={msg.text}/>
        <Inp label="New Password" type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="At least 8 characters" required/>
        <Inp label="Confirm Password" type="password" value={conf} onChange={e=>setConf(e.target.value)} placeholder="Repeat password" required/>
        <Btn primary full disabled={loading} onClick={handle} style={{padding:"12px",fontSize:14,marginTop:4}}>
          {loading?<><Spin/>Setting...</>:"Set Password and Enter ResTrack"}
        </Btn>
      </div>
    </div>
  );
}

/* ── LoginPage ────────────────────────────────────────────── */
function LoginPage(){
  const [mode,setMode]=useState("login");
  const [name,setName]=useState(""),[email,setEmail]=useState(""),[pwd,setPwd]=useState(""),[conf,setConf]=useState("");
  const [newPwd,setNewPwd]=useState(""),[newConf,setNewConf]=useState("");
  const [loading,setLoading]=useState(false),[msg,setMsg]=useState({type:"",text:""});
  useEffect(()=>{const h=window.location.hash,q=window.location.search;if(h.includes("type=invite")||q.includes("type=invite")||h.includes("type=recovery")||q.includes("type=recovery"))setMode("setpwd");},[]);
  const err=t=>setMsg({type:"error",text:t}),ok=t=>setMsg({type:"ok",text:t});
  const doLogin=async e=>{e.preventDefault();if(!email||!pwd)return err("Email and password required.");setLoading(true);setMsg({type:"",text:""});const{error}=await sb.auth.signInWithPassword({email,password:pwd});setLoading(false);if(error)err(error.message);};
  const doSignUp=async e=>{
    e.preventDefault();if(!name.trim())return err("Full name required.");if(!email)return err("Email required.");
    if(!pwd||pwd.length<8)return err("Password must be at least 8 characters.");if(pwd!==conf)return err("Passwords do not match.");
    setLoading(true);setMsg({type:"",text:""});
    const{data:authData,error:authErr}=await sb.auth.signUp({email,password:pwd,options:{data:{name:name.trim(),role:"admin"},emailRedirectTo:window.location.origin}});
    if(authErr){setLoading(false);return err(authErr.message);}
    const authId=authData.user?.id;
    if(authId){
      const{data:emp}=await sb.from("employees").insert({name:name.trim(),email,department:"Management",role:"Administrator",capacity:40,active:true}).select().single();
      await sb.from("app_users").upsert({id:authId,name:name.trim(),email,role:"admin",employee_id:emp?.id||null,is_active:true,avatar_color:BLUE},{onConflict:"id"});
    }
    setLoading(false);ok("Account created! Check your email to confirm, then sign in.");setTimeout(()=>setMode("login"),4000);
  };
  const doForgot=async e=>{e.preventDefault();if(!email)return err("Enter your email.");setLoading(true);const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});setLoading(false);if(error)err(error.message);else{ok("Reset link sent.");setTimeout(()=>setMode("login"),3000);}};
  const doSetPwd=async e=>{e.preventDefault();if(!newPwd||newPwd.length<8)return err("Min 8 chars.");if(newPwd!==newConf)return err("Passwords do not match.");setLoading(true);const{error}=await sb.auth.updateUser({password:newPwd});setLoading(false);if(error)err(error.message);else{ok("Password set!");window.location.hash="";}};

  return(
    <div style={{display:"flex",height:"100vh",fontFamily:FONT}}>
      {/* Left panel */}
      <div style={{width:"42%",background:NAV,display:"flex",flexDirection:"column",justifyContent:"center",padding:"56px 48px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:44}}>
          <div style={{width:46,height:46,borderRadius:12,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:22,color:"#fff",border:"1px solid rgba(255,255,255,.3)"}}>R</div>
          <div><div style={{fontSize:22,fontWeight:700,color:"#fff"}}>ResTrack</div><div style={{fontSize:12,color:"rgba(255,255,255,.6)"}}>Resource Management Platform</div></div>
        </div>
        <h1 style={{fontSize:30,fontWeight:700,color:"#fff",margin:"0 0 14px",lineHeight:1.25}}>Manage your team with full visibility</h1>
        <p style={{fontSize:14,color:"rgba(255,255,255,.7)",margin:"0 0 32px",lineHeight:1.7}}>One platform for timesheets, resource tracking, leave management and team collaboration.</p>
        {["Role-based access for Admin, Manager and User","Calendar-style weekly timesheets with daily breakdown","Project billing rates and task tracking","Leave management with approval workflows","Real-time utilization reports and billing summaries"].map((f,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{width:20,height:20,borderRadius:"50%",background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontSize:10,fontWeight:700}}>✓</span>
            <span style={{fontSize:13,color:"rgba(255,255,255,.85)"}}>{f}</span>
          </div>
        ))}
      </div>
      {/* Right panel */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#F8FAFF",padding:40}}>
        <div style={{width:"100%",maxWidth:400}}>
          {(mode==="login"||mode==="signup")&&(
            <div style={{display:"flex",background:"#E2E8F0",borderRadius:9,padding:3,marginBottom:28}}>
              {[{id:"login",label:"Sign In"},{id:"signup",label:"Admin Setup"}].map(t=>(
                <button key={t.id} onClick={()=>{setMode(t.id);setMsg({type:"",text:""}); }} style={{flex:1,padding:"9px",borderRadius:7,border:"none",cursor:"pointer",background:mode===t.id?WHITE:"transparent",color:mode===t.id?TEXT:MUTED,fontSize:13,fontWeight:mode===t.id?600:400,fontFamily:FONT}}>{t.label}</button>
              ))}
            </div>
          )}
          {mode==="login"&&<>
            <h2 style={{fontSize:22,fontWeight:700,color:TEXT,margin:"0 0 5px"}}>Welcome back</h2>
            <p style={{fontSize:14,color:MUTED,margin:"0 0 24px"}}>Sign in to your ResTrack account</p>
            <Alrt type={msg.type} msg={msg.text}/>
            <form onSubmit={doLogin}>
              <Inp label="Work Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/>
              <Inp label="Password" type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Your password" required/>
              <Btn primary full disabled={loading} style={{padding:"12px",fontSize:14,marginTop:4}}>{loading?<><Spin/>Signing in...</>:"Sign In"}</Btn>
            </form>
            <button onClick={()=>{setMode("forgot");setMsg({type:"",text:""}); }} style={{marginTop:14,fontSize:13,color:MUTED,background:"none",border:"none",cursor:"pointer",display:"block",width:"100%",textAlign:"center",fontFamily:FONT}}>Forgot password?</button>
            <div style={{marginTop:20,padding:"12px 16px",background:"#ECFDF5",borderRadius:9,border:"1px solid #6EE7B733",fontSize:13,color:"#065F46",lineHeight:1.6}}>
              <strong>Invited to ResTrack?</strong> Click the link in your invite email - it takes you directly to the password setup screen.
            </div>
          </>}
          {mode==="signup"&&<>
            <h2 style={{fontSize:22,fontWeight:700,color:TEXT,margin:"0 0 5px"}}>Admin account setup</h2>
            <p style={{fontSize:14,color:MUTED,margin:"0 0 16px"}}>For setting up the first admin account only.</p>
            <div style={{padding:"10px 14px",background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:8,fontSize:13,color:"#92400E",marginBottom:16,lineHeight:1.5}}><strong>Already invited?</strong> Do not use this form. Check your email for the invite link instead.</div>
            <Alrt type={msg.type} msg={msg.text}/>
            <form onSubmit={doSignUp}>
              <Inp label="Full Name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required/>
              <Inp label="Work Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/>
              <Inp label="Password" type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Min 8 characters" required/>
              <Inp label="Confirm Password" type="password" value={conf} onChange={e=>setConf(e.target.value)} placeholder="Repeat password" required/>
              <Btn primary full disabled={loading} style={{padding:"12px",fontSize:14,marginTop:4}}>{loading?<><Spin/>Creating...</>:"Create Admin Account"}</Btn>
            </form>
          </>}
          {mode==="forgot"&&<>
            <button onClick={()=>setMode("login")} style={{fontSize:13,color:MUTED,background:"none",border:"none",cursor:"pointer",marginBottom:20,fontFamily:FONT}}>Back to sign in</button>
            <h2 style={{fontSize:22,fontWeight:700,color:TEXT,margin:"0 0 5px"}}>Reset password</h2>
            <Alrt type={msg.type} msg={msg.text}/>
            <form onSubmit={doForgot}><Inp label="Work Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/><Btn primary full disabled={loading}>{loading?<><Spin/>Sending...</>:"Send Reset Link"}</Btn></form>
          </>}
          {mode==="setpwd"&&<>
            <h2 style={{fontSize:22,fontWeight:700,color:TEXT,margin:"0 0 5px"}}>Set your password</h2>
            <p style={{fontSize:14,color:MUTED,margin:"0 0 22px"}}>Complete your account setup.</p>
            <Alrt type={msg.type} msg={msg.text}/>
            <form onSubmit={doSetPwd}>
              <Inp label="New Password" type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="Min 8 characters" required/>
              <Inp label="Confirm" type="password" value={newConf} onChange={e=>setNewConf(e.target.value)} placeholder="Repeat password" required/>
              <Btn primary full disabled={loading} style={{padding:"12px",fontSize:14}}>{loading?<><Spin/>Setting...</>:"Set Password and Enter ResTrack"}</Btn>
            </form>
          </>}
        </div>
      </div>
    </div>
  );
}
/* ── ClaimAdminBanner ─────────────────────────────────────── */
function ClaimAdminBanner({userId,onClaim,claiming}){
  const [noAdmins,setNoAdmins]=useState(null);
  useEffect(()=>{sb.from("app_users").select("id",{count:"exact",head:true}).eq("role","admin").then(({count})=>setNoAdmins((count||0)===0));},[]);
  if(!noAdmins)return null;
  return(
    <div style={{padding:"14px 20px",background:"#FFFBEB",border:"2px solid #F59E0B",borderRadius:10,marginBottom:20,display:"flex",alignItems:"center",gap:14,fontFamily:FONT}}>
      <span style={{fontSize:24}}>🔑</span>
      <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"#92400E",marginBottom:2}}>No admin account set up yet</div><div style={{fontSize:13,color:"#B45309"}}>You are logged in as User. Since no admin exists, you can claim admin access now.</div></div>
      <button onClick={onClaim} disabled={claiming} style={{padding:"10px 20px",background:WARN,border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:600,cursor:claiming?"not-allowed":"pointer",fontFamily:FONT}}>{claiming?"Claiming...":"Claim Admin Access"}</button>
    </div>
  );
}

/* ── Dashboard ────────────────────────────────────────────── */
function Dashboard({user,employees,projects,allocs,entries,leaves,timesheets,teams,setView,setUser}){
  const isAdmin=user.role==="admin",isManager=user.role==="manager";
  const [claiming,setClaiming]=useState(false);
  const claimAdmin=async()=>{setClaiming(true);const{count}=await sb.from("app_users").select("id",{count:"exact",head:true}).eq("role","admin");if((count||0)===0){await sb.from("app_users").update({role:"admin"}).eq("id",user.id);window.location.reload();}else{alert("An admin already exists. Ask them to change your role.");setClaiming(false);}};
  const cw=currentWeek(),WEEKS=recentWeeks(6);
  const visEmps=isAdmin?employees:isManager?employees.filter(e=>e.teamId===user.teamId||e.managerId===user.employeeId):employees.filter(e=>e.id===user.employeeId);
  const stats=visEmps.filter(e=>e.active).map(e=>{const log=entries.filter(en=>en.empId===e.id&&en.week===cw).reduce((s,en)=>s+en.hours,0);return{...e,log,util:e.capacity>0?Math.round((log/e.capacity)*100):0};});
  const avgUtil=stats.length?Math.round(stats.reduce((s,e)=>s+e.util,0)/stats.length):0;
  const overloaded=stats.filter(e=>e.util>100).length;
  const pending=(isAdmin||isManager)?(timesheets.filter(t=>{if(t.status!=="submitted")return false;const e=employees.find(em=>em.id===t.empId);return isAdmin||e?.managerId===user.employeeId||e?.teamId===user.teamId;}).length+leaves.filter(l=>{if(l.status!=="pending")return false;const e=employees.find(em=>em.id===l.empId);return isAdmin||e?.managerId===user.employeeId||e?.teamId===user.teamId;}).length):0;
  const myTs=timesheets.find(t=>t.empId===user.employeeId&&t.week===cw);
  const chart=WEEKS.map(w=>{const cap=visEmps.reduce((s,e)=>s+e.capacity,0),log=entries.filter(en=>en.week===w&&visEmps.find(e=>e.id===en.empId)).reduce((s,en)=>s+en.hours,0);return{week:weekLabel(w).split(" - ")[0],util:cap>0?Math.round((log/cap)*100):0};});
  return(
    <div style={{fontFamily:FONT}}>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:21,fontWeight:700,color:TEXT,margin:"0 0 3px"}}>{isAdmin?"Company Overview":isManager?"Team Overview":"My Dashboard"}</h1>
        <p style={{color:MUTED,fontSize:13,margin:0}}>{weekLabel(cw)} - Welcome, {user.name?.split(" ")[0]}</p>
      </div>
      {!isAdmin&&!isManager&&<ClaimAdminBanner userId={user.id} onClaim={claimAdmin} claiming={claiming}/>}
      {!isAdmin&&!isManager&&myTs&&<div style={{padding:"12px 16px",background:TS_STATUS[myTs.status]?.bg||"#F1F5F9",border:"1px solid "+BORDER,borderRadius:9,marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
        <span>{TS_STATUS[myTs.status]?.icon}</span>
        <div style={{flex:1}}><span style={{fontSize:13,fontWeight:600,color:TS_STATUS[myTs.status]?.fg}}>{TS_STATUS[myTs.status]?.label}</span><span style={{fontSize:13,color:MUTED}}> - Timesheet for {weekLabel(myTs.week)} ({myTs.totalHours}h)</span>{myTs.comment&&<div style={{fontSize:12,color:MUTED,marginTop:2}}>Manager: {myTs.comment}</div>}</div>
        {(myTs.status==="draft"||myTs.status==="rejected")&&<Btn small primary onClick={()=>setView("timesheets")}>Open Timesheet</Btn>}
      </div>}
      {!isAdmin&&!isManager&&!myTs&&<div style={{padding:"12px 16px",background:"#FFFBEB",border:"1px solid #FED7AA",borderRadius:9,marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
        <span>⚠️</span><div style={{flex:1,fontSize:13,color:"#92400E"}}>No hours logged for the current week yet.</div><Btn small onClick={()=>setView("timesheets")}>Log Hours</Btn>
      </div>}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <KPI label={isAdmin?"All Employees":isManager?"Team Members":"Hours This Week"} value={isAdmin||isManager?visEmps.length:(entries.filter(e=>e.empId===user.employeeId&&e.week===cw).reduce((s,e)=>s+e.hours,0))+"h"} icon="👥"/>
        <KPI label="Avg Utilization" value={avgUtil+"%" } sub="This week" icon="📊" alert={avgUtil<60&&(isAdmin||isManager)}/>
        <KPI label="Overloaded"      value={overloaded}  sub="Over 100%" icon="🔴" alert={overloaded>0}/>
        <KPI label="Pending"         value={pending}     sub="Need review" icon="✅" alert={pending>0}/>
        {(isAdmin||isManager)&&<KPI label="Active Projects" value={projects.filter(p=>p.status==="active").length} sub={projects.length+" total"} icon="📁"/>}
        {isAdmin&&<KPI label="Teams" value={teams.length} icon="🏢"/>}
      </div>
      {overloaded>0&&<div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:9,padding:"12px 16px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600,color:"#92400E",marginBottom:6}}>Action Required</div>
        {stats.filter(e=>e.util>100).map(e=><div key={e.id} style={{fontSize:12,color:"#C2410C",marginBottom:2}}><strong>{e.name}</strong> at {e.util}% utilization this week</div>)}
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:14}}>
        <Card>
          <SecHd title="Utilization Trend"/>
          <ResponsiveContainer width="100%" height={185}>
            <AreaChart data={chart}>
              <defs><linearGradient id="ug" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={BLUE} stopOpacity={0.15}/><stop offset="95%" stopColor={BLUE} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/><XAxis dataKey="week" tick={{fontSize:10,fill:MUTED}}/><YAxis tick={{fontSize:10,fill:MUTED}} domain={[0,100]} unit="%"/>
              <Tooltip formatter={v=>[v+"%","Utilization"]}/><Area type="monotone" dataKey="util" stroke={BLUE} fill="url(#ug)" strokeWidth={2} dot={{r:3,fill:BLUE}}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SecHd title="This Week" action={<Btn small ghost onClick={()=>setView("utilization")} style={{color:BLUE}}>Full view</Btn>}/>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {stats.slice(0,6).map(e=>{const{bg,fg}=utilColor(e.util);return(
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:8}}>
                <Av name={e.name} color={e.color||BLUE} sz={24}/>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div><Prog val={e.util} h={4}/></div>
                <span style={{fontSize:11,fontWeight:600,background:bg,color:fg,borderRadius:6,padding:"2px 6px",whiteSpace:"nowrap"}}>{e.util}%</span>
              </div>
            );})}
          </div>
        </Card>
      </div>
      {pending>0&&(isAdmin||isManager)&&<Card style={{border:"1px solid #FDE68A",background:"#FFFBEB"}}>
        <SecHd title={"Pending Approvals ("+pending+")"} action={<Btn small primary onClick={()=>setView("approvals")}>Review All</Btn>}/>
        <p style={{fontSize:13,color:MUTED,margin:0}}>Timesheets and leave requests awaiting your review.</p>
      </Card>}
    </div>
  );
}

/* ── TIMESHEETS - Calendar Style ──────────────────────────── */
function Timesheets({user,employees,projects,entries,setEntries,timesheets,setTimesheets,allTasks,setView}){
  const [week,setWeek]=useState(currentWeek());
  const [rows,setRows]=useState([]);
  // row: {tempId, day, projId, taskId, taskLabel, hours, note}
  const [saving,setSaving]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [msg,setMsg]=useState({type:"",text:""});

  const emp=employees.find(e=>e.id===user.employeeId);
  const capacity=emp?.capacity||40;
  const cw=currentWeek();
  const ts=timesheets.find(t=>t.empId===user.employeeId&&t.week===week);
  const locked=ts?.status==="submitted"||ts?.status==="approved";
  const wkDates=weekDates(week);
  const stMeta=TS_STATUS[ts?.status||"draft"];

  // Reload rows from DB whenever week changes
  useEffect(()=>{
    const ex=entries.filter(e=>String(e.empId)===String(user.employeeId)&&e.week===week);
    setRows(ex.map(e=>({
      tempId:String(e.id||("n"+Date.now()+Math.random())),
      id:e.id,
      day:e.day||DAYS[0],
      projId:String(e.projId||""),
      taskId:e.taskId||"",
      taskLabel:e.note||"",
      hours:String(e.hours||""),
      note:e.note||""
    })));
  },[week,user.employeeId]);

  const tasksForProj=projId=>allTasks.filter(t=>String(t.projId)===String(projId));

  const addRow=day=>setRows(prev=>[...prev,{tempId:"n"+Date.now()+Math.random(),id:null,day,projId:"",taskId:"",taskLabel:"",hours:"",note:""}]);
  const upd=(tid,field,val)=>setRows(prev=>prev.map(r=>r.tempId===tid?{...r,[field]:val}:r));
  const del=tid=>setRows(prev=>prev.filter(r=>r.tempId!==tid));

  const totalHrs=rows.reduce((s,r)=>s+(+r.hours||0),0);
  const dayTotal=day=>rows.filter(r=>r.day===day).reduce((s,r)=>s+(+r.hours||0),0);
  const utilPct=capacity>0?Math.round((totalHrs/capacity)*100):0;

  const doSave=async(status)=>{
    if(!user.employeeId){setMsg({type:"error",text:"No employee profile linked. Contact your admin."});return false;}
    setSaving(true);setMsg({type:"",text:""});
    const valid=rows.filter(r=>r.projId&&+r.hours>0);
    const totalH=valid.reduce((s,r)=>s+(+r.hours),0);
    const{data:tsData,error}=await sb.from("timesheets").upsert(
      {employee_id:user.employeeId,week,status:status||(ts?.status==="rejected"?"draft":(ts?.status||"draft")),total_hours:totalH,updated_at:new Date().toISOString()},
      {onConflict:"employee_id,week"}).select().single();
    if(error){setMsg({type:"error",text:error.message});setSaving(false);return false;}
    await sb.from("time_entries").delete().eq("employee_id",user.employeeId).eq("week",week);
    if(valid.length>0){
      const{data:newE}=await sb.from("time_entries").insert(
        valid.map(r=>({employee_id:user.employeeId,project_id:r.projId,task_id:r.taskId||null,week,day:r.day,hours:+r.hours,note:r.taskLabel||r.note,timesheet_id:tsData.id}))
      ).select();
      if(newE)setEntries(prev=>[...prev.filter(e=>!(String(e.empId)===String(user.employeeId)&&e.week===week)),...newE.map(toEntry)]);
    } else {
      setEntries(prev=>prev.filter(e=>!(String(e.empId)===String(user.employeeId)&&e.week===week)));
    }
    setTimesheets(prev=>[...prev.filter(t=>!(t.empId===user.employeeId&&t.week===week)),toTs(tsData)]);
    setSaving(false);return tsData;
  };

  const saveDraft=async()=>{const r=await doSave("draft");if(r)setMsg({type:"ok",text:"Draft saved."});};
  const submit=async()=>{
    if(!rows.filter(r=>r.projId&&+r.hours>0).length){setMsg({type:"warn",text:"Add at least one entry first."});return;}
    setSubmitting(true);
    const tsData=await doSave("submitted");
    if(tsData){
      await sb.from("timesheets").update({status:"submitted",submitted_at:new Date().toISOString()}).eq("id",tsData.id);
      setTimesheets(prev=>prev.map(t=>t.empId===user.employeeId&&t.week===week?{...t,status:"submitted"}:t));
      setMsg({type:"ok",text:"Submitted for approval!"});
      const myEmp=employees.find(e=>e.id===user.employeeId);
      if(myEmp?.managerId)await notifyEmp(myEmp.managerId,(user.name||"Someone")+" submitted timesheet for "+weekLabel(week),"timesheet");
    }
    setSubmitting(false);
  };
  const exportTS=()=>{
    const exRows=rows.map(r=>{const p=projects.find(pr=>String(pr.id)===r.projId);const t=allTasks.find(tk=>tk.id===r.taskId);return{Week:weekLabel(week),Day:r.day,Project:p?.name||"",Task:t?.name||r.taskLabel||"",Hours:r.hours};});
    if(!exRows.length){setMsg({type:"warn",text:"Nothing to export."});return;}
    csvDownload(exRows,"timesheet-"+week+".csv");
  };

  return(
    <div style={{fontFamily:FONT}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <h1 style={{fontSize:21,fontWeight:700,color:TEXT,margin:"0 0 2px"}}>My Timesheet</h1>
          <p style={{color:MUTED,fontSize:13,margin:0}}>Select a project, choose a task, then log your hours per day</p>
        </div>
        <Btn onClick={exportTS}>Export CSV</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"230px 1fr",gap:16}}>

        {/* ── Left: week picker ── */}
        <div>
          <Card style={{padding:14,marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}>Week</div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
              <button onClick={()=>setWeek(addWeeks(week,-1))} style={{width:28,height:28,borderRadius:6,border:"1px solid "+BORDER,background:WHITE,cursor:"pointer",fontWeight:700,color:TEXT,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>{"<"}</button>
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:TEXT,lineHeight:1.3}}>{weekLabel(week)}</div>
                <div style={{fontSize:10,color:week===cw?BLUE:MUTED,marginTop:1,fontWeight:600}}>{week===cw?"Current week":week>cw?"Future":"Past"}</div>
              </div>
              <button onClick={()=>setWeek(addWeeks(week,1))} style={{width:28,height:28,borderRadius:6,border:"1px solid "+BORDER,background:WHITE,cursor:"pointer",fontWeight:700,color:TEXT,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>{">"}</button>
            </div>
            {week!==cw&&<button onClick={()=>setWeek(cw)} style={{width:"100%",padding:"5px",background:"#EFF6FF",border:"1px solid "+BLUE+"44",borderRadius:6,color:BLUE,fontSize:11,fontWeight:600,cursor:"pointer",marginBottom:8,fontFamily:FONT}}>Today's week</button>}
            <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>Recent</div>
            {[addWeeks(cw,-3),addWeeks(cw,-2),addWeeks(cw,-1),cw].map(w=>{
              const wts=timesheets.find(t=>t.empId===user.employeeId&&t.week===w);
              const wst=wts?.status||"none";
              return(
                <div key={w} onClick={()=>setWeek(w)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 8px",borderRadius:6,cursor:"pointer",background:week===w?"#EFF6FF":WHITE,border:"1px solid "+(week===w?BLUE+"55":BORDER),marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:week===w?600:400,color:week===w?BLUE:TEXT}}>{weekLabel(w)}</span>
                  {wst!=="none"?<span style={{fontSize:9,background:TS_STATUS[wst]?.bg,color:TS_STATUS[wst]?.fg,borderRadius:4,padding:"1px 5px",fontWeight:600}}>{TS_STATUS[wst]?.label}</span>:<span style={{fontSize:9,color:MUTED,fontStyle:"italic"}}>Empty</span>}
                </div>
              );
            })}
          </Card>
          {emp&&<Card style={{padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
              <Av name={emp.name} color={emp.color||BLUE} sz={30}/>
              <div><div style={{fontSize:13,fontWeight:600,color:TEXT}}>{emp.name}</div><div style={{fontSize:11,color:MUTED}}>{emp.role}</div></div>
            </div>
            <div style={{fontSize:12,color:MUTED,marginBottom:4}}>{totalHrs}h of {capacity}h</div>
            <Prog val={utilPct} h={5}/>
            <div style={{fontSize:11,fontWeight:700,color:utilColor(utilPct).fg,marginTop:3,textAlign:"right"}}>{utilPct}% utilization</div>
          </Card>}
        </div>

        {/* ── Right: day cards ── */}
        <div>
          {/* Status bar */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",background:stMeta?.bg||"#F8FAFC",borderRadius:8,marginBottom:10,border:"1px solid "+BORDER}}>
            <span style={{fontSize:15}}>{stMeta?.icon}</span>
            <span style={{fontSize:13,fontWeight:600,color:stMeta?.fg}}>{stMeta?.label}</span>
            {ts?.submittedAt&&<span style={{fontSize:12,color:MUTED}}> - Submitted {new Date(ts.submittedAt).toLocaleDateString()}</span>}
            {ts?.comment&&<span style={{fontSize:12,color:stMeta?.fg,fontStyle:"italic"}}> | Manager: {ts.comment}</span>}
          </div>
          <Alrt type={msg.type} msg={msg.text}/>

          {/* Column labels - shown once above the cards */}
          <div style={{display:"grid",gridTemplateColumns:"180px 1fr 80px 36px",gap:8,padding:"0 16px 6px",marginBottom:2}}>
            <span style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5}}>Project</span>
            <span style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5}}>Task / Ticket</span>
            <span style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>Hours</span>
            <span/>
          </div>

          {wkDates.map(dt=>{
            const day=DAYS[(dt.getDay()+6)%7];
            const dayRows=rows.filter(r=>r.day===day);
            const dtotal=dayTotal(day);
            const isWeekend=dt.getDay()===0||dt.getDay()===6;
            return(
              <div key={day} style={{background:WHITE,border:"1px solid "+(dtotal>0?BLUE+"44":BORDER),borderRadius:10,marginBottom:8,overflow:"hidden",opacity:isWeekend?.85:1}}>
                {/* Day header */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:dtotal>0?"#EFF6FF":isWeekend?"#FAFAFA":"#F8FAFF",borderBottom:dayRows.length>0||!locked?"1px solid "+BORDER:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:30,height:30,borderRadius:7,background:dtotal>0?BLUE:"#E2E8F0",color:dtotal>0?"#fff":MUTED,fontWeight:700,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>{dt.getDate()}</div>
                    <div>
                      <span style={{fontSize:13,fontWeight:700,color:TEXT}}>{DAYS[(dt.getDay()+6)%7]}</span>
                      <span style={{fontSize:11,color:MUTED,marginLeft:6}}>{MONTHS[dt.getMonth()]} {dt.getDate()}{isWeekend?" (Weekend)":""}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {dtotal>0&&<span style={{fontSize:14,fontWeight:700,color:BLUE}}>{dtotal}h</span>}
                    {!locked&&<button onClick={()=>addRow(day)} style={{padding:"4px 12px",border:"1px solid "+BLUE+"55",borderRadius:6,background:WHITE,color:BLUE,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FONT}}>+ Add Entry</button>}
                  </div>
                </div>

                {/* Entry rows */}
                {(dayRows.length>0)&&<div style={{padding:"8px 14px"}}>
                  {dayRows.map((row,ri)=>{
                    const projTasks=tasksForProj(row.projId);
                    return(
                      <div key={row.tempId} style={{display:"grid",gridTemplateColumns:"180px 1fr 80px 36px",gap:8,alignItems:"center",padding:"6px 0",borderBottom:ri<dayRows.length-1?"1px solid #F1F5F9":"none"}}>
                        {/* Project */}
                        {locked
                          ?<div style={{fontSize:13,fontWeight:500,color:TEXT}}>{projects.find(p=>String(p.id)===row.projId)?.name||"-"}</div>
                          :<select value={row.projId} onChange={e=>{upd(row.tempId,"projId",e.target.value);upd(row.tempId,"taskId","");upd(row.tempId,"taskLabel","");}} style={{padding:"6px 8px",border:"1.5px solid "+(row.projId?BLUE+"88":BORDER),borderRadius:6,fontSize:12,color:row.projId?TEXT:MUTED,fontFamily:FONT,background:WHITE,width:"100%"}}>
                            <option value="">Select project...</option>
                            {projects.filter(p=>p.status!=="completed").map(p=><option key={p.id} value={String(p.id)}>{p.name}</option>)}
                          </select>
                        }
                        {/* Task: dropdown if project has tasks, else free text */}
                        {locked
                          ?<div style={{fontSize:13,color:TEXT}}>{allTasks.find(t=>t.id===row.taskId)?.name||row.taskLabel||<span style={{color:MUTED,fontStyle:"italic"}}>No task</span>}</div>
                          :projTasks.length>0
                            ?<select value={row.taskId} onChange={e=>{const t=projTasks.find(tk=>tk.id===e.target.value);upd(row.tempId,"taskId",e.target.value);upd(row.tempId,"taskLabel",t?.name||"");}} style={{padding:"6px 8px",border:"1.5px solid "+(row.taskId?BLUE+"88":BORDER),borderRadius:6,fontSize:12,color:row.taskId?TEXT:MUTED,fontFamily:FONT,background:WHITE,width:"100%"}}>
                                <option value="">Select task...</option>
                                {projTasks.map(t=><option key={t.id} value={t.id}>{t.name}{t.estHrs>0?" ("+t.estHrs+"h est)":""}</option>)}
                                <option value="other">Other / free text...</option>
                              </select>
                            :<input value={row.taskLabel} onChange={e=>upd(row.tempId,"taskLabel",e.target.value)} placeholder="Task, ticket, e.g. JIRA-220..." style={{padding:"6px 10px",border:"1px solid "+(row.taskLabel?BLUE+"88":BORDER),borderRadius:6,fontSize:12,color:TEXT,fontFamily:FONT,width:"100%",boxSizing:"border-box"}}
                              onFocus={e=>e.target.style.borderColor=BLUE} onBlur={e=>e.target.style.borderColor=row.taskLabel?BLUE+"88":BORDER}/>
                        }
                        {/* Hours */}
                        {locked
                          ?<div style={{textAlign:"center",fontWeight:700,fontSize:14,color:+row.hours>0?BLUE:MUTED,padding:"6px 0"}}>{row.hours||"0"}h</div>
                          :<input type="number" min="0" max="24" step="0.5" value={row.hours} onChange={e=>upd(row.tempId,"hours",e.target.value)} placeholder="hrs" style={{padding:"6px 4px",border:"1.5px solid "+(+row.hours>0?BLUE:BORDER),borderRadius:6,fontSize:14,fontWeight:700,textAlign:"center",width:"100%",boxSizing:"border-box",color:+row.hours>0?BLUE:MUTED,fontFamily:FONT,background:+row.hours>0?"#EFF6FF":WHITE}}/>
                        }
                        {/* Delete */}
                        {!locked
                          ?<button onClick={()=>del(row.tempId)} title="Remove entry" style={{width:32,height:32,border:"none",background:"#FEF2F2",color:DANGER,borderRadius:6,cursor:"pointer",fontSize:16,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>x</button>
                          :<div/>}
                      </div>
                    );
                  })}
                </div>}
                {dayRows.length===0&&locked&&<div style={{padding:"8px 16px",fontSize:12,color:MUTED}}>No hours logged</div>}
              </div>
            );
          })}

          {/* Week summary + actions */}
          <div style={{background:WHITE,border:"1px solid "+BORDER,borderRadius:10,padding:"14px 18px",marginTop:4,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Week Total</div>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:26,fontWeight:700,color:totalHrs>capacity?DANGER:totalHrs>0?BLUE:MUTED}}>{totalHrs}h</span>
                <span style={{fontSize:12,color:MUTED}}>of {capacity}h capacity</span>
                <span style={{fontSize:12,fontWeight:600,color:utilColor(utilPct).fg}}>{utilPct}%</span>
              </div>
              {totalHrs>0&&<div style={{width:180,marginTop:6}}><Prog val={utilPct} h={5}/></div>}
            </div>
            {!locked&&user.employeeId&&<div style={{display:"flex",gap:10}}>
              <Btn disabled={saving} onClick={saveDraft} style={{minWidth:120}}>{saving?<><Spin dark/>Saving...</>:"Save Draft"}</Btn>
              <Btn primary disabled={submitting||saving} onClick={submit} style={{minWidth:160}}>{submitting?<><Spin/>{"Submitting..."}</>:"Submit for Approval"}</Btn>
            </div>}
            {locked&&<div style={{padding:"10px 16px",background:stMeta?.bg,borderRadius:8}}>
              <span style={{fontSize:13,fontWeight:600,color:stMeta?.fg}}>{stMeta?.icon} {stMeta?.label}</span>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}


function Approvals({user,employees,timesheets,setTimesheets,leaves,setLeaves,entries,projects}){
  const [tab,setTab]=useState("timesheets");
  const [reviewTs,setReviewTs]=useState(null);const [comment,setComment]=useState("");const [loading,setLoading]=useState(false);
  const isAdmin=user.role==="admin";
  const filterEmp=e=>isAdmin||e?.managerId===user.employeeId||e?.teamId===user.teamId;
  const pendingTs=timesheets.filter(t=>t.status==="submitted"&&filterEmp(employees.find(e=>e.id===t.empId)));
  const allTs=timesheets.filter(t=>filterEmp(employees.find(e=>e.id===t.empId))).sort((a,b)=>b.week.localeCompare(a.week));
  const pendingLv=leaves.filter(l=>l.status==="pending"&&filterEmp(employees.find(e=>e.id===l.empId)));
  const allLv=leaves.filter(l=>filterEmp(employees.find(e=>e.id===l.empId))).sort((a,b)=>b.from.localeCompare(a.from));
  const approveTs=async ts=>{setLoading(true);const{data}=await sb.from("timesheets").update({status:"approved",comment,reviewed_by:user.employeeId,reviewed_at:new Date().toISOString()}).eq("id",ts.id).select().single();if(data){setTimesheets(prev=>prev.map(t=>t.id===ts.id?toTs(data):t));await notifyEmp(ts.empId,"Your timesheet for "+weekLabel(ts.week)+" was approved by "+user.name,"success");}setReviewTs(null);setComment("");setLoading(false);};
  const rejectTs=async ts=>{if(!comment.trim()){alert("Comment required when returning.");return;}setLoading(true);const{data}=await sb.from("timesheets").update({status:"rejected",comment,reviewed_by:user.employeeId,reviewed_at:new Date().toISOString()}).eq("id",ts.id).select().single();if(data){setTimesheets(prev=>prev.map(t=>t.id===ts.id?toTs(data):t));await notifyEmp(ts.empId,"Your timesheet for "+weekLabel(ts.week)+" was returned for changes","warn");}setReviewTs(null);setComment("");setLoading(false);};
  const updateLeave=async(id,status)=>{const{error}=await sb.from("leaves").update({status}).eq("id",id);if(!error){const lv=leaves.find(l=>l.id===id);setLeaves(prev=>prev.map(l=>l.id===id?{...l,status}:l));if(lv)await notifyEmp(lv.empId,"Your "+lv.type+" leave was "+status+" by "+user.name,status==="approved"?"success":"warn");}};
  const tsEntries=reviewTs?entries.filter(e=>String(e.empId)===String(reviewTs.empId)&&e.week===reviewTs.week):[];
  return(
    <div style={{fontFamily:FONT}}>
      <div style={{marginBottom:20}}><h1 style={{fontSize:21,fontWeight:700,color:TEXT,margin:"0 0 3px"}}>Approvals</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Review and action pending submissions</p></div>
      <Tabs items={[{id:"timesheets",label:"Timesheets",badge:pendingTs.length},{id:"leaves",label:"Leave Requests",badge:pendingLv.length}]} active={tab} onChange={setTab}/>
      {tab==="timesheets"&&<Card style={{padding:0,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:FONT}}>
          <thead><tr style={{background:"#F8FAFF"}}>{["Employee","Week","Hours","Submitted","Status","Action"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:MUTED,borderBottom:"1px solid "+BORDER}}>{h}</th>)}</tr></thead>
          <tbody>
            {allTs.map(ts=>{const emp=employees.find(e=>e.id===ts.empId);const st=TS_STATUS[ts.status]||{};return(
              <tr key={ts.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Av name={emp?.name||"?"} color={emp?.color||BLUE} sz={28}/><div><div style={{fontWeight:500}}>{emp?.name||"?"}</div><div style={{fontSize:11,color:MUTED}}>{emp?.dept}</div></div></div></td>
                <td style={{padding:"10px 14px",fontWeight:500}}>{weekLabel(ts.week)}</td>
                <td style={{padding:"10px 14px",fontWeight:700,color:BLUE}}>{ts.totalHours}h</td>
                <td style={{padding:"10px 14px",color:MUTED}}>{ts.submittedAt?new Date(ts.submittedAt).toLocaleDateString():"-"}</td>
                <td style={{padding:"10px 14px"}}><span style={{background:st.bg,color:st.fg,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600}}>{st.label||ts.status}</span></td>
                <td style={{padding:"10px 14px"}}>{ts.status==="submitted"?<Btn small primary onClick={()=>{setReviewTs(ts);setComment("");}}>Review</Btn>:<Btn small ghost onClick={()=>{setReviewTs(ts);setComment(ts.comment||"");}} style={{color:BLUE}}>View</Btn>}</td>
              </tr>
            );})}
            {allTs.length===0&&<tr><td colSpan={6} style={{padding:"32px",textAlign:"center",color:MUTED}}>No timesheets yet.</td></tr>}
          </tbody>
        </table>
      </Card>}
      {tab==="leaves"&&<div>
        {pendingLv.length>0&&<Card style={{marginBottom:14,border:"1px solid #FDE68A",background:"#FFFBEB"}}>
          <SecHd title={"Pending ("+pendingLv.length+")"}/>
          {pendingLv.map(l=>{const e=employees.find(em=>em.id===l.empId);return(
            <div key={l.id} style={{display:"flex",alignItems:"center",gap:12,padding:12,background:WHITE,borderRadius:8,border:"1px solid "+BORDER,marginBottom:8}}>
              <Av name={e?.name||"?"} color={e?.color||BLUE} sz={30}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{e?.name}</div><div style={{fontSize:12,color:MUTED}}>{l.type} - {l.from} to {l.to} - {l.days} day{l.days>1?"s":""}</div>{l.reason&&<div style={{fontSize:12,color:MUTED,marginTop:2}}>{l.reason}</div>}</div>
              <div style={{display:"flex",gap:6}}>
                <Btn small onClick={()=>updateLeave(l.id,"approved")} style={{background:"#ECFDF5",color:"#065F46",border:"1px solid #6EE7B7"}}>Approve</Btn>
                <Btn small danger onClick={()=>updateLeave(l.id,"rejected")}>Reject</Btn>
              </div>
            </div>
          );})}
        </Card>}
        <Card style={{padding:0,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:FONT}}>
            <thead><tr style={{background:"#F8FAFF"}}>{["Employee","Type","Dates","Days","Reason","Status"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:MUTED,borderBottom:"1px solid "+BORDER}}>{h}</th>)}</tr></thead>
            <tbody>{allLv.map(l=>{const e=employees.find(em=>em.id===l.empId);return(
              <tr key={l.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Av name={e?.name||"?"} color={e?.color||BLUE} sz={24}/><span style={{fontWeight:500}}>{e?.name||"?"}</span></div></td>
                <td style={{padding:"10px 14px"}}>{l.type}</td>
                <td style={{padding:"10px 14px",color:MUTED}}>{l.from} to {l.to}</td>
                <td style={{padding:"10px 14px",fontWeight:500}}>{l.days}</td>
                <td style={{padding:"10px 14px",color:MUTED}}>{l.reason||"-"}</td>
                <td style={{padding:"10px 14px"}}><Badge s={l.status}/></td>
              </tr>
            );})}
            {allLv.length===0&&<tr><td colSpan={6} style={{padding:"32px",textAlign:"center",color:MUTED}}>No leave requests.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>}
      {reviewTs&&<Modal title={"Timesheet - "+(employees.find(e=>e.id===reviewTs.empId)?.name||"?")} onClose={()=>setReviewTs(null)} width={540}>
        <div style={{display:"flex",gap:16,marginBottom:16,padding:"12px 14px",background:"#F8FAFF",borderRadius:8}}>
          <div><div style={{fontSize:11,color:MUTED}}>Week</div><div style={{fontWeight:600,fontSize:13}}>{weekLabel(reviewTs.week)}</div></div>
          <div><div style={{fontSize:11,color:MUTED}}>Total Hours</div><div style={{fontWeight:700,fontSize:16,color:BLUE}}>{reviewTs.totalHours}h</div></div>
          <div><div style={{fontSize:11,color:MUTED}}>Status</div><span style={{background:TS_STATUS[reviewTs.status]?.bg,color:TS_STATUS[reviewTs.status]?.fg,borderRadius:20,padding:"3px 8px",fontSize:12,fontWeight:600}}>{TS_STATUS[reviewTs.status]?.label}</span></div>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:600,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.4}}>Hours Breakdown</div>
          {tsEntries.length===0?<div style={{color:MUTED,fontSize:13}}>No entries.</div>:
          [...new Set(tsEntries.map(e=>String(e.projId)))].map(pid=>{
            const projEntries=tsEntries.filter(e=>String(e.projId)===pid);const p=projects.find(pr=>String(pr.id)===pid);const ptotal=projEntries.reduce((s,e)=>s+e.hours,0);
            return <div key={pid} style={{marginBottom:12,padding:"8px 12px",background:"#F8FAFF",borderRadius:8,border:"1px solid "+BORDER}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:projEntries.some(e=>e.day)?6:0}}>
                <span style={{fontSize:13,fontWeight:500}}>{p?.name||pid}</span>
                <span style={{fontWeight:700,color:BLUE}}>{ptotal}h</span>
              </div>
              {projEntries.some(e=>e.day)&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {projEntries.filter(e=>e.day).map(e=><div key={e.id} style={{fontSize:11,background:WHITE,borderRadius:5,padding:"3px 8px",border:"1px solid "+BORDER}}>
                  <span style={{color:MUTED}}>{e.day}:</span> <span style={{fontWeight:600}}>{e.hours}h</span>
                  {e.note&&<span style={{color:MUTED}}> - {e.note}</span>}
                </div>)}
              </div>}
            </div>;
          })}
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:500,color:TEXT,display:"block",marginBottom:5}}>Comment {reviewTs.status==="submitted"&&"(required for rejection)"}</label>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} disabled={reviewTs.status!=="submitted"} style={{width:"100%",padding:"10px 12px",border:"1px solid "+BORDER,borderRadius:8,fontSize:13,resize:"none",boxSizing:"border-box",background:reviewTs.status!=="submitted"?"#F8FAFC":WHITE,fontFamily:FONT}}/>
        </div>
        {reviewTs.status==="submitted"&&<div style={{display:"flex",gap:10}}>
          <Btn primary full disabled={loading} onClick={()=>approveTs(reviewTs)}>{loading?<><Spin/>...</>:"Approve"}</Btn>
          <Btn danger full disabled={loading} onClick={()=>rejectTs(reviewTs)}>{loading?<><Spin/>...</>:"Return for Changes"}</Btn>
        </div>}
      </Modal>}
    </div>
  );
}

/* ── Projects (with tasks, costs, billable) ───────────────── */
function Projects({user,projects,setProjects,allocs,setAllocs,employees,entries,allTasks,setAllTasks,allCosts,setAllCosts}){
  const [showNew,setShowNew]=useState(false);const [sel,setSel]=useState(null);const [selTab,setSelTab]=useState("team");const [saving,setSaving]=useState(false);
  const [aForm,setAForm]=useState({empId:"",hrs:""});
  const [tForm,setTForm]=useState({name:"",desc:"",estHrs:"",billable:true});
  const [cForm,setCForm]=useState({desc:"",amount:"",category:"Material",date:""});

  const [form,setForm]=useState({name:"",client:"",status:"planning",start:"",end:"",budget:"",billable:true,costBudget:""});
  const F=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const canEdit=user.role==="admin"||user.role==="manager";

  // Load tasks and costs when project expanded


  const addProj=async()=>{
    if(!form.name)return;setSaving(true);
    const{data,error}=await sb.from("projects").insert({name:form.name,client:form.client,status:form.status,start_date:form.start||null,end_date:form.end||null,budget_hours:+form.budget||0,billable:form.billable,cost_budget:+form.costBudget||0}).select().single();
    setSaving(false);if(!error&&data){setProjects(prev=>[...prev,toProj(data)]);setShowNew(false);setForm({name:"",client:"",status:"planning",start:"",end:"",budget:"",billable:true,costBudget:""});}
  };
  const addAlloc=async projId=>{
    if(!aForm.empId||!aForm.hrs)return;const{data,error}=await sb.from("allocations").upsert({employee_id:aForm.empId,project_id:projId,hours_per_week:+aForm.hrs},{onConflict:"employee_id,project_id"}).select().single();
    if(!error&&data){setAllocs(prev=>[...prev.filter(a=>!(String(a.empId)===String(aForm.empId)&&String(a.projId)===String(projId))),toAlloc(data)]);const pr=projects.find(p=>String(p.id)===String(projId));await notifyEmp(aForm.empId,"You have been added to project \""+( pr?.name||"a project")+"\" by "+user.name,"info");setAForm({empId:"",hrs:""});}
  };
  const removeAlloc=async id=>{const alloc=allocs.find(a=>a.id===id);const{error}=await sb.from("allocations").delete().eq("id",id);if(!error){setAllocs(prev=>prev.filter(a=>a.id!==id));if(alloc){const pr=projects.find(p=>String(p.id)===String(alloc.projId));await notifyEmp(alloc.empId,"You have been removed from project \""+( pr?.name||"a project")+"\" by "+user.name,"warn");}}};
  const addTask=async projId=>{
    if(!tForm.name)return;const{data,error}=await sb.from("project_tasks").insert({project_id:projId,name:tForm.name,description:tForm.desc,estimated_hours:+tForm.estHrs||0,billable:tForm.billable,status:"active"}).select().single();
    if(!error&&data){setAllTasks(prev=>[...prev,toTask(data)]);setTForm({name:"",desc:"",estHrs:"",billable:true});}
  };
  const removeTask=async id=>{const{error}=await sb.from("project_tasks").delete().eq("id",id);if(!error)setAllTasks(prev=>prev.filter(t=>t.id!==id));};
  const addCost=async projId=>{
    if(!cForm.desc||!cForm.amount)return;const{data,error}=await sb.from("project_costs").insert({project_id:projId,description:cForm.desc,amount:+cForm.amount,category:cForm.category,date:cForm.date||new Date().toISOString().slice(0,10)}).select().single();
    if(!error&&data){setAllCosts(prev=>[...prev,toCost(data)]);setCForm({desc:"",amount:"",category:"Material",date:""});}
  };
  const removeCost=async id=>{const{error}=await sb.from("project_costs").delete().eq("id",id);if(!error)setAllCosts(prev=>prev.filter(c=>c.id!==id));};
  const updateStatus=async(projId,status)=>{const{error}=await sb.from("projects").update({status}).eq("id",projId);if(!error)setProjects(prev=>prev.map(p=>p.id===projId?{...p,status}:p));};
  const toggleBillable=async(projId,billable)=>{const{error}=await sb.from("projects").update({billable}).eq("id",projId);if(!error)setProjects(prev=>prev.map(p=>p.id===projId?{...p,billable}:p));};

  return(
    <div style={{fontFamily:FONT}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div><h1 style={{fontSize:21,fontWeight:700,color:TEXT,margin:"0 0 3px"}}>Projects</h1><p style={{color:MUTED,fontSize:13,margin:0}}>{projects.length} projects</p></div>
        {canEdit&&<Btn primary onClick={()=>setShowNew(v=>!v)}>+ New Project</Btn>}
      </div>
      {showNew&&<Card style={{marginBottom:14,border:"1px solid "+BLUE+"44",background:"#F8FAFF"}}>
        <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Create Project</div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:0}}>
          <div style={{paddingRight:12}}><Inp label="Project Name" value={form.name} onChange={F("name")} required/><Inp label="Client / Organization" value={form.client} onChange={F("client")}/></div>
          <div style={{paddingRight:12}}><Inp label="Start Date" type="date" value={form.start} onChange={F("start")}/><Inp label="End Date" type="date" value={form.end} onChange={F("end")}/></div>
          <div>
            <SelF label="Status" value={form.status} onChange={F("status")} options={["planning","active","review","completed"].map(s=>({value:s,label:s[0].toUpperCase()+s.slice(1)}))}/>
            <Inp label="Budget (hours)" type="number" value={form.budget} onChange={F("budget")} placeholder="0"/>
            <Inp label="Cost Budget ($)" type="number" value={form.costBudget} onChange={F("costBudget")} placeholder="0"/>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <input type="checkbox" id="bill-new" checked={form.billable} onChange={e=>setForm(p=>({...p,billable:e.target.checked}))} style={{width:16,height:16,accentColor:BLUE}}/>
              <label htmlFor="bill-new" style={{fontSize:13,color:TEXT,cursor:"pointer"}}>Billable project</label>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn primary small disabled={saving} onClick={addProj}>{saving?<Spin/>:"Create Project"}</Btn>
          <Btn small onClick={()=>setShowNew(false)}>Cancel</Btn>
        </div>
      </Card>}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {projects.map(p=>{
          const pAllocs=allocs.filter(a=>String(a.projId)===String(p.id));
          const isOpen=sel===p.id;
          const loggedHrs=entries.filter(e=>String(e.projId)===String(p.id)).reduce((s,e)=>s+e.hours,0);
          const budgetPct=p.budgetHours>0?Math.round((loggedHrs/p.budgetHours)*100):0;
          const pTasks=allTasks.filter(t=>String(t.projId)===String(p.id));const pCosts=allCosts.filter(c=>String(c.projId)===String(p.id));
          const totalMaterialCost=pCosts.reduce((s,c)=>s+c.amount,0);
          const laborCost=pAllocs.reduce((s,a)=>{const e=employees.find(em=>String(em.id)===String(a.empId));const hrs=entries.filter(en=>String(en.projId)===String(p.id)&&String(en.empId)===String(a.empId)).reduce((t,en)=>t+en.hours,0);return s+(e?.billingRate||0)*hrs;},0);
          const totalProjectCost=laborCost+totalMaterialCost;
          const unassigned=employees.filter(e=>e.active&&!pAllocs.find(a=>String(a.empId)===String(e.id)));
          return(
            <Card key={p.id} style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"14px 18px",cursor:"pointer"}} onClick={()=>{setSel(isOpen?null:p.id);setSelTab("team");}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:14,fontWeight:600,color:TEXT}}>{p.name}</span>
                      <Badge s={p.status}/>
                      {p.billable?<span style={{fontSize:10,background:"#ECFDF5",color:"#065F46",borderRadius:20,padding:"2px 8px",fontWeight:600}}>Billable</span>:<span style={{fontSize:10,background:"#F1F5F9",color:MUTED,borderRadius:20,padding:"2px 8px",fontWeight:600}}>Non-Billable</span>}
                      <span style={{fontSize:12,color:MUTED}}>{p.client}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                      {p.budgetHours>0&&<div style={{display:"flex",alignItems:"center",gap:8,width:180}}><Prog val={budgetPct}/><span style={{fontSize:11,color:MUTED,whiteSpace:"nowrap"}}>{loggedHrs}h / {p.budgetHours}h</span></div>}
                      <span style={{fontSize:12,color:MUTED}}>{pAllocs.length} members</span>
                      {p.billable&&laborCost>0&&<span style={{fontSize:12,fontWeight:600,color:"#065F46",background:"#ECFDF5",borderRadius:20,padding:"2px 9px"}}>Labor: ${laborCost.toLocaleString()}</span>}
                      {totalMaterialCost>0&&<span style={{fontSize:12,fontWeight:600,color:"#92400E",background:"#FFFBEB",borderRadius:20,padding:"2px 9px"}}>Materials: ${totalMaterialCost.toLocaleString()}</span>}
                      {(laborCost>0||totalMaterialCost>0)&&p.costBudget>0&&<span style={{fontSize:12,fontWeight:600,color:totalProjectCost>p.costBudget?"#991B1B":MUTED}}>Total: ${totalProjectCost.toLocaleString()} / ${p.costBudget.toLocaleString()}</span>}
                      {pTasks.length>0&&<span style={{fontSize:11,color:MUTED}}>{pTasks.length} task{pTasks.length!==1?"s":""}</span>}
                      {p.start&&<span style={{fontSize:11,color:MUTED}}>{p.start} to {p.end}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:3}}>{pAllocs.slice(0,4).map(a=>{const e=employees.find(em=>String(em.id)===String(a.empId));return e?<Av key={a.id} name={e.name} color={e.color||BLUE} sz={26}/>:null;})}</div>
                  <span style={{color:MUTED,marginLeft:8,fontSize:13}}>{isOpen?"▲":"▼"}</span>
                </div>
              </div>
              {isOpen&&<div style={{borderTop:"1px solid #F1F5F9",background:"#F8FAFF"}}>
                {/* Sub-tabs */}
                <div style={{display:"flex",gap:0,borderBottom:"1px solid "+BORDER}}>
                  {[{id:"team",label:"Team & Allocation"},{id:"tasks",label:"Tasks"},{id:"costs",label:"Costs & Materials"},{id:"settings",label:"Settings"}].map(t=>(
                    <button key={t.id} onClick={()=>setSelTab(t.id)} style={{padding:"10px 18px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:selTab===t.id?600:400,color:selTab===t.id?BLUE:MUTED,borderBottom:selTab===t.id?"2px solid "+BLUE:"2px solid transparent",fontFamily:FONT}}>{t.label}</button>
                  ))}
                </div>
                <div style={{padding:"16px 18px"}}>
                  {selTab==="team"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:MUTED,marginBottom:10,textTransform:"uppercase",letterSpacing:.4}}>Allocated Team ({pAllocs.length})</div>
                      {pAllocs.length===0&&<div style={{color:MUTED,fontSize:13}}>No members yet.</div>}
                      {pAllocs.map(a=>{const emp=employees.find(e=>String(e.id)===String(a.empId));if(!emp)return null;const pct=emp.capacity>0?Math.round((a.hoursPerWeek/emp.capacity)*100):0;return(
                        <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #F1F5F9"}}>
                          <Av name={emp.name} color={emp.color||BLUE} sz={26}/>
                          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{emp.name}</div><div style={{fontSize:11,color:MUTED}}>{emp.role}</div></div>
                          <span style={{fontSize:12,fontWeight:600}}>{a.hoursPerWeek}h/wk</span>
                          <span style={{fontSize:11,background:"#EFF6FF",color:BLUE,padding:"2px 7px",borderRadius:5}}>{pct}%</span>
                          {emp.billingRate>0&&<span style={{fontSize:11,background:"#ECFDF5",color:"#065F46",padding:"2px 7px",borderRadius:5}}>${emp.billingRate}/hr</span>}
                          {canEdit&&<button onClick={()=>removeAlloc(a.id)} style={{border:"none",background:"none",color:MUTED,cursor:"pointer",fontSize:14}}>x</button>}
                        </div>
                      );})}
                    </div>
                    {canEdit&&<div>
                      <div style={{fontSize:12,fontWeight:600,color:MUTED,marginBottom:10,textTransform:"uppercase",letterSpacing:.4}}>Add Member</div>
                      <SelF label="" value={aForm.empId} onChange={e=>setAForm(f=>({...f,empId:e.target.value}))} options={[{value:"",label:"Select employee..."},...unassigned.map(e=>({value:String(e.id),label:e.name+(e.billingRate>0?" ($"+e.billingRate+"/hr)":"")+" ("+e.capacity+"h cap)"}))]}/>
                      <Inp label="Hours per week" type="number" value={aForm.hrs} onChange={e=>setAForm(f=>({...f,hrs:e.target.value}))} placeholder="20"/>
                      <Btn primary small onClick={()=>addAlloc(p.id)}>Add to Project</Btn>
                    </div>}
                  </div>}
                  {selTab==="tasks"&&<div>
                    {pTasks.map(t=>{const actual=entries.filter(e=>e.taskId===t.id).reduce((s,e)=>s+e.hours,0);return(
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:WHITE,borderRadius:8,border:"1px solid "+BORDER,marginBottom:7}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:500}}>{t.name}</div>
                          {t.desc&&<div style={{fontSize:11,color:MUTED}}>{t.desc}</div>}
                        </div>
                        <span style={{fontSize:11,background:t.billable?"#ECFDF5":"#F1F5F9",color:t.billable?"#065F46":MUTED,borderRadius:20,padding:"2px 8px",fontWeight:600}}>{t.billable?"Billable":"Non-Bill"}</span>
                        {t.estHrs>0&&<span style={{fontSize:12,color:MUTED}}>{actual}h / {t.estHrs}h est</span>}
                        {canEdit&&<button onClick={()=>removeTask(t.id)} style={{border:"none",background:"none",color:MUTED,cursor:"pointer",fontSize:14}}>x</button>}
                      </div>
                    );})}
                    {canEdit&&<div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px auto auto",gap:8,alignItems:"end",marginTop:12}}>
                      <Inp label="Task Name" value={tForm.name} onChange={e=>setTForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Backend API development" small/>
                      <Inp label="Est. Hours" type="number" value={tForm.estHrs} onChange={e=>setTForm(f=>({...f,estHrs:e.target.value}))} placeholder="40" small/>
                      <div style={{marginBottom:14}}>
                        <label style={{fontSize:11,fontWeight:500,color:TEXT,display:"block",marginBottom:5}}>Billable</label>
                        <input type="checkbox" checked={tForm.billable} onChange={e=>setTForm(f=>({...f,billable:e.target.checked}))} style={{width:16,height:16,accentColor:BLUE,marginTop:6}}/>
                      </div>
                      <div style={{paddingBottom:14}}><Btn primary small onClick={()=>addTask(p.id)}>Add Task</Btn></div>
                    </div>}
                  </div>}
                  {selTab==="costs"&&<div>
                    {/* Resource-level labor costs */}
                    {pAllocs.length>0&&<div style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:600,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.4}}>Labor Cost by Resource</div>
                      {pAllocs.map(a=>{const e=employees.find(em=>String(em.id)===String(a.empId));if(!e)return null;const hrs=entries.filter(en=>String(en.projId)===String(p.id)&&String(en.empId)===String(a.empId)).reduce((t,en)=>t+en.hours,0);const cost=(e.billingRate||0)*hrs;return(
                        <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#F8FAFF",borderRadius:8,marginBottom:6,border:"1px solid "+BORDER}}>
                          <Av name={e.name} color={e.color||BLUE} sz={24}/>
                          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{e.name}</div><div style={{fontSize:11,color:MUTED}}>{hrs}h logged {e.billingRate>0?"@ $"+e.billingRate+"/hr":"(no rate set)"}</div></div>
                          <span style={{fontWeight:700,color:cost>0?"#065F46":MUTED}}>{cost>0?"$"+cost.toLocaleString():"-"}</span>
                        </div>
                      );})}
                      <div style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:"#ECFDF5",borderRadius:8,border:"1px solid #6EE7B7"}}>
                        <span style={{fontSize:13,fontWeight:600}}>Total Labor Cost</span>
                        <span style={{fontWeight:700,color:"#065F46"}}>${laborCost.toLocaleString()}</span>
                      </div>
                    </div>}
                    {/* Material / non-labor costs */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontSize:12,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:.4}}>Materials & Expenses</div>
                      <div style={{fontSize:13}}><span style={{fontWeight:600}}>Materials: </span><span style={{fontWeight:700,color:"#92400E"}}>${totalMaterialCost.toLocaleString()}</span>{p.costBudget>0&&<span style={{color:MUTED}}> / ${p.costBudget.toLocaleString()} budget</span>}</div>
                    </div>
                    {pCosts.map(c=>(
                      <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:WHITE,borderRadius:8,border:"1px solid "+BORDER,marginBottom:7}}>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{c.desc}</div><div style={{fontSize:11,color:MUTED}}>{c.category} - {c.date}</div></div>
                        <span style={{fontWeight:700,color:DANGER}}>${c.amount.toLocaleString()}</span>
                        {canEdit&&<button onClick={()=>removeCost(c.id)} style={{border:"none",background:"none",color:MUTED,cursor:"pointer",fontSize:14}}>x</button>}
                      </div>
                    ))}
                    {pCosts.length===0&&<div style={{color:MUTED,fontSize:13,padding:"12px 0",fontStyle:"italic"}}>No material costs logged yet.</div>}
                    {canEdit&&<div style={{display:"grid",gridTemplateColumns:"2fr 100px 120px 80px auto",gap:8,alignItems:"end",marginTop:12,paddingTop:12,borderTop:"1px solid "+BORDER}}>
                      <Inp label="Description" value={cForm.desc} onChange={e=>setCForm(f=>({...f,desc:e.target.value}))} placeholder="Material, license, travel..." small/>
                      <Inp label="Amount ($)" type="number" value={cForm.amount} onChange={e=>setCForm(f=>({...f,amount:e.target.value}))} placeholder="0" small/>
                      <SelF label="Category" value={cForm.category} onChange={e=>setCForm(f=>({...f,category:e.target.value}))} options={["Material","Equipment","License","Travel","Contractor","Other"].map(c=>({value:c,label:c}))} small/>
                      <Inp label="Date" type="date" value={cForm.date} onChange={e=>setCForm(f=>({...f,date:e.target.value}))} small/>
                      <div style={{paddingBottom:14}}><Btn primary small onClick={()=>addCost(p.id)}>Add</Btn></div>
                    </div>}
                    {/* Total cost summary */}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:totalProjectCost>p.costBudget&&p.costBudget>0?"#FEF2F2":"#F8FAFF",borderRadius:8,marginTop:12,border:"1px solid "+(totalProjectCost>p.costBudget&&p.costBudget>0?"#FCA5A5":BORDER)}}>
                      <span style={{fontSize:13,fontWeight:700}}>Total Project Cost (Labor + Materials)</span>
                      <span style={{fontSize:15,fontWeight:700,color:totalProjectCost>p.costBudget&&p.costBudget>0?DANGER:"#065F46"}}>${totalProjectCost.toLocaleString()}</span>
                    </div>
                  </div>}
                  {selTab==="settings"&&canEdit&&<div style={{maxWidth:400}}>
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:600,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.4}}>Billing</div>
                      <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                        <input type="checkbox" checked={p.billable} onChange={e=>toggleBillable(p.id,e.target.checked)} style={{width:16,height:16,accentColor:BLUE}}/>
                        <span style={{fontSize:13}}>This project is billable</span>
                      </label>
                    </div>
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12,fontWeight:600,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.4}}>Project Status</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {["planning","active","review","completed"].map(s=><button key={s} onClick={()=>updateStatus(p.id,s)} style={{padding:"5px 14px",borderRadius:20,border:"1px solid "+BORDER,background:p.status===s?BLUE:WHITE,color:p.status===s?"#fff":TEXT,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:FONT,textTransform:"capitalize"}}>{s}</button>)}
                      </div>
                    </div>
                  </div>}
                </div>
              </div>}
            </Card>
          );
        })}
        {projects.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:MUTED,fontSize:14,fontFamily:FONT}}>No projects yet.</div>}
      </div>
    </div>
  );
}

/* ── Utilization ──────────────────────────────────────────── */
function Utilization({user,employees,allocs,entries,timesheets}){
  const WEEKS=recentWeeks(8);
  const [selWeek,setSelWeek]=useState(WEEKS[WEEKS.length-1]);
  const isAdmin=user.role==="admin",isManager=user.role==="manager";
  const visEmps=isAdmin?employees:isManager?employees.filter(e=>e.teamId===user.teamId||e.managerId===user.employeeId):employees.filter(e=>e.id===user.employeeId);
  const weekStats=visEmps.filter(e=>e.active).map(e=>{const log=entries.filter(en=>en.empId===e.id&&en.week===selWeek).reduce((s,en)=>s+en.hours,0);return{...e,log,util:e.capacity>0?Math.round((log/e.capacity)*100):0};}).sort((a,b)=>b.util-a.util);
  const heatRows=visEmps.filter(e=>e.active).map(e=>({emp:e,cells:WEEKS.map(w=>({week:w,pct:e.capacity>0?Math.round((entries.filter(en=>en.empId===e.id&&en.week===w).reduce((s,en)=>s+en.hours,0)/e.capacity)*100):0,status:timesheets.find(t=>t.empId===e.id&&t.week===w)?.status||"none"}))}));
  return(
    <div style={{fontFamily:FONT}}>
      <div style={{marginBottom:18}}><h1 style={{fontSize:21,fontWeight:700,color:TEXT,margin:"0 0 3px"}}>Utilization</h1><p style={{color:MUTED,fontSize:13,margin:0}}>{visEmps.length} employees</p></div>
      <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
        {WEEKS.map(w=><button key={w} onClick={()=>setSelWeek(w)} style={{padding:"5px 12px",borderRadius:20,border:"1px solid "+(selWeek===w?BLUE:BORDER),background:selWeek===w?BLUE:WHITE,color:selWeek===w?"#fff":MUTED,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:FONT}}>{weekLabel(w).split(", ")[0]}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <Card>
          <SecHd title={"Logged vs Capacity - "+weekLabel(selWeek)}/>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekStats.map(e=>({name:e.name.split(" ")[0],logged:e.log,capacity:e.capacity}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/><XAxis dataKey="name" tick={{fontSize:10,fill:MUTED}}/><YAxis tick={{fontSize:10,fill:MUTED}} unit="h"/>
              <Tooltip/><Legend/>
              <Bar dataKey="capacity" name="Capacity" fill="#E2E8F0" radius={[3,3,0,0]}/>
              <Bar dataKey="logged"   name="Logged"   radius={[3,3,0,0]}>{weekStats.map((d,i)=><Cell key={i} fill={d.util>100?"#7C3AED":d.util>=75?BLUE:d.util>=50?WARN:DANGER}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SecHd title="Summary"/>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {weekStats.map(e=>{const{bg,fg}=utilColor(e.util);const ts=timesheets.find(t=>t.empId===e.id&&t.week===selWeek);return(
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:8}}>
                <Av name={e.name} color={e.color||BLUE} sz={26}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</span><span style={{fontSize:11,color:MUTED}}>{e.log}h/{e.capacity}h</span></div>
                  <Prog val={e.util} h={5}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:11,fontWeight:600,background:bg,color:fg,borderRadius:20,padding:"2px 8px",minWidth:38,textAlign:"center"}}>{e.util}%</span>
                  {ts&&<span style={{fontSize:9,background:TS_STATUS[ts.status]?.bg,color:TS_STATUS[ts.status]?.fg,borderRadius:4,padding:"1px 5px",fontWeight:600}}>{TS_STATUS[ts.status]?.label}</span>}
                </div>
              </div>
            );})}
          </div>
        </Card>
      </div>
      <Card>
        <SecHd title="8-Week Heatmap"/>
        <div style={{fontSize:11,color:MUTED,marginBottom:10,display:"flex",gap:14,flexWrap:"wrap"}}>
          {[["No data","#F1F5F9","#94A3B8"],["Under 50%","#FEF2F2",DANGER],["50-75%","#FFFBEB",WARN],["75-100%","#ECFDF5","#065F46"],["Over 100%","#EDE9FE","#4C1D95"]].map(([lbl,bg,fg])=>(
            <span key={lbl} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:12,height:12,borderRadius:3,background:bg,border:"1px solid "+BORDER,display:"inline-block"}}/><span style={{color:fg,fontWeight:600}}>{lbl}</span></span>
          ))}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",fontSize:12,width:"100%",fontFamily:FONT}}>
            <thead><tr>
              <th style={{padding:"6px 12px",textAlign:"left",fontWeight:600,color:MUTED,minWidth:150}}>Employee</th>
              {WEEKS.map(w=><th key={w} style={{padding:"6px 6px",textAlign:"center",fontWeight:600,color:MUTED,minWidth:72,fontSize:10}}>{weekLabel(w).split(", ")[0]}</th>)}
              <th style={{padding:"6px 8px",textAlign:"center",fontWeight:600,color:MUTED}}>Avg</th>
            </tr></thead>
            <tbody>{heatRows.map(row=>{const valid=row.cells.filter(c=>c.pct>0).map(c=>c.pct);const avg=valid.length?Math.round(valid.reduce((s,v)=>s+v,0)/valid.length):0;return(
              <tr key={row.emp.id}>
                <td style={{padding:"4px 12px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Av name={row.emp.name} color={row.emp.color||BLUE} sz={20}/><span style={{fontWeight:500,fontSize:12}}>{row.emp.name.split(" ")[0]}</span></div></td>
                {row.cells.map(c=>{const{bg,fg}=utilColor(c.pct);return<td key={c.week} style={{padding:"3px 4px",textAlign:"center"}}><div title={c.status!=="none"?TS_STATUS[c.status]?.label||c.status:""} style={{background:bg,color:fg,borderRadius:5,padding:"4px 5px",fontWeight:600,fontSize:10,cursor:c.status!=="none"?"help":"default"}}>{c.pct>0?c.pct+"%":"-"}</div></td>;})}
                <td style={{padding:"3px 6px",textAlign:"center"}}><div style={{background:utilColor(avg).bg,color:utilColor(avg).fg,borderRadius:5,padding:"4px 5px",fontWeight:700,fontSize:10}}>{avg>0?avg+"%":"-"}</div></td>
              </tr>
            );})}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Reports ──────────────────────────────────────────────── */
function Reports({user,employees,projects,allocs,entries,timesheets,leaves}){
  const WEEKS=recentWeeks(8),week=currentWeek();
  const isAdmin=user.role==="admin",isManager=user.role==="manager";
  const visEmps=isAdmin?employees:isManager?employees.filter(e=>e.teamId===user.teamId||e.managerId===user.employeeId):employees.filter(e=>e.id===user.employeeId);
  const totCap=visEmps.reduce((s,e)=>s+e.capacity,0);
  const totLog=entries.filter(e=>visEmps.find(em=>em.id===e.empId)&&e.week===week).reduce((s,e)=>s+e.hours,0);
  const avgUtil=totCap>0?Math.round((totLog/totCap)*100):0;
  const weekData=WEEKS.map(w=>{const cap=visEmps.reduce((s,e)=>s+e.capacity,0),log=entries.filter(e=>e.week===w&&visEmps.find(em=>em.id===e.empId)).reduce((s,e)=>s+e.hours,0);return{week:weekLabel(w).split(", ")[0],logged:log,capacity:cap,util:cap>0?Math.round((log/cap)*100):0};});
  const projData=projects.map(p=>({name:p.name.split(" ").slice(0,2).join(" "),logged:entries.filter(e=>String(e.projId)===String(p.id)).reduce((s,e)=>s+e.hours,0),budget:p.budgetHours||0})).filter(p=>p.logged>0||p.budget>0);
  const totalBilling=visEmps.reduce((s,e)=>{if(!e.billingRate)return s;const log=entries.filter(en=>en.empId===e.id&&en.week===week).reduce((t,en)=>t+en.hours,0);return s+log*e.billingRate;},0);
  const exportAllTS=()=>{const rows=timesheets.filter(t=>visEmps.find(e=>e.id===t.empId)).flatMap(t=>{const emp=visEmps.find(e=>e.id===t.empId);const ents=entries.filter(e=>String(e.empId)===String(t.empId)&&e.week===t.week);if(!ents.length)return[{Employee:emp?.name,Department:emp?.dept,Week:weekLabel(t.week),Day:"",Project:"",Hours:0,Notes:"",Status:t.status,Comment:t.comment||""}];return ents.map(e=>{const p=projects.find(pr=>String(pr.id)===String(e.projId));return{Employee:emp?.name,Department:emp?.dept,Week:weekLabel(t.week),Day:e.day||"(weekly)",Project:p?.name||"",Hours:e.hours,Notes:e.note||"",Status:t.status,Comment:t.comment||""};});});if(!rows.length){alert("No data to export.");return;}csvDownload(rows,"timesheet-export.csv");};
  const exportUtil=()=>csvDownload(visEmps.map(e=>({Name:e.name,Department:e.dept,"Weekly Cap":e.capacity,"This Week":entries.filter(en=>en.empId===e.id&&en.week===week).reduce((s,en)=>s+en.hours,0),"Util%":e.capacity>0?Math.round((entries.filter(en=>en.empId===e.id&&en.week===week).reduce((s,en)=>s+en.hours,0)/e.capacity)*100):0,"Billing Rate":e.billingRate||0})),"utilization.csv");
  return(
    <div style={{fontFamily:FONT}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div><h1 style={{fontSize:21,fontWeight:700,color:TEXT,margin:"0 0 3px"}}>Reports</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Utilization, billing and leave summaries</p></div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={exportUtil}>Utilization CSV</Btn>
          <Btn primary onClick={exportAllTS}>Export Timesheets</Btn>
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <KPI label="Avg Utilization" value={avgUtil+"%" } sub="This week" icon="📊" alert={avgUtil<60}/>
        <KPI label="Approved TS"     value={timesheets.filter(t=>t.status==="approved"&&visEmps.find(e=>e.id===t.empId)).length} sub="All time" icon="✅"/>
        <KPI label="Pending Review"  value={timesheets.filter(t=>t.status==="submitted"&&visEmps.find(e=>e.id===t.empId)).length} sub="Awaiting" icon="⏳" alert/>
        <KPI label="Billed This Week" value={"$"+totalBilling.toLocaleString()} sub="Hours x rate" icon="💰"/>
        <KPI label="Active Projects" value={projects.filter(p=>p.status==="active").length} sub={projects.length+" total"} icon="📁"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <Card>
          <SecHd title="8-Week Trend"/>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekData}><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/><XAxis dataKey="week" tick={{fontSize:10,fill:MUTED}}/><YAxis tick={{fontSize:10,fill:MUTED}} unit="h"/><Tooltip/><Legend/>
              <Bar dataKey="capacity" name="Capacity" fill="#E2E8F0" radius={[3,3,0,0]}/><Bar dataKey="logged" name="Logged" fill={BLUE} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SecHd title="Hours by Project"/>
          {projData.length===0?<div style={{color:MUTED,fontSize:13,textAlign:"center",padding:"40px 0"}}>No project hours logged yet.</div>:
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={projData} layout="vertical" margin={{left:4,right:10}}>
              <XAxis type="number" tick={{fontSize:10,fill:MUTED}}/><YAxis dataKey="name" type="category" tick={{fontSize:10,fill:MUTED}} width={110}/>
              <Tooltip/><Legend/>
              <Bar dataKey="budget" name="Budget" fill="#E2E8F0" radius={[0,3,3,0]}/><Bar dataKey="logged" name="Logged" fill={BLUE} radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>}
        </Card>
      </div>
      <Card style={{marginBottom:14}}>
        <SecHd title="Employee Utilization & Billing"/>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:FONT}}>
          <thead><tr style={{background:"#F8FAFF"}}>{["Employee","Dept","Capacity","This Week","Util%","Rate/hr","Billed This Week","Last TS"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:600,color:MUTED,borderBottom:"1px solid "+BORDER}}>{h}</th>)}</tr></thead>
          <tbody>
            {visEmps.filter(e=>e.active).map(e=>{
              const log=entries.filter(en=>en.empId===e.id&&en.week===week).reduce((s,en)=>s+en.hours,0);
              const util=e.capacity>0?Math.round((log/e.capacity)*100):0;
              const billed=log*(e.billingRate||0);
              const lastTs=timesheets.filter(t=>t.empId===e.id).sort((a,b)=>b.week.localeCompare(a.week))[0];
              const{bg,fg}=utilColor(util);
              return <tr key={e.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                <td style={{padding:"9px 12px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Av name={e.name} color={e.color||BLUE} sz={24}/><span style={{fontWeight:500}}>{e.name}</span></div></td>
                <td style={{padding:"9px 12px",color:MUTED}}>{e.dept}</td>
                <td style={{padding:"9px 12px",fontWeight:500}}>{e.capacity}h</td>
                <td style={{padding:"9px 12px",fontWeight:600,color:BLUE}}>{log}h</td>
                <td style={{padding:"9px 12px"}}><span style={{background:bg,color:fg,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:600}}>{util}%</span></td>
                <td style={{padding:"9px 12px",color:MUTED}}>{e.billingRate>0?"$"+e.billingRate+"/hr":"-"}</td>
                <td style={{padding:"9px 12px",fontWeight:600,color:billed>0?SUCCESS:MUTED}}>{billed>0?"$"+billed.toLocaleString():"-"}</td>
                <td style={{padding:"9px 12px"}}>{lastTs?<span style={{background:TS_STATUS[lastTs.status]?.bg,color:TS_STATUS[lastTs.status]?.fg,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:600}}>{TS_STATUS[lastTs.status]?.label}</span>:<span style={{color:MUTED,fontSize:11}}>None</span>}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
/* ── Leaves ───────────────────────────────────────────────── */
function Leaves({user,employees,leaves,setLeaves}){
  const [form,setForm]=useState({empId:String(user.employeeId||""),type:"Annual",from:"",to:"",reason:""});const [saving,setSaving]=useState(false);
  const isAdmin=user.role==="admin",isManager=user.role==="manager";
  const myLeaves=leaves.filter(l=>String(l.empId)===String(user.employeeId));
  const apply=async()=>{if(!form.from||!form.to||!form.empId)return;const days=Math.max(1,Math.ceil((new Date(form.to)-new Date(form.from))/864e5)+1);setSaving(true);const{data,error}=await sb.from("leaves").insert({employee_id:form.empId,type:form.type,from_date:form.from,to_date:form.to,days,reason:form.reason,status:"pending"}).select().single();setSaving(false);if(!error&&data){setLeaves(prev=>[toLeave(data),...prev]);setForm(f=>({...f,from:"",to:"",reason:""}));}};
  return(
    <div style={{fontFamily:FONT}}>
      <div style={{marginBottom:18}}><h1 style={{fontSize:21,fontWeight:700,color:TEXT,margin:"0 0 3px"}}>My Leaves</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Submit and track leave requests</p></div>
      <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:14}}>
        <Card>
          <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Apply for Leave</div>
          {(isAdmin||isManager)&&<SelF label="Employee" value={form.empId} onChange={e=>setForm(f=>({...f,empId:e.target.value}))} options={[{value:"",label:"Select employee..."},...employees.filter(e=>e.active).map(e=>({value:String(e.id),label:e.name}))]}/>}
          <SelF label="Leave Type" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} options={["Annual","Sick","Casual","Maternity","Paternity"].map(t=>({value:t,label:t}))}/>
          <Inp label="From" type="date" value={form.from} onChange={e=>setForm(f=>({...f,from:e.target.value}))} required/>
          <Inp label="To"   type="date" value={form.to}   onChange={e=>setForm(f=>({...f,to:e.target.value}))}   required/>
          <Inp label="Reason" value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Optional"/>
          <Btn primary full disabled={saving} onClick={apply}>{saving?<><Spin/>Submitting...</>:"Submit Request"}</Btn>
        </Card>
        <Card>
          <SecHd title="My Leave History"/>
          {myLeaves.length===0&&<div style={{color:MUTED,fontSize:13,textAlign:"center",padding:"24px 0"}}>No leave requests yet.</div>}
          {myLeaves.map(l=><div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#F8FAFF",borderRadius:8,marginBottom:7,border:"1px solid "+BORDER}}>
            <div style={{flex:1}}><span style={{fontSize:13,fontWeight:500}}>{l.type} Leave</span><div style={{fontSize:12,color:MUTED}}>{l.from} to {l.to} - {l.days} day{l.days>1?"s":""}</div>{l.reason&&<div style={{fontSize:12,color:MUTED}}>{l.reason}</div>}</div>
            <Badge s={l.status}/>
          </div>)}
        </Card>
      </div>
    </div>
  );
}

/* ── Profile ──────────────────────────────────────────────── */
function Profile({user,setUser}){
  const [form,setForm]=useState({name:user.name||"",phone:user.phone||"",billingRate:user.billingRate||""});
  const [pwdForm,setPwdForm]=useState({newpwd:"",confirm:""});
  const [saving,setSaving]=useState(false);const [pwdSav,setPwdSav]=useState(false);
  const [msg,setMsg]=useState({type:"",text:""});const [pwdMsg,setPwdMsg]=useState({type:"",text:""});
  const saveProfile=async()=>{setSaving(true);const{error}=await sb.from("app_users").update({name:form.name,phone:form.phone}).eq("id",user.id);if(!error&&user.employeeId)await sb.from("employees").update({billing_rate:+form.billingRate||0}).eq("id",user.employeeId);setSaving(false);if(error)setMsg({type:"error",text:error.message});else{setUser(u=>({...u,name:form.name,phone:form.phone,billingRate:+form.billingRate}));setMsg({type:"ok",text:"Profile updated."});}};
  const changePwd=async()=>{if(!pwdForm.newpwd||pwdForm.newpwd.length<8){setPwdMsg({type:"error",text:"Min 8 characters."});return;}if(pwdForm.newpwd!==pwdForm.confirm){setPwdMsg({type:"error",text:"Passwords do not match."});return;}setPwdSav(true);const{error}=await sb.auth.updateUser({password:pwdForm.newpwd});setPwdSav(false);if(error)setPwdMsg({type:"error",text:error.message});else{setPwdMsg({type:"ok",text:"Password changed."});setPwdForm({newpwd:"",confirm:""});}};
  return(
    <div style={{maxWidth:700,fontFamily:FONT}}>
      <div style={{marginBottom:20}}><h1 style={{fontSize:21,fontWeight:700,color:TEXT,margin:"0 0 3px"}}>My Profile</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Manage your account settings</p></div>
      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:22,padding:16,background:"#F8FAFF",borderRadius:9}}>
          <div style={{width:58,height:58,borderRadius:"50%",background:BLUE+"1A",color:BLUE,fontWeight:700,fontSize:22,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid "+BLUE+"33"}}>{(user.name||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}</div>
          <div><div style={{fontSize:17,fontWeight:700}}>{user.name}</div><div style={{fontSize:13,color:MUTED}}>{user.email}</div><div style={{marginTop:6}}><RoleBadge role={user.role}/></div></div>
        </div>
        <Alrt type={msg.type} msg={msg.text}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Inp label="Full Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
          <Inp label="Phone"     value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+1 555 000 0000"/>
          <Inp label="Email" value={user.email||""} disabled/>
          <Inp label="My Billing Rate ($/hr)" type="number" value={form.billingRate} onChange={e=>setForm(f=>({...f,billingRate:e.target.value}))} placeholder="e.g. 150"/>
        </div>
        <Btn primary disabled={saving} onClick={saveProfile}>{saving?<><Spin/>Saving...</>:"Save Changes"}</Btn>
      </Card>
      <Card>
        <div style={{fontSize:15,fontWeight:600,marginBottom:14}}>Change Password</div>
        <Alrt type={pwdMsg.type} msg={pwdMsg.text}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Inp label="New Password"     type="password" value={pwdForm.newpwd}  onChange={e=>setPwdForm(f=>({...f,newpwd:e.target.value}))}  placeholder="Min 8 chars"/>
          <Inp label="Confirm Password" type="password" value={pwdForm.confirm} onChange={e=>setPwdForm(f=>({...f,confirm:e.target.value}))} placeholder="Repeat"/>
        </div>
        <Btn primary disabled={pwdSav} onClick={changePwd}>{pwdSav?<><Spin/>...</>:"Update Password"}</Btn>
      </Card>
    </div>
  );
}

/* ── Teams ────────────────────────────────────────────────── */
function Teams({user,teams,setTeams,employees,setEmployees}){
  const isAdmin=user.role==="admin";
  const [showNew,setShowNew]=useState(false);const [sel,setSel]=useState(null);
  const [form,setForm]=useState({name:"",description:"",managerId:"",color:BLUE});const [loading,setLoading]=useState(false);
  const visTeams=isAdmin?teams:teams.filter(t=>t.managerId===user.employeeId||String(t.managerId)===String(user.employeeId));
  const COLORS=[BLUE,"#7C3AED","#059669","#D97706","#DC2626","#0891B2","#EC4899"];
  const createTeam=async()=>{if(!form.name)return;setLoading(true);const{data,error}=await sb.from("teams").insert({name:form.name,description:form.description,manager_id:form.managerId||null,color:form.color}).select().single();setLoading(false);if(error){alert(error.message);return;}setTeams(prev=>[...prev,{id:data.id,name:data.name,description:data.description||"",managerId:data.manager_id,color:data.color||BLUE,members:[]}]);setForm({name:"",description:"",managerId:"",color:BLUE});setShowNew(false);};
  const addMember=async(teamId,empId)=>{const{error}=await sb.from("team_members").upsert({team_id:teamId,employee_id:empId},{onConflict:"team_id,employee_id"});if(!error){setTeams(prev=>prev.map(t=>t.id===teamId?{...t,members:[...t.members,empId]}:t));setEmployees(prev=>prev.map(e=>e.id===empId||String(e.id)===String(empId)?{...e,teamId}:e));const tm=teams.find(t=>t.id===teamId);await notifyEmp(empId,"You have been added to team \""+( tm?.name||"a team")+"\" by "+user.name,"info");}};
  const removeMember=async(teamId,empId)=>{const{error}=await sb.from("team_members").delete().eq("team_id",teamId).eq("employee_id",empId);if(!error){setTeams(prev=>prev.map(t=>t.id===teamId?{...t,members:t.members.filter(m=>m!==empId)}:t));const tm=teams.find(t=>t.id===teamId);await notifyEmp(empId,"You have been removed from team \""+( tm?.name||"a team")+"\" by "+user.name,"warn");}};
  return(
    <div style={{fontFamily:FONT}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div><h1 style={{fontSize:21,fontWeight:700,color:TEXT,margin:"0 0 3px"}}>Teams</h1><p style={{color:MUTED,fontSize:13,margin:0}}>{visTeams.length} teams</p></div>
        {isAdmin&&<Btn primary onClick={()=>setShowNew(v=>!v)}>+ Create Team</Btn>}
      </div>
      {showNew&&<Card style={{marginBottom:14,border:"1px solid "+BLUE+"44",background:"#F8FAFF"}}>
        <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>New Team</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
          <div style={{paddingRight:12}}><Inp label="Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/><Inp label="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
          <div style={{paddingLeft:12}}>
            <SelF label="Manager" value={form.managerId} onChange={e=>setForm(f=>({...f,managerId:e.target.value}))} options={[{value:"",label:"None yet"},...employees.filter(e=>e.active).map(e=>({value:String(e.id),label:e.name}))]}/>
            <div style={{marginBottom:14}}><label style={{fontSize:12,fontWeight:500,display:"block",marginBottom:8}}>Team Color</label><div style={{display:"flex",gap:6}}>{COLORS.map(c=><div key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid "+TEXT:"3px solid transparent"}}/>)}</div></div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}><Btn primary small disabled={loading} onClick={createTeam}>{loading?<Spin/>:"Create"}</Btn><Btn small onClick={()=>setShowNew(false)}>Cancel</Btn></div>
      </Card>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
        {visTeams.map(t=>{const members=employees.filter(e=>t.members?.includes(e.id)||t.members?.includes(String(e.id)));const manager=employees.find(e=>e.id===t.managerId||String(e.id)===String(t.managerId));const isOpen=sel===t.id;const unassigned=employees.filter(e=>e.active&&!t.members?.includes(e.id)&&!t.members?.includes(String(e.id)));return(
          <Card key={t.id}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:38,height:38,borderRadius:9,background:t.color+"1A",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid "+t.color+"33"}}>🏢</div>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{t.name}</div>{t.description&&<div style={{fontSize:12,color:MUTED}}>{t.description}</div>}</div>
              <button onClick={()=>setSel(isOpen?null:t.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:MUTED}}>{isOpen?"▲":"▼"}</button>
            </div>
            {manager&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#F8FAFF",borderRadius:8,marginBottom:10}}>
              <Av name={manager.name} color={manager.color||BLUE} sz={22}/>
              <div><div style={{fontSize:12,fontWeight:500}}>{manager.name}</div><div style={{fontSize:10,color:MUTED}}>Team Manager</div></div>
            </div>}
            <div style={{display:"flex",gap:3,marginBottom:6,flexWrap:"wrap"}}>{members.slice(0,5).map(m=><Av key={m.id} name={m.name} color={m.color||BLUE} sz={24}/>)}{members.length>5&&<div style={{width:24,height:24,borderRadius:"50%",background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:MUTED}}>+{members.length-5}</div>}</div>
            <div style={{fontSize:12,color:MUTED}}>{members.length} member{members.length!==1?"s":""}</div>
            {isOpen&&isAdmin&&<div style={{marginTop:12,borderTop:"1px solid "+BORDER,paddingTop:12}}>
              {members.map(m=><div key={m.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}><Av name={m.name} color={m.color||BLUE} sz={20}/><span style={{flex:1,fontSize:12,fontWeight:500}}>{m.name}</span><button onClick={()=>removeMember(t.id,m.id)} style={{border:"none",background:"#FEF2F2",color:DANGER,borderRadius:6,padding:"2px 8px",fontSize:11,cursor:"pointer"}}>Remove</button></div>)}
              {unassigned.length>0&&<select defaultValue="" onChange={e=>{if(e.target.value)addMember(t.id,e.target.value);}} style={{width:"100%",padding:"6px 10px",border:"1px solid "+BORDER,borderRadius:6,fontSize:12,marginTop:8,fontFamily:FONT}}><option value="">Add member...</option>{unassigned.map(e=><option key={e.id} value={String(e.id)}>{e.name}</option>)}</select>}
            </div>}
          </Card>
        );})}
        {visTeams.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"60px 0",color:MUTED}}>{isAdmin?"No teams yet.":"You are not managing any teams."}</div>}
      </div>
    </div>
  );
}

/* ── Employees ────────────────────────────────────────────── */
function Employees({user,employees,setEmployees,allocs,teams}){
  const [showInvite,setShowInvite]=useState(false);const [showEdit,setShowEdit]=useState(false);const [editTarget,setEditTarget]=useState(null);const [delTarget,setDelTarget]=useState(null);
  const [loading,setLoading]=useState(false);const [importing,setImporting]=useState(false);
  const [err,setErr]=useState("");const [ok,setOk]=useState("");const [search,setSearch]=useState("");const [fDept,setFDept]=useState("");
  const blank={name:"",email:"",role:"user",department:"",jobTitle:"",capacity:"40",teamId:"",phone:"",billingRate:""};const [form,setForm]=useState(blank);const F=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const depts=[...new Set(employees.map(e=>e.dept))].filter(Boolean);
  const filtered=employees.filter(e=>{const q=search.toLowerCase();return(!q||(e.name||"").toLowerCase().includes(q)||(e.email||"").toLowerCase().includes(q))&&(!fDept||e.dept===fDept);});
  const downloadTemplate=()=>csvDownload([{name:"Jane Smith",email:"jane@company.com",role:"user",department:"Engineering",jobTitle:"Developer",capacity:40,phone:"",billing_rate:150}],"employee-import-template.csv");
  const importCSV=async file=>{
    if(!file)return;setImporting(true);setErr("");setOk("");
    const text=await file.text();const rows=text.trim().split("\n").slice(1);let ok2=0,fail=0;
    for(const row of rows){const cols=row.split(",").map(c=>c.replace(/^"|"$/g,"").trim());const[name,email,role,department,jobTitle,capacity,phone]=cols;if(!name||!email){fail++;continue;}try{const res=await fetch("/api/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,role:role||"user",department,jobTitle,capacity:+capacity||40,phone})});if(res.ok)ok2++;else fail++;}catch{fail++;}}
    setImporting(false);if(ok2>0)setOk(ok2+" employee(s) imported and invite emails sent.");if(fail>0)setErr(fail+" row(s) failed - check emails and format.");
  };
  const sendInvite=async()=>{if(!form.name||!form.email){setErr("Name and email required.");return;}setLoading(true);setErr("");setOk("");
    try{const res=await fetch("/api/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:form.name,email:form.email,role:form.role,department:form.department,jobTitle:form.jobTitle,capacity:+form.capacity||40,teamId:form.teamId||null,phone:form.phone})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Invite failed");
    setEmployees(prev=>[...prev,{id:data.employeeId||Date.now(),name:form.name,email:form.email,dept:form.department,role:form.jobTitle,capacity:+form.capacity||40,active:true,teamId:form.teamId||null,color:deptColor(form.department),appRole:form.role,billingRate:+form.billingRate||0}]);
    setOk("Invite sent to "+form.email);setForm(blank);setShowInvite(false);}catch(e){setErr(e.message);}finally{setLoading(false);}};
  const saveEdit=async()=>{const{error}=await sb.from("employees").update({name:form.name,department:form.department,role:form.jobTitle,capacity:+form.capacity||40,active:form.active!=="false",phone:form.phone,team_id:form.teamId||null,billing_rate:+form.billingRate||0}).eq("id",editTarget.id);if(error){setErr(error.message);return;}if(form.teamId){await sb.from("team_members").upsert({team_id:form.teamId,employee_id:editTarget.id},{onConflict:"team_id,employee_id"});}let upd=false;const{data:au}=await sb.from("app_users").select("id").eq("employee_id",editTarget.id).single();if(au){await sb.from("app_users").update({role:form.role}).eq("id",au.id);upd=true;}if(!upd){const{data:auE}=await sb.from("app_users").select("id").eq("email",editTarget.email).single();if(auE)await sb.from("app_users").update({role:form.role}).eq("id",auE.id);}setEmployees(prev=>prev.map(e=>e.id===editTarget.id?{...e,name:form.name,dept:form.department,role:form.jobTitle,capacity:+form.capacity||40,active:form.active!=="false",phone:form.phone,teamId:form.teamId||null,billingRate:+form.billingRate||0,appRole:form.role}:e));setShowEdit(false);setEditTarget(null);setOk("Employee updated.");};
  const changeRole=async(emp,newRole)=>{let upd=false;const{data:au}=await sb.from("app_users").select("id").eq("employee_id",emp.id).single();if(au){await sb.from("app_users").update({role:newRole}).eq("id",au.id);upd=true;}if(!upd){const{data:auE}=await sb.from("app_users").select("id").eq("email",emp.email).single();if(auE)await sb.from("app_users").update({role:newRole}).eq("id",auE.id);}setEmployees(prev=>prev.map(e=>e.id===emp.id?{...e,appRole:newRole}:e));};
  const toggleActive=async emp=>{const{error}=await sb.from("employees").update({active:!emp.active}).eq("id",emp.id);if(!error)setEmployees(prev=>prev.map(e=>e.id===emp.id?{...e,active:!e.active}:e));};
  const deleteEmp=async emp=>{const{error}=await sb.from("employees").delete().eq("id",emp.id);if(!error){setEmployees(prev=>prev.filter(e=>e.id!==emp.id));setDelTarget(null);}else setErr(error.message);};
  const openEdit=emp=>{setForm({name:emp.name,email:emp.email,role:emp.appRole||"user",department:emp.dept,jobTitle:emp.role,capacity:String(emp.capacity),teamId:emp.teamId||"",phone:emp.phone||"",billingRate:String(emp.billingRate||""),active:String(emp.active)});setEditTarget(emp);setShowEdit(true);};
  return(
    <div style={{fontFamily:FONT}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div><h1 style={{fontSize:21,fontWeight:700,color:TEXT,margin:"0 0 3px"}}>Employees</h1><p style={{color:MUTED,fontSize:13,margin:0}}>{employees.filter(e=>e.active).length} active / {employees.length} total</p></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <label style={{padding:"7px 14px",borderRadius:7,border:"1px solid "+BORDER,background:WHITE,fontSize:12,fontWeight:500,cursor:importing?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:5,opacity:importing?0.6:1,fontFamily:FONT}}>
            {importing?<><Spin dark/>Importing...</>:"📥 Import CSV"}
            <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importCSV(e.target.files[0]);e.target.value="";}}/>
          </label>
          <Btn onClick={downloadTemplate}>📋 Template</Btn>
          <Btn primary onClick={()=>{setForm(blank);setErr("");setOk("");setShowInvite(true);}}>+ Invite Employee</Btn>
        </div>
      </div>
      {ok&&<Alrt type="ok" msg={ok}/>}
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employees..." style={{flex:1,padding:"8px 14px",border:"1px solid "+BORDER,borderRadius:7,fontSize:13,fontFamily:FONT}}/>
        <select value={fDept} onChange={e=>setFDept(e.target.value)} style={{padding:"8px 14px",border:"1px solid "+BORDER,borderRadius:7,fontSize:13,minWidth:160,fontFamily:FONT}}>
          <option value="">All Departments</option>{depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <Card style={{padding:0,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:FONT}}>
          <thead><tr style={{background:"#F8FAFF"}}>{["Employee","Department","Job Title","Cap","Rate","Team","Role","Status","Actions"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:MUTED,borderBottom:"1px solid "+BORDER}}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(e=>{const team=teams.find(t=>t.id===e.teamId||String(t.id)===String(e.teamId));return(
              <tr key={e.id} style={{borderBottom:"1px solid #F1F5F9",opacity:e.active?1:.5}}>
                <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><Av name={e.name} color={e.color||BLUE} sz={28}/><div><div style={{fontWeight:500}}>{e.name}</div><div style={{fontSize:11,color:MUTED}}>{e.email}</div></div></div></td>
                <td style={{padding:"10px 14px"}}><span style={{background:(e.color||BLUE)+"1A",color:e.color||BLUE,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:500}}>{e.dept||"-"}</span></td>
                <td style={{padding:"10px 14px",color:MUTED,fontSize:12}}>{e.role||"-"}</td>
                <td style={{padding:"10px 14px",fontWeight:500}}>{e.capacity}h</td>
                <td style={{padding:"10px 14px",color:MUTED,fontSize:12}}>{e.billingRate>0?"$"+e.billingRate+"/hr":"-"}</td>
                <td style={{padding:"10px 14px",color:MUTED,fontSize:12}}>{team?.name||"-"}</td>
                <td style={{padding:"8px 14px"}}>
                  <select value={e.appRole||"user"} onChange={ev=>changeRole(e,ev.target.value)} style={{padding:"5px 8px",border:"1px solid "+BORDER,borderRadius:6,fontSize:11,fontWeight:500,background:ROLE_C[e.appRole||"user"]+"1A",color:ROLE_C[e.appRole||"user"],cursor:"pointer",fontFamily:FONT}}>
                    <option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option>
                  </select>
                </td>
                <td style={{padding:"10px 14px"}}><Badge s={e.active?"active":"inactive"}/></td>
                <td style={{padding:"10px 14px"}}><div style={{display:"flex",gap:5}}>
                  <Btn small onClick={()=>openEdit(e)}>Edit</Btn>
                  <Btn small onClick={()=>toggleActive(e)} style={{background:e.active?"#FFFBEB":"#ECFDF5",color:e.active?WARN:SUCCESS,border:"1px solid "+(e.active?"#FDE68A":"#6EE7B7")}}>{e.active?"Deactivate":"Activate"}</Btn>
                  <Btn small danger onClick={()=>setDelTarget(e)}>Delete</Btn>
                </div></td>
              </tr>
            );})}
            {filtered.length===0&&<tr><td colSpan={9} style={{padding:"32px",textAlign:"center",color:MUTED}}>No employees found.</td></tr>}
          </tbody>
        </table>
      </Card>
      {showInvite&&<Modal title="Invite New Employee" onClose={()=>setShowInvite(false)} width={560}>
        {err&&<Alrt type="error" msg={err}/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
          <div style={{paddingRight:12}}>
            <Inp label="Full Name" value={form.name} onChange={F("name")} required placeholder="Jane Smith"/>
            <Inp label="Work Email" type="email" value={form.email} onChange={F("email")} required placeholder="jane@company.com"/>
            <Inp label="Phone" value={form.phone} onChange={F("phone")} placeholder="+1 555 000 0000"/>
            <Inp label="Weekly Capacity (hrs)" type="number" value={form.capacity} onChange={F("capacity")} placeholder="40"/>
          </div>
          <div style={{paddingLeft:12}}>
            <Inp label="Department" value={form.department} onChange={F("department")} placeholder="Engineering"/>
            <Inp label="Job Title"  value={form.jobTitle}   onChange={F("jobTitle")}   placeholder="Developer"/>
            <Inp label="Billing Rate ($/hr)" type="number" value={form.billingRate} onChange={F("billingRate")} placeholder="0"/>
            <SelF label="System Role" value={form.role} onChange={F("role")} options={[{value:"user",label:"User"},{value:"manager",label:"Manager"},{value:"admin",label:"Admin"}]}/>
            <SelF label="Team" value={form.teamId} onChange={F("teamId")} options={[{value:"",label:"No team yet"},...teams.map(t=>({value:String(t.id),label:t.name}))]}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:8,paddingTop:14,borderTop:"1px solid "+BORDER}}>
          <Btn primary full disabled={loading} onClick={sendInvite}>{loading?<><Spin/>Sending...</>:"Send Invite Email"}</Btn>
          <Btn full onClick={()=>setShowInvite(false)}>Cancel</Btn>
        </div>
        <div style={{marginTop:12,fontSize:12,color:MUTED,background:"#F8FAFF",borderRadius:8,padding:"10px 12px"}}>The employee receives an email to set their password and access ResTrack.</div>
      </Modal>}
      {showEdit&&editTarget&&<Modal title={"Edit: "+editTarget.name} onClose={()=>{setShowEdit(false);setEditTarget(null);}}>
        {err&&<Alrt type="error" msg={err}/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
          <div style={{paddingRight:12}}>
            <Inp label="Full Name" value={form.name} onChange={F("name")} required/>
            <Inp label="Department" value={form.department} onChange={F("department")}/>
            <Inp label="Job Title"  value={form.jobTitle}   onChange={F("jobTitle")}/>
            <Inp label="Phone"      value={form.phone}      onChange={F("phone")}/>
          </div>
          <div style={{paddingLeft:12}}>
            <Inp label="Weekly Capacity" type="number" value={form.capacity} onChange={F("capacity")}/>
            <Inp label="Billing Rate ($/hr)" type="number" value={form.billingRate} onChange={F("billingRate")} placeholder="0"/>
            <SelF label="System Role" value={form.role} onChange={F("role")} options={[{value:"user",label:"User"},{value:"manager",label:"Manager"},{value:"admin",label:"Admin"}]}/>
            <SelF label="Team" value={form.teamId||""} onChange={F("teamId")} options={[{value:"",label:"No team"},...teams.map(t=>({value:String(t.id),label:t.name}))]}/>
            <SelF label="Status" value={form.active} onChange={F("active")} options={[{value:"true",label:"Active"},{value:"false",label:"Inactive"}]}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:8,paddingTop:14,borderTop:"1px solid "+BORDER}}>
          <Btn primary full onClick={saveEdit}>Save Changes</Btn>
          <Btn full onClick={()=>{setShowEdit(false);setEditTarget(null);}}>Cancel</Btn>
        </div>
      </Modal>}
      {delTarget&&<Modal title="Delete Employee" onClose={()=>setDelTarget(null)} width={400}>
        <p style={{fontSize:13,color:TEXT,marginBottom:20}}>Permanently delete <strong>{delTarget.name}</strong>? This cannot be undone.</p>
        <div style={{display:"flex",gap:10}}><Btn danger full onClick={()=>deleteEmp(delTarget)}>Yes, Delete</Btn><Btn full onClick={()=>setDelTarget(null)}>Cancel</Btn></div>
      </Modal>}
    </div>
  );
}

/* ── NotifPanel ───────────────────────────────────────────── */
function NotifPanel({notifs,setNotifs,onClose}){
  const markAll=async()=>{await sb.from("notifications").update({read:true}).eq("read",false);setNotifs(prev=>prev.map(n=>({...n,read:true})));};
  const ICONS={success:"✅",warn:"⚠️",timesheet:"📋",info:"🔔"};
  return(
    <div style={{position:"fixed",top:0,right:0,width:360,height:"100vh",background:WHITE,boxShadow:"-4px 0 30px rgba(0,0,0,.12)",zIndex:500,display:"flex",flexDirection:"column",fontFamily:FONT}}>
      <div style={{padding:"16px 20px",borderBottom:"1px solid "+BORDER,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:14,fontWeight:600,color:TEXT}}>Notifications</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={markAll} style={{fontSize:12,color:BLUE,background:"none",border:"none",cursor:"pointer",fontWeight:500,fontFamily:FONT}}>Mark all read</button>
          <button onClick={onClose} style={{border:"none",background:"none",fontSize:18,cursor:"pointer",color:MUTED}}>x</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14}}>
        {notifs.length===0&&<div style={{textAlign:"center",color:MUTED,fontSize:13,padding:"40px 0"}}>No notifications</div>}
        {notifs.map(n=><div key={n.id} style={{display:"flex",gap:10,padding:"10px 12px",borderRadius:8,marginBottom:7,background:n.read?"#F8FAFC":"#EFF6FF",border:"1px solid "+(n.read?BORDER:BLUE+"33")}}>
          <span style={{fontSize:16,flexShrink:0}}>{ICONS[n.type]||"🔔"}</span>
          <div style={{flex:1}}><div style={{fontSize:13,color:TEXT,lineHeight:1.4}}>{n.message}</div><div style={{fontSize:11,color:MUTED,marginTop:3}}>{n.createdAt?new Date(n.createdAt).toLocaleString():""}</div></div>
        </div>)}
      </div>
    </div>
  );
}

/* ── ROOT APP ─────────────────────────────────────────────── */
export default function App(){
  const [session,setSession]=useState(null);const [authLoading,setAuthLoading]=useState(true);
  const [user,setUser]=useState(null);const [view,setView]=useState("dashboard");const [dataLoading,setDataLoading]=useState(false);
  const [employees,setEmployees]=useState([]);const [projects,setProjects]=useState([]);const [allocs,setAllocs]=useState([]);
  const [entries,setEntries]=useState([]);const [leaves,setLeaves]=useState([]);const [teams,setTeams]=useState([]);
  const [timesheets,setTimesheets]=useState([]);const [notifs,setNotifs]=useState([]);const [showNotifs,setShowNotifs]=useState(false);
  const [allTasks,setAllTasks]=useState([]);const [allCosts,setAllCosts]=useState([]);
  const [showSetPwd,setShowSetPwd]=useState(()=>sessionStorage.getItem("rt_needs_pwd")==="1");

  useEffect(()=>{
    sb.auth.getSession().then(({data:{session:s}})=>{setSession(s);setAuthLoading(false);});
    const{data:{subscription}}=sb.auth.onAuthStateChange((event,s)=>{setSession(s);if(event==="PASSWORD_RECOVERY"){sessionStorage.setItem("rt_needs_pwd","1");setShowSetPwd(true);}if(event==="SIGNED_IN"&&(window.location.hash.includes("type=invite")||window.location.search.includes("type=invite")||sessionStorage.getItem("rt_needs_pwd")==="1")){sessionStorage.setItem("rt_needs_pwd","1");setShowSetPwd(true);}});
    return()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{if(!session){setUser(null);return;}loadAll(session.user);},[session]);

  async function loadAll(authUser){
    setDataLoading(true);
    let{data:profile}=await sb.from("app_users").select("*").eq("id",authUser.id).single();
    if(!profile){
      const meta=authUser.user_metadata||{};let empId=null;
      const{data:existEmp}=await sb.from("employees").select("id").eq("email",authUser.email).single();
      if(existEmp){empId=existEmp.id;}else{const{data:newEmp}=await sb.from("employees").insert({name:meta.name||authUser.email?.split("@")[0]||"User",email:authUser.email,department:"Management",role:"Administrator",capacity:40,active:true}).select().single();if(newEmp)empId=newEmp.id;}
      await sb.from("app_users").upsert({id:authUser.id,name:meta.name||authUser.email?.split("@")[0]||"User",email:authUser.email,role:"admin",employee_id:empId,is_active:true,avatar_color:BLUE},{onConflict:"id"});
      const{data:np}=await sb.from("app_users").select("*").eq("id",authUser.id).single();profile=np;
    }
    if(profile&&profile.role!=="admin"){const{count:ac}=await sb.from("app_users").select("id",{count:"exact",head:true}).eq("role","admin");if((ac||0)===0){await sb.from("app_users").update({role:"admin"}).eq("id",authUser.id);profile={...profile,role:"admin"};}}
    if(profile&&!profile.employee_id){const{data:empByEmail}=await sb.from("employees").select("id").eq("email",authUser.email).single();if(empByEmail){await sb.from("app_users").update({employee_id:empByEmail.id}).eq("id",authUser.id);profile={...profile,employee_id:empByEmail.id};}else{const{data:newEmp}=await sb.from("employees").insert({name:profile.name||authUser.email?.split("@")[0]||"User",email:authUser.email,department:"Management",role:"Administrator",capacity:40,active:true}).select().single();if(newEmp){await sb.from("app_users").update({employee_id:newEmp.id}).eq("id",authUser.id);profile={...profile,employee_id:newEmp.id};}}}
    const u={id:authUser.id,email:authUser.email,name:profile?.name||authUser.user_metadata?.name||authUser.email?.split("@")[0]||"User",role:profile?.role||"user",teamId:profile?.team_id||null,employeeId:profile?.employee_id||null,avatarColor:profile?.avatar_color||BLUE,phone:profile?.phone||"",billingRate:+(profile?.billing_rate||0)};
    setUser(u);
    const isAdmin=u.role==="admin",isManager=u.role==="manager";
    const[empR,projR,allocR,entryR,leaveR,teamR,memberR,tsR,notifR,appUR,taskR,costR]=await Promise.all([sb.from("employees").select("*").order("name"),sb.from("projects").select("*").order("name"),sb.from("allocations").select("*"),sb.from("time_entries").select("*"),sb.from("leaves").select("*").order("created_at",{ascending:false}),sb.from("teams").select("*").order("name"),sb.from("team_members").select("*"),sb.from("timesheets").select("*"),sb.from("notifications").select("*").eq("user_id",authUser.id).order("created_at",{ascending:false}).limit(30),sb.from("app_users").select("id,role,employee_id"),sb.from("project_tasks").select("*").eq("status","active"),sb.from("project_costs").select("*").order("date",{ascending:false})]);
    const allEmps=(empR.data||[]).map(toEmp),allTeams=(teamR.data||[]).map(toTeam),members=memberR.data||[],appU=appUR.data||[];
    allTeams.forEach(t=>{t.members=members.filter(m=>m.team_id===t.id).map(m=>m.employee_id);});
    allEmps.forEach(e=>{const au=appU.find(a=>a.employee_id===e.id);if(au)e.appRole=au.role;});
    const visEmps=isAdmin?allEmps:isManager?allEmps.filter(e=>e.teamId===u.teamId||e.managerId===u.employeeId||e.id===u.employeeId):allEmps.filter(e=>e.id===u.employeeId);
    setEmployees(visEmps);setProjects((projR.data||[]).map(toProj));setAllocs((allocR.data||[]).map(toAlloc));
    setEntries((entryR.data||[]).map(toEntry).filter(e=>isAdmin||visEmps.find(em=>em.id===e.empId)));
    setLeaves((leaveR.data||[]).map(toLeave).filter(l=>isAdmin||visEmps.find(e=>e.id===l.empId)));
    setTeams(allTeams);setTimesheets((tsR.data||[]).map(toTs).filter(t=>isAdmin||visEmps.find(e=>e.id===t.empId)));
    setNotifs((notifR.data||[]).map(toNotif));setAllTasks((taskR.data||[]).map(toTask));setAllCosts((costR.data||[]).map(toCost));setDataLoading(false);
  }

  const logout=async()=>{await sb.auth.signOut();setSession(null);setUser(null);};
  const isAdmin=user?.role==="admin",isManager=user?.role==="manager";
  const unread=notifs.filter(n=>!n.read).length;
  const pendingCount=(isAdmin||isManager)?(timesheets.filter(t=>{if(t.status!=="submitted")return false;const e=employees.find(em=>em.id===t.empId);return isAdmin||e?.managerId===user?.employeeId||e?.teamId===user?.teamId;}).length+leaves.filter(l=>{if(l.status!=="pending")return false;const e=employees.find(em=>em.id===l.empId);return isAdmin||e?.managerId===user?.employeeId||e?.teamId===user?.teamId;}).length):0;

  const nav=[
    {id:"dashboard",  label:"Dashboard",  icon:"📊"},
    ...(isAdmin||isManager?[{id:"teams",      label:"Teams",       icon:"🏢"}]:[]),
    ...(isAdmin           ?[{id:"employees",  label:"Employees",   icon:"👥"}]:[]),
    ...(isAdmin||isManager?[{id:"projects",   label:"Projects",    icon:"📁"}]:[]),
    ...(isAdmin||isManager?[{id:"approvals",  label:"Approvals",   icon:"✅",badge:pendingCount}]:[]),
    {id:"timesheets", label:"Timesheets", icon:"⏱️"},
    {id:"utilization",label:"Utilization",icon:"📈"},
    ...(isAdmin||isManager?[{id:"reports",    label:"Reports",     icon:"📊"}]:[]),
    {id:"leaves",     label:"My Leaves",  icon:"📅"},
    {id:"profile",    label:"My Profile", icon:"👤"},
  ];

  const LoadScr=(m)=><div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:BG,flexDirection:"column",gap:12,fontFamily:FONT}}><Spin dark/><div style={{fontSize:13,color:MUTED}}>{m||"Loading..."}</div></div>;
  if(authLoading)return LoadScr();
  if(showSetPwd&&session)return<><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style><SetPasswordScreen onDone={()=>{sessionStorage.removeItem("rt_needs_pwd");window.history.replaceState({},"",window.location.pathname);setShowSetPwd(false);}}/></>;
  if(showSetPwd&&!session)return LoadScr("Processing your invite link...");
  if(!session||!user)return<><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style><LoginPage/></>;
  if(dataLoading)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:BG,flexDirection:"column",gap:12,fontFamily:FONT}}><Spin dark/><div style={{fontSize:13,color:MUTED}}>Loading your workspace...</div></div>;

  return(
    <>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}} *{font-family:'Aptos','Segoe UI',system-ui,sans-serif}"}</style>
      <div style={{display:"flex",fontFamily:FONT,background:BG,minHeight:"100vh"}}>
        {/* Blue Sidebar */}
        <aside style={{width:225,background:NAV,position:"sticky",top:0,height:"100vh",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
          {/* Logo */}
          <div style={{padding:"16px 14px 12px",borderBottom:"1px solid rgba(255,255,255,.12)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:15,border:"1px solid rgba(255,255,255,.3)"}}>R</div>
                <div><div style={{color:"#fff",fontWeight:700,fontSize:15}}>ResTrack</div><div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>Resource Management</div></div>
              </div>
              <button onClick={()=>setShowNotifs(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",position:"relative",padding:3}}>
                <span style={{fontSize:18}}>🔔</span>
                {unread>0&&<span style={{position:"absolute",top:-1,right:-1,background:DANGER,color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:8,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}
              </button>
            </div>
          </div>
          {/* User pill */}
          <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,.1)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"rgba(255,255,255,.1)",borderRadius:8}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,.2)",color:"#fff",fontWeight:700,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1.5px solid rgba(255,255,255,.3)"}}>{(user.name||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,color:"#fff",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.5)",textTransform:"capitalize"}}>{user.role}</div>
              </div>
            </div>
          </div>
          {/* Nav links */}
          <nav style={{flex:1,padding:"8px 8px"}}>
            {nav.map(item=>(
              <button key={item.id} onClick={()=>setView(item.id)} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 10px",borderRadius:8,border:"none",cursor:"pointer",background:view===item.id?"rgba(255,255,255,.18)":"transparent",color:view===item.id?"#fff":"rgba(255,255,255,.6)",fontSize:13,fontWeight:view===item.id?600:400,marginBottom:2,transition:"all .15s",textAlign:"left",fontFamily:FONT,borderLeft:view===item.id?"3px solid rgba(255,255,255,.7)":"3px solid transparent"}}>
                <span style={{fontSize:14,width:18,textAlign:"center"}}>{item.icon}</span>
                <span style={{flex:1}}>{item.label}</span>
                {item.badge>0&&<span style={{background:DANGER,color:"#fff",borderRadius:999,padding:"1px 6px",fontSize:9,fontWeight:700}}>{item.badge}</span>}
              </button>
            ))}
          </nav>
          <div style={{padding:"10px 14px",borderTop:"1px solid rgba(255,255,255,.1)"}}>
            <button onClick={logout} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",borderRadius:8,border:"none",cursor:"pointer",background:"transparent",color:"rgba(255,255,255,.5)",fontSize:12,fontFamily:FONT}} onMouseEnter={e=>e.currentTarget.style.color="#fff"} onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.5)"}>
              <span>🚪</span>Sign Out
            </button>
          </div>
        </aside>
        {/* Main content */}
        <main style={{flex:1,padding:28,overflowX:"hidden",maxWidth:"calc(100vw - 225px)"}}>
          {view==="dashboard"   &&<Dashboard    user={user} employees={employees} projects={projects} allocs={allocs} entries={entries} leaves={leaves} timesheets={timesheets} teams={teams} setView={setView} setUser={setUser}/>}
          {view==="employees"   &&<Employees    user={user} employees={employees} setEmployees={setEmployees} allocs={allocs} teams={teams}/>}
          {view==="teams"       &&<Teams        user={user} teams={teams} setTeams={setTeams} employees={employees} setEmployees={setEmployees}/>}
          {view==="projects"    &&<Projects     user={user} projects={projects} setProjects={setProjects} allocs={allocs} setAllocs={setAllocs} employees={employees} entries={entries} allTasks={allTasks} setAllTasks={setAllTasks} allCosts={allCosts} setAllCosts={setAllCosts}/>}
          {view==="approvals"   &&<Approvals    user={user} employees={employees} timesheets={timesheets} setTimesheets={setTimesheets} leaves={leaves} setLeaves={setLeaves} entries={entries} projects={projects}/>}
          {view==="timesheets"  &&<Timesheets   user={user} employees={employees} projects={projects} entries={entries} setEntries={setEntries} timesheets={timesheets} setTimesheets={setTimesheets} allTasks={allTasks} setView={setView}/>}
          {view==="utilization" &&<Utilization  user={user} employees={employees} allocs={allocs} entries={entries} timesheets={timesheets}/>}
          {view==="reports"     &&<Reports      user={user} employees={employees} projects={projects} allocs={allocs} entries={entries} timesheets={timesheets} leaves={leaves}/>}
          {view==="leaves"      &&<Leaves       user={user} employees={employees} leaves={leaves} setLeaves={setLeaves}/>}
          {view==="profile"     &&<Profile      user={user} setUser={setUser}/>}
        </main>
        {showNotifs&&<NotifPanel notifs={notifs} setNotifs={setNotifs} onClose={()=>setShowNotifs(false)}/>}
      </div>
    </>
  );
}