import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

function currentWeek() {
  const now=new Date(), jan1=new Date(now.getFullYear(),0,1);
  const wk=Math.ceil(((now-jan1)/864e5+jan1.getDay()+1)/7);
  return now.getFullYear()+"-W"+String(wk).padStart(2,"0");
}
function addWeeks(w,n){
  const [yr,wn]=w.split("-W");
  const base=new Date(parseInt(yr),0,4);
  const week1Mon=new Date(base); week1Mon.setDate(base.getDate()-((base.getDay()+6)%7));
  const target=new Date(week1Mon.getTime()+(parseInt(wn)-1+n)*7*864e5);
  const jan4t=new Date(target.getFullYear(),0,4);
  const w1Mt=new Date(jan4t); w1Mt.setDate(jan4t.getDate()-((jan4t.getDay()+6)%7));
  const wk=Math.floor((target-w1Mt)/(7*864e5))+1;
  return target.getFullYear()+"-W"+String(wk).padStart(2,"0");
}
function recentWeeks(n) { const cw=currentWeek(); return Array.from({length:n},(_,i)=>addWeeks(cw,-(n-1-i))); }
async function notifyEmp(empId,message,type) {
  const {data}=await sb.from("app_users").select("id").eq("employee_id",empId).single();
  if(data) await sb.from("notifications").insert({user_id:data.id,message,type:type||"info",read:false});
}
function csvDownload(rows,filename) {
  const keys=Object.keys(rows[0]||{});
  const lines=[keys.join(","),...rows.map(r=>keys.map(k=>JSON.stringify(r[k]??"")).join(","))];
  const a=document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(lines.join("\n")); a.download=filename; a.click();
}

const NAV="#0D1B2A",TEAL="#06D6A0",BG="#F0F4F8",WHITE="#FFFFFF",TEXT="#1C2B3A",MUTED="#64748B",BORDER="#E2E8F0";
const ROLE_C={admin:"#8B5CF6",manager:"#3B82F6",user:"#10B981"};
const DEPT_C={Engineering:"#3B82F6",Design:"#8B5CF6",Product:"#F59E0B",QA:"#10B981",HR:"#EC4899",Finance:"#F97316",Marketing:"#06D6A0"};
const deptColor=d=>DEPT_C[d]||"#64748B";
const AVA_COLORS=["#06D6A0","#8B5CF6","#3B82F6","#F59E0B","#EF4444","#10B981","#EC4899","#F97316"];
const TS_STATUS={
  draft:    {bg:"#F1F5F9",fg:"#475569",label:"Draft",     icon:"📝"},
  submitted:{bg:"#FEF3C7",fg:"#92400E",label:"Submitted", icon:"⏳"},
  approved: {bg:"#D1FAE5",fg:"#065F46",label:"Approved",  icon:"✅"},
  rejected: {bg:"#FEE2E2",fg:"#991B1B",label:"Returned",  icon:"↩️"},
};
function utilColor(p) {
  if(p===0)  return {bg:"#F1F5F9",fg:"#94A3B8"};
  if(p<50)   return {bg:"#FEE2E2",fg:"#991B1B"};
  if(p<75)   return {bg:"#FEF3C7",fg:"#92400E"};
  if(p<=100) return {bg:"#D1FAE5",fg:"#065F46"};
  return            {bg:"#EDE9FE",fg:"#4C1D95"};
}

const toEmp  =r=>({id:r.id,name:r.name||"",email:r.email||"",dept:r.department||"",role:r.role||"",capacity:r.capacity||40,active:r.active!==false,teamId:r.team_id||null,managerId:r.manager_id||null,phone:r.phone||"",appRole:"user",color:deptColor(r.department)});
const toProj =r=>({id:r.id,name:r.name,client:r.client||"",status:r.status||"planning",start:r.start_date||"",end:r.end_date||"",budgetHours:r.budget_hours||0});
const toAlloc=r=>({id:r.id,empId:r.employee_id,projId:r.project_id,hoursPerWeek:r.hours_per_week});
const toEntry=r=>({id:r.id,empId:r.employee_id,projId:r.project_id,week:r.week,hours:Number(r.hours),note:r.note||"",tsId:r.timesheet_id||null});
const toLeave=r=>({id:r.id,empId:r.employee_id,type:r.type,from:r.from_date,to:r.to_date,days:r.days,status:r.status,reason:r.reason||""});
const toTeam =r=>({id:r.id,name:r.name,description:r.description||"",managerId:r.manager_id||null,color:r.color||TEAL,members:[]});
const toTs   =r=>({id:r.id,empId:r.employee_id,week:r.week,status:r.status||"draft",totalHours:Number(r.total_hours||0),comment:r.comment||"",reviewedBy:r.reviewed_by||null,submittedAt:r.submitted_at||null,reviewedAt:r.reviewed_at||null});
const toNotif=r=>({id:r.id,message:r.message,type:r.type||"info",read:r.read||false,createdAt:r.created_at});

function Av({name="?",color=TEAL,sz=32}){const i=(name).split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();return <div style={{width:sz,height:sz,borderRadius:"50%",background:color+"22",color,fontWeight:700,fontSize:sz*.33,display:"flex",alignItems:"center",justifyContent:"center",border:"1.5px solid "+color+"44",flexShrink:0}}>{i}</div>;}
function RoleBadge({role}){const c=ROLE_C[role]||MUTED;return <span style={{background:c+"22",color:c,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,textTransform:"capitalize"}}>{role}</span>;}
const SM={active:{bg:"#D1FAE5",fg:"#065F46",label:"Active"},inactive:{bg:"#F3F4F6",fg:"#6B7280",label:"Inactive"},pending:{bg:"#FEF3C7",fg:"#92400E",label:"Pending"},approved:{bg:"#D1FAE5",fg:"#065F46",label:"Approved"},rejected:{bg:"#FEE2E2",fg:"#991B1B",label:"Rejected"},planning:{bg:"#DBEAFE",fg:"#1E40AF",label:"Planning"},review:{bg:"#FEF3C7",fg:"#92400E",label:"In Review"},completed:{bg:"#F3F4F6",fg:"#374151",label:"Completed"}};
function Badge({s}){const st=SM[s]||{bg:"#F3F4F6",fg:"#374151",label:s};return <span style={{background:st.bg,color:st.fg,borderRadius:999,padding:"2px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{st.label}</span>;}
function Prog({val,h=6}){const clr=val>100?"#8B5CF6":val>=75?TEAL:val>=50?"#F59E0B":"#EF4444";return <div style={{background:BORDER,borderRadius:999,height:h,overflow:"hidden",width:"100%"}}><div style={{width:Math.min(val,100)+"%",height:"100%",borderRadius:999,background:clr,transition:"width .3s"}}/></div>;}
function Card({children,style={}}){return <div style={{background:WHITE,border:"1px solid "+BORDER,borderRadius:12,padding:20,...style}}>{children}</div>;}
function SecHd({title,action}){return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}><span style={{fontSize:14,fontWeight:700,color:TEXT}}>{title}</span>{action}</div>;}
function Btn({children,onClick,primary,danger,ghost,small,full,disabled,style:s={}}){return <button onClick={onClick} disabled={disabled} style={{display:"flex",alignItems:"center",gap:6,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.55:1,padding:small?"5px 12px":"8px 16px",borderRadius:8,fontSize:small?12:13,fontWeight:500,width:full?"100%":undefined,justifyContent:full?"center":undefined,border:primary?"none":danger?"1px solid #FCA5A5":ghost?"none":"1px solid "+BORDER,background:primary?TEAL:danger?"#FEE2E2":ghost?"transparent":WHITE,color:primary?"#fff":danger?"#991B1B":TEXT,...s}}>{children}</button>;}
function Inp({label,type="text",value,onChange,placeholder,required,disabled}){return <div style={{marginBottom:14}}>{label&&<label style={{fontSize:12,fontWeight:600,color:TEXT,display:"block",marginBottom:5}}>{label}{required&&<span style={{color:"#EF4444"}}> *</span>}</label>}<input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} style={{width:"100%",padding:"10px 14px",border:"1.5px solid "+BORDER,borderRadius:8,fontSize:14,color:TEXT,background:disabled?"#F8FAFC":WHITE,boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor=TEAL} onBlur={e=>e.target.style.borderColor=BORDER}/></div>;}
function SelF({label,value,onChange,options,required}){return <div style={{marginBottom:14}}>{label&&<label style={{fontSize:12,fontWeight:600,color:TEXT,display:"block",marginBottom:5}}>{label}{required&&<span style={{color:"#EF4444"}}> *</span>}</label>}<select value={value} onChange={onChange} style={{width:"100%",padding:"10px 14px",border:"1.5px solid "+BORDER,borderRadius:8,fontSize:14,color:TEXT,background:WHITE,boxSizing:"border-box"}}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;}
function Spin({dark}){return <span style={{display:"inline-block",width:15,height:15,border:"2px solid "+(dark?"#e2e8f0aa":"#ffffff55"),borderTop:"2px solid "+(dark?TEAL:"#fff"),borderRadius:"50%",animation:"spin .7s linear infinite"}}/>;}
function Modal({title,onClose,children,width=480}){return <div style={{position:"fixed",inset:0,background:"#00000066",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}><div style={{background:WHITE,borderRadius:14,padding:28,width:"100%",maxWidth:width,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px #0000002a"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}><span style={{fontSize:17,fontWeight:700,color:TEXT}}>{title}</span><button onClick={onClose} style={{border:"none",background:"none",fontSize:22,cursor:"pointer",color:MUTED,lineHeight:1}}>x</button></div>{children}</div></div>;}
function KPI({label,value,sub,icon,alert}){return <div style={{background:WHITE,border:"1px solid "+(alert?"#FCA5A5":BORDER),borderRadius:12,padding:"14px 18px",flex:1,minWidth:140}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:MUTED,fontWeight:500}}>{label}</span><span style={{fontSize:18}}>{icon}</span></div><div style={{fontSize:26,fontWeight:800,color:alert?"#EF4444":TEXT,lineHeight:1}}>{value}</div>{sub&&<div style={{fontSize:12,color:MUTED,marginTop:3}}>{sub}</div>}</div>;}
function Tabs({items,active,onChange}){return <div style={{display:"flex",gap:4,background:"#F1F5F9",borderRadius:10,padding:4,marginBottom:20}}>{items.map(t=><button key={t.id} onClick={()=>onChange(t.id)} style={{flex:1,padding:"8px 16px",borderRadius:7,border:"none",cursor:"pointer",background:active===t.id?WHITE:"transparent",color:active===t.id?TEXT:MUTED,fontSize:13,fontWeight:active===t.id?600:400,boxShadow:active===t.id?"0 1px 4px #0000000f":"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{t.label}{t.badge>0&&<span style={{background:"#EF4444",color:"#fff",borderRadius:999,padding:"1px 6px",fontSize:10,fontWeight:700}}>{t.badge}</span>}</button>)}</div>;}
function Alrt({type,msg}){if(!msg)return null;const s={error:{bg:"#FEF2F2",bdr:"#FCA5A5",c:"#DC2626"},ok:{bg:"#F0FDF9",bdr:"#6EE7B7",c:"#065F46"},warn:{bg:"#FFFBEB",bdr:"#FCD34D",c:"#92400E"}}[type]||{bg:"#F0FDF9",bdr:"#6EE7B7",c:"#065F46"};return <div style={{padding:"10px 14px",background:s.bg,border:"1px solid "+s.bdr,borderRadius:8,fontSize:13,color:s.c,marginBottom:14}}>{msg}</div>;}


function LoginPage(){
  const [mode,setMode]=useState("login"); // login | signup | forgot | setpwd
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");const [pwd,setPwd]=useState("");
  const [confirm,setConfirm]=useState("");
  const [newPwd,setNewPwd]=useState("");const [newConfirm,setNewConfirm]=useState("");
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState({type:"",text:""});
  useEffect(()=>{if(window.location.hash.includes("type=invite")||window.location.hash.includes("type=recovery"))setMode("setpwd");},[]);
  const err=t=>setMsg({type:"error",text:t}),good=t=>setMsg({type:"ok",text:t});

  const doLogin=async e=>{
    e.preventDefault();if(!email||!pwd)return err("Email and password required.");
    setLoading(true);setMsg({type:"",text:""});
    const{error}=await sb.auth.signInWithPassword({email,password:pwd});
    setLoading(false);if(error)err(error.message);
  };

  const doSignUp=async e=>{
    e.preventDefault();
    if(!name.trim())return err("Full name is required.");
    if(!email)return err("Email is required.");
    if(!pwd||pwd.length<8)return err("Password must be at least 8 characters.");
    if(pwd!==confirm)return err("Passwords do not match.");
    setLoading(true);setMsg({type:"",text:""});
    // Always admin for Create Account flow (first-admin setup)
    const role="admin";
    // Create auth account - store role+name in metadata as fallback
    const{data:authData,error:authErr}=await sb.auth.signUp({
      email,password:pwd,
      options:{data:{name:name.trim(),role:"admin"},emailRedirectTo:window.location.origin}
    });
    if(authErr){setLoading(false);return err(authErr.message);}
    const authId=authData.user?.id;
    if(authId){
      // Create employee record
      const{data:emp}=await sb.from("employees")
        .insert({name:name.trim(),email,department:"Management",role:"Administrator",capacity:40,active:true})
        .select().single();
      // Create app_users profile (may fail until email confirmed - loadAll handles fallback)
      await sb.from("app_users").upsert(
        {id:authId,name:name.trim(),email,role:"admin",employee_id:emp?.id||null,is_active:true,avatar_color:TEAL},
        {onConflict:"id"}
      );
    }
    setLoading(false);
    good("Account created! Check your email, confirm the link, then sign in here.");
    setTimeout(()=>setMode("login"),4000);
  };

  const doForgot=async e=>{
    e.preventDefault();if(!email)return err("Enter your email.");setLoading(true);
    const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
    setLoading(false);if(error)err(error.message);else{good("Reset link sent. Check your inbox.");setTimeout(()=>setMode("login"),3000);}
  };
  const doSetPwd=async e=>{
    e.preventDefault();if(!newPwd||newPwd.length<8)return err("Min 8 characters.");
    if(newPwd!==newConfirm)return err("Passwords do not match.");setLoading(true);
    const{error}=await sb.auth.updateUser({password:newPwd});setLoading(false);
    if(error)err(error.message);else{good("Password set!");window.location.hash="";}
  };

  const features=["Role-based access for Admin, Manager and User","Weekly timesheet submission and approval workflow","Team-based resource utilization tracking","Leave management with manager approval","Real-time heatmap and utilization reports"];

  return(
    <div style={{display:"flex",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* Left branding panel */}
      <div style={{width:"44%",background:NAV,display:"flex",flexDirection:"column",justifyContent:"center",padding:"56px 48px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:44}}>
          <div style={{width:46,height:46,borderRadius:13,background:TEAL,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:22,color:NAV}}>R</div>
          <div><div style={{fontSize:24,fontWeight:800,color:WHITE}}>ResTrack</div><div style={{fontSize:12,color:"#ffffff60"}}>Resource Management Platform</div></div>
        </div>
        <h1 style={{fontSize:32,fontWeight:800,color:WHITE,margin:"0 0 14px",lineHeight:1.2}}>Manage your team with full visibility</h1>
        <p style={{fontSize:14,color:"#ffffff80",margin:"0 0 36px",lineHeight:1.7}}>One platform for timesheets, resource tracking, leave management and team collaboration.</p>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          {features.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{width:20,height:20,borderRadius:"50%",background:TEAL+"33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:TEAL,fontSize:11,fontWeight:700}}>✓</span>
            <span style={{fontSize:13,color:"#ffffffcc"}}>{f}</span>
          </div>)}
        </div>
      </div>

      {/* Right form panel */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#F8FAFC",padding:40}}>
        <div style={{width:"100%",maxWidth:420}}>

          {/* Mode switcher tabs */}
          {(mode==="login"||mode==="signup")&&(
            <div style={{display:"flex",background:"#F1F5F9",borderRadius:10,padding:4,marginBottom:28}}>
              {[{id:"login",label:"Sign In"},{id:"signup",label:"Create Account"}].map(t=>(
                <button key={t.id} onClick={()=>{setMode(t.id);setMsg({type:"",text:""}); }} style={{flex:1,padding:"9px",borderRadius:7,border:"none",cursor:"pointer",background:mode===t.id?WHITE:"transparent",color:mode===t.id?TEXT:MUTED,fontSize:13,fontWeight:mode===t.id?600:400,boxShadow:mode===t.id?"0 1px 4px #0000000f":"none",transition:"all .15s"}}>{t.label}</button>
              ))}
            </div>
          )}

          {/* LOGIN */}
          {mode==="login"&&<>
            <h2 style={{fontSize:24,fontWeight:800,color:TEXT,margin:"0 0 6px"}}>Welcome back</h2>
            <p style={{fontSize:14,color:MUTED,margin:"0 0 24px"}}>Sign in to your ResTrack account</p>
            <Alrt type={msg.type} msg={msg.text}/>
            <form onSubmit={doLogin}>
              <Inp label="Work Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/>
              <Inp label="Password"   type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Your password" required/>
              <Btn primary full disabled={loading} style={{padding:"13px",fontSize:15,marginTop:4}}>{loading?<><Spin/>Signing in...</>:"Sign In"}</Btn>
            </form>
            <button onClick={()=>{setMode("forgot");setMsg({type:"",text:""});}} style={{marginTop:14,fontSize:13,color:MUTED,background:"none",border:"none",cursor:"pointer",display:"block",width:"100%",textAlign:"center"}}>Forgot your password?</button>
            <div style={{marginTop:20,padding:"12px 16px",background:WHITE,borderRadius:10,border:"1px solid "+BORDER,fontSize:13,color:MUTED,textAlign:"center",lineHeight:1.6}}>
              Already have an account from an invite?<br/>Sign in above with your email and password.
            </div>
          </>}

          {/* SIGN UP */}
          {mode==="signup"&&<>
            <h2 style={{fontSize:24,fontWeight:800,color:TEXT,margin:"0 0 6px"}}>Create your account</h2>
            <p style={{fontSize:14,color:MUTED,margin:"0 0 20px"}}>Set up the first admin account for your organization.</p>
            <div style={{padding:"10px 14px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,fontSize:13,color:"#1D4ED8",marginBottom:16,lineHeight:1.5}}>
              The first account created is automatically set as <strong>Admin</strong>. Use this to set up your workspace, then invite your team.
            </div>
            <Alrt type={msg.type} msg={msg.text}/>
            <form onSubmit={doSignUp}>
              <Inp label="Full Name"        value={name}    onChange={e=>setName(e.target.value)}    placeholder="Your full name"   required/>
              <Inp label="Work Email"       type="email" value={email}    onChange={e=>setEmail(e.target.value)}   placeholder="you@company.com"  required/>
              <Inp label="Password"         type="password" value={pwd}     onChange={e=>setPwd(e.target.value)}    placeholder="Min 8 characters" required/>
              <Inp label="Confirm Password" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat password"  required/>
              <Btn primary full disabled={loading} style={{padding:"13px",fontSize:15,marginTop:4}}>{loading?<><Spin/>Creating account...</>:"Create Account"}</Btn>
            </form>
          </>}

          {/* FORGOT PASSWORD */}
          {mode==="forgot"&&<>
            <button onClick={()=>setMode("login")} style={{fontSize:13,color:MUTED,background:"none",border:"none",cursor:"pointer",marginBottom:22,display:"flex",alignItems:"center",gap:4}}>Back to sign in</button>
            <h2 style={{fontSize:24,fontWeight:800,color:TEXT,margin:"0 0 6px"}}>Reset password</h2>
            <p style={{fontSize:14,color:MUTED,margin:"0 0 24px"}}>Enter your work email and we will send a reset link.</p>
            <Alrt type={msg.type} msg={msg.text}/>
            <form onSubmit={doForgot}>
              <Inp label="Work Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/>
              <Btn primary full disabled={loading}>{loading?<><Spin/>Sending...</>:"Send Reset Link"}</Btn>
            </form>
          </>}

          {/* SET PASSWORD (invite/recovery flow) */}
          {mode==="setpwd"&&<>
            <h2 style={{fontSize:24,fontWeight:800,color:TEXT,margin:"0 0 6px"}}>Set your password</h2>
            <p style={{fontSize:14,color:MUTED,margin:"0 0 24px"}}>Choose a secure password to complete your account setup.</p>
            <Alrt type={msg.type} msg={msg.text}/>
            <form onSubmit={doSetPwd}>
              <Inp label="New Password"     type="password" value={newPwd}     onChange={e=>setNewPwd(e.target.value)}     placeholder="At least 8 characters" required/>
              <Inp label="Confirm Password" type="password" value={newConfirm} onChange={e=>setNewConfirm(e.target.value)} placeholder="Repeat password" required/>
              <Btn primary full disabled={loading} style={{padding:"13px",fontSize:15,marginTop:4}}>{loading?<><Spin/>Setting...</>:"Set Password and Sign In"}</Btn>
            </form>
          </>}

        </div>
      </div>
    </div>
  );
}


function Dashboard({user,employees,projects,allocs,entries,leaves,timesheets,teams,setView}){
  const isAdmin=user.role==="admin",isManager=user.role==="manager";
  const WEEKS=recentWeeks(6),week=currentWeek();
  const visEmps=isAdmin?employees:isManager?employees.filter(e=>e.teamId===user.teamId||e.managerId===user.employeeId):employees.filter(e=>e.id===user.employeeId);
  const stats=visEmps.filter(e=>e.active).map(e=>{const logged=entries.filter(en=>en.empId===e.id&&en.week===week).reduce((s,en)=>s+en.hours,0);return{...e,logged,util:e.capacity>0?Math.round((logged/e.capacity)*100):0};});
  const avgUtil=stats.length?Math.round(stats.reduce((s,e)=>s+e.util,0)/stats.length):0;
  const overloaded=stats.filter(e=>e.util>100).length;
  const pendingCount=(isAdmin||isManager)?(timesheets.filter(t=>{if(t.status!=="submitted")return false;const e=employees.find(em=>em.id===t.empId);return isAdmin||e?.managerId===user.employeeId||e?.teamId===user.teamId;}).length+leaves.filter(l=>{if(l.status!=="pending")return false;const e=employees.find(em=>em.id===l.empId);return isAdmin||e?.managerId===user.employeeId||e?.teamId===user.teamId;}).length):0;
  const myTs=timesheets.find(t=>t.empId===user.employeeId&&t.week===week);
  const wkChart=WEEKS.map(w=>{const cap=visEmps.reduce((s,e)=>s+e.capacity,0),log=entries.filter(en=>en.week===w&&visEmps.find(e=>e.id===en.empId)).reduce((s,en)=>s+en.hours,0);return{week:w.replace("2026-",""),util:cap>0?Math.round((log/cap)*100):0};});
  return(
    <div>
      <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px"}}>{isAdmin?"Company Overview":isManager?"Team Overview":"My Dashboard"}</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Week {week} - Welcome, {user.name?.split(" ")[0]}</p></div>
      {!isAdmin&&!isManager&&myTs&&<div style={{padding:"12px 16px",background:TS_STATUS[myTs.status]?.bg||"#F1F5F9",border:"1px solid "+BORDER,borderRadius:10,marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:20}}>{TS_STATUS[myTs.status]?.icon}</span>
        <div style={{flex:1}}><span style={{fontSize:13,fontWeight:600,color:TS_STATUS[myTs.status]?.fg}}>{TS_STATUS[myTs.status]?.label}</span><span style={{fontSize:13,color:MUTED}}> - Timesheet for {week} ({myTs.totalHours}h)</span>{myTs.comment&&<div style={{fontSize:12,color:MUTED,marginTop:2}}>Comment: {myTs.comment}</div>}</div>
        {(myTs.status==="draft"||myTs.status==="rejected")&&<Btn small primary onClick={()=>setView("timesheets")}>Open Timesheet</Btn>}
      </div>}
      {!isAdmin&&!isManager&&!myTs&&<div style={{padding:"12px 16px",background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:20}}>⚠️</span><div style={{flex:1,fontSize:13,color:"#92400E"}}>No hours logged for {week} yet.</div><Btn small onClick={()=>setView("timesheets")}>Log Hours</Btn>
      </div>}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <KPI label={isAdmin?"All Employees":isManager?"Team Members":"My Hours"} value={isAdmin||isManager?visEmps.length:(entries.filter(e=>e.empId===user.employeeId&&e.week===week).reduce((s,e)=>s+e.hours,0))+"h"} icon="👥"/>
        <KPI label="Avg Utilization" value={avgUtil+"%" } sub="This week" icon="📊" alert={avgUtil<60&&(isAdmin||isManager)}/>
        <KPI label="Overloaded"      value={overloaded}  sub="Over 100%" icon="🔴" alert={overloaded>0}/>
        <KPI label="Pending Approvals" value={pendingCount} sub="Need review" icon="✅" alert={pendingCount>0}/>
        {(isAdmin||isManager)&&<KPI label="Active Projects" value={projects.filter(p=>p.status==="active").length} sub={projects.length+" total"} icon="📁"/>}
        {isAdmin&&<KPI label="Teams" value={teams.length} icon="🏢"/>}
      </div>
      {overloaded>0&&<div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:"#92400E",marginBottom:6}}>Action Required</div>
        {stats.filter(e=>e.util>100).map(e=><div key={e.id} style={{fontSize:12,color:"#C2410C",marginBottom:3}}><strong>{e.name}</strong> at {e.util}% this week</div>)}
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:14}}>
        <Card>
          <SecHd title="Utilization Trend"/>
          <ResponsiveContainer width="100%" height={185}>
            <AreaChart data={wkChart}>
              <defs><linearGradient id="ug" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={TEAL} stopOpacity={0.2}/><stop offset="95%" stopColor={TEAL} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/><XAxis dataKey="week" tick={{fontSize:11,fill:"#94A3B8"}}/><YAxis tick={{fontSize:11,fill:"#94A3B8"}} domain={[0,100]} unit="%"/>
              <Tooltip formatter={v=>[v+"%","Utilization"]}/><Area type="monotone" dataKey="util" stroke={TEAL} fill="url(#ug)" strokeWidth={2} dot={{r:3,fill:TEAL}}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SecHd title="This Week" action={<Btn small onClick={()=>setView("utilization")}>Full view</Btn>}/>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {stats.slice(0,6).map(e=>{const{bg,fg}=utilColor(e.util);return(
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:8}}>
                <Av name={e.name} color={e.color||TEAL} sz={24}/>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div><Prog val={e.util} h={4}/></div>
                <span style={{fontSize:11,fontWeight:700,background:bg,color:fg,borderRadius:6,padding:"2px 6px",whiteSpace:"nowrap"}}>{e.util}%</span>
              </div>
            );})}
          </div>
        </Card>
      </div>
      {pendingCount>0&&(isAdmin||isManager)&&<Card style={{border:"1px solid #FDE68A",background:"#FFFBEB"}}>
        <SecHd title={"Pending Approvals ("+pendingCount+")"} action={<Btn small primary onClick={()=>setView("approvals")}>Review All</Btn>}/>
        <p style={{fontSize:13,color:MUTED,margin:0}}>Timesheets and leave requests awaiting your review.</p>
      </Card>}
    </div>
  );
}

function Timesheets({user,employees,projects,allocs,entries,setEntries,timesheets,setTimesheets,setView}){
  const isStaff=user.role==="admin"||user.role==="manager";
  const [week,setWeek]=useState(currentWeek());
  const [hours,setHours]=useState({});
  const [notes,setNotes]=useState({});
  const [addProjId,setAddProjId]=useState("");
  const [extraProjs,setExtraProjs]=useState([]);
  const [saving,setSaving]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [msg,setMsg]=useState({type:"",text:""});

  const emp=employees.find(e=>e.id===user.employeeId);
  const capacity=emp?.capacity||40;
  const ts=timesheets.find(t=>t.empId===user.employeeId&&t.week===week);
  const locked=ts?.status==="submitted"||ts?.status==="approved";

  // Projects shown: for admin/manager = all active; for user = only allocated
  const empAllocs=allocs.filter(a=>String(a.empId)===String(user.employeeId));
  const allocatedProjIds=empAllocs.map(a=>String(a.projId));
  // Also include projects already logged this week
  const loggedProjIds=entries.filter(e=>String(e.empId)===String(user.employeeId)&&e.week===week).map(e=>String(e.projId));
  const shownProjIds=[...new Set([
    ...(isStaff?projects.filter(p=>p.status!=="completed").map(p=>String(p.id)):allocatedProjIds),
    ...loggedProjIds,
    ...extraProjs,
  ])];
  const shownProjs=shownProjIds.map(id=>projects.find(p=>String(p.id)===id)).filter(Boolean);
  const unshownProjs=projects.filter(p=>!shownProjIds.includes(String(p.id))&&p.status!=="completed");
  const totalHrs=Object.values(hours).reduce((s,v)=>s+(+v||0),0);
  const utilPct=capacity>0?Math.round((totalHrs/capacity)*100):0;

  useEffect(()=>{
    const ex=entries.filter(e=>String(e.empId)===String(user.employeeId)&&e.week===week);
    const h={},n={};
    ex.forEach(e=>{h[String(e.projId)]=String(e.hours);n[String(e.projId)]=e.note||"";});
    setHours(h);setNotes(n);
  },[week,user.employeeId]);

  const saveDraft=async()=>{
    if(!user.employeeId){setMsg({type:"error",text:"Your account has no employee profile linked. Contact your admin."});return;}
    setSaving(true);setMsg({type:"",text:""});
    const{data:tsData,error:tsErr}=await sb.from("timesheets").upsert({
      employee_id:user.employeeId,week,
      status:ts?.status==="rejected"?"draft":(ts?.status||"draft"),
      total_hours:totalHrs,updated_at:new Date().toISOString()
    },{onConflict:"employee_id,week"}).select().single();
    if(tsErr){setMsg({type:"error",text:tsErr.message});setSaving(false);return;}
    await sb.from("time_entries").delete().eq("employee_id",user.employeeId).eq("week",week);
    const rows=shownProjs.filter(p=>hours[String(p.id)]&&+hours[String(p.id)]>0).map(p=>({
      employee_id:user.employeeId,project_id:p.id,week,
      hours:+hours[String(p.id)],note:notes[String(p.id)]||"",timesheet_id:tsData.id
    }));
    if(rows.length>0){const{data:newE}=await sb.from("time_entries").insert(rows).select();if(newE)setEntries(prev=>[...prev.filter(e=>!(String(e.empId)===String(user.employeeId)&&e.week===week)),...newE.map(toEntry)]);}
    else setEntries(prev=>prev.filter(e=>!(String(e.empId)===String(user.employeeId)&&e.week===week)));
    setTimesheets(prev=>[...prev.filter(t=>!(t.empId===user.employeeId&&t.week===week)),toTs(tsData)]);
    setMsg({type:"ok",text:"Saved as draft."});setSaving(false);
  };

  const submit=async()=>{
    if(!totalHrs){setMsg({type:"warn",text:"Log some hours before submitting."});return;}
    await saveDraft();
    setSubmitting(true);
    const{data:tsData}=await sb.from("timesheets").update({status:"submitted",submitted_at:new Date().toISOString()}).eq("employee_id",user.employeeId).eq("week",week).select().single();
    if(tsData){
      setTimesheets(prev=>prev.map(t=>t.empId===user.employeeId&&t.week===week?toTs(tsData):t));
      setMsg({type:"ok",text:"Submitted for approval!"});
      const myEmp=employees.find(e=>e.id===user.employeeId);
      if(myEmp?.managerId)await notifyEmp(myEmp.managerId,(user.name||"Someone")+" submitted timesheet for "+week,"timesheet");
    }
    setSubmitting(false);
  };

  const exportMyTimesheets=()=>{
    const rows=timesheets.filter(t=>t.empId===user.employeeId).flatMap(t=>{
      const ents=entries.filter(e=>String(e.empId)===String(user.employeeId)&&e.week===t.week);
      if(ents.length===0)return[{Employee:emp?.name||"",Week:t.week,Project:"(no entries)",Hours:0,Notes:"",Status:t.status,Comment:t.comment}];
      return ents.map(e=>{const p=projects.find(pr=>String(pr.id)===String(e.projId));return{Employee:emp?.name||"",Week:t.week,Project:p?.name||e.projId,Hours:e.hours,Notes:e.note,Status:t.status,Comment:t.comment};});
    });
    if(rows.length===0){setMsg({type:"warn",text:"No timesheet data to export."});return;}
    csvDownload(rows,"my-timesheets-"+user.employeeId+".csv");
  };

  const stMeta=TS_STATUS[ts?.status||"draft"];
  const cw=currentWeek();

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px"}}>My Timesheet</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Log and submit weekly hours</p></div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={exportMyTimesheets}>Export My Data</Btn>
          {isStaff&&projects.length===0&&<Btn primary onClick={()=>setView("projects")}>+ Create First Project</Btn>}
        </div>
      </div>

      {!user.employeeId&&<div style={{padding:"14px 18px",background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:10,marginBottom:16}}>
        <div style={{fontWeight:700,color:"#991B1B",marginBottom:4}}>Employee profile not linked</div>
        <div style={{fontSize:13,color:"#DC2626"}}>Your login account is not connected to an employee record. Go to Employees, find your record, and make sure your email matches. Then log out and back in.</div>
      </div>}

      {projects.length===0&&isStaff&&<div style={{padding:"14px 18px",background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:22}}>📁</span>
        <div style={{flex:1}}><div style={{fontWeight:700,color:"#92400E",marginBottom:2}}>No projects yet</div><div style={{fontSize:13,color:"#C2410C"}}>Create projects first, then you can log hours against them.</div></div>
        <Btn primary onClick={()=>setView("projects")}>Go to Projects</Btn>
      </div>}

      <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16}}>
        {/* Left: week navigator */}
        <div>
          <Card style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Week</div>
            {/* Main nav */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <button onClick={()=>setWeek(addWeeks(week,-1))} style={{width:34,height:34,borderRadius:8,border:"1px solid "+BORDER,background:WHITE,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",color:TEXT,fontWeight:700}}>{"<"}</button>
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:15,fontWeight:800,color:TEXT}}>{week}</div>
                <div style={{fontSize:11,color:week===cw?TEAL:MUTED,fontWeight:600}}>{week===cw?"Current week":week>cw?"Future":"Past"}</div>
              </div>
              <button onClick={()=>setWeek(addWeeks(week,1))} disabled={!isStaff&&week>=cw} style={{width:34,height:34,borderRadius:8,border:"1px solid "+BORDER,background:(!isStaff&&week>=cw)?"#F8FAFC":WHITE,cursor:(!isStaff&&week>=cw)?"not-allowed":"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",color:(!isStaff&&week>=cw)?"#CBD5E1":TEXT,fontWeight:700}}>{">"}</button>
            </div>
            {week!==cw&&<button onClick={()=>setWeek(cw)} style={{width:"100%",padding:"6px",background:"#F0FDF9",border:"1px solid "+TEAL+"44",borderRadius:7,color:TEAL,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:10}}>Jump to Current Week</button>}
            {/* Year quick-nav (admin/manager) */}
            {isStaff&&<>
              <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Jump to Year</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                {[parseInt(cw)-2,parseInt(cw)-1,parseInt(cw),parseInt(cw)+1].map(y=>{
                  const yr=String(y).slice(0,4);
                  return <button key={y} onClick={()=>setWeek(yr+"-W01")} style={{flex:1,padding:"5px 4px",borderRadius:6,border:"1px solid "+BORDER,background:week.startsWith(yr)?TEAL:WHITE,color:week.startsWith(yr)?"#fff":TEXT,fontSize:12,fontWeight:600,cursor:"pointer"}}>{yr}</button>;
                })}
              </div>
            </>}
            {/* Recent weeks */}
            <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Quick Pick</div>
            {[addWeeks(cw,-2),addWeeks(cw,-1),cw,addWeeks(cw,1)].map(w=>{
              const wts=timesheets.find(t=>t.empId===user.employeeId&&t.week===w);
              const wst=wts?.status||"none";
              return <div key={w} onClick={()=>setWeek(w)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px",borderRadius:6,cursor:"pointer",background:week===w?"#F0FDF9":WHITE,border:"1px solid "+(week===w?TEAL+"55":BORDER),marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:week===w?700:400,color:week===w?TEAL:TEXT}}>{w}</span>
                {wst!=="none"?<span style={{fontSize:10,background:TS_STATUS[wst]?.bg,color:TS_STATUS[wst]?.fg,borderRadius:4,padding:"1px 6px",fontWeight:700}}>{TS_STATUS[wst]?.label}</span>:<span style={{fontSize:10,color:"#CBD5E1"}}>Empty</span>}
              </div>;
            })}
          </Card>
          {emp&&<Card>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <Av name={emp.name} color={emp.color||TEAL} sz={36}/>
              <div><div style={{fontSize:13,fontWeight:700}}>{emp.name}</div><div style={{fontSize:11,color:MUTED}}>{emp.role}</div><div style={{fontSize:11,color:MUTED}}>Capacity: {emp.capacity}h/wk</div></div>
            </div>
            <div style={{fontSize:12,color:MUTED,marginBottom:5}}>This week: {totalHrs}h / {capacity}h</div>
            <Prog val={utilPct} h={8}/><div style={{fontSize:13,fontWeight:700,color:utilColor(utilPct).fg,marginTop:5,textAlign:"right"}}>{utilPct}%</div>
          </Card>}
        </div>

        {/* Right: timesheet grid */}
        <div>
          {/* Status banner */}
          <div style={{padding:"12px 16px",background:stMeta?.bg||"#F1F5F9",borderRadius:10,marginBottom:14,display:"flex",alignItems:"center",gap:12,border:"1px solid "+BORDER}}>
            <span style={{fontSize:20}}>{stMeta?.icon}</span>
            <div style={{flex:1}}>
              <span style={{fontSize:14,fontWeight:700,color:stMeta?.fg}}>{stMeta?.label}</span>
              {ts?.submittedAt&&<span style={{fontSize:12,color:MUTED}}> - Submitted {new Date(ts.submittedAt).toLocaleDateString()}</span>}
              {ts?.reviewedAt&&<span style={{fontSize:12,color:MUTED}}> - Reviewed {new Date(ts.reviewedAt).toLocaleDateString()}</span>}
              {ts?.comment&&<div style={{fontSize:13,color:stMeta?.fg,marginTop:3,fontStyle:"italic"}}>Manager: {ts.comment}</div>}
            </div>
          </div>
          <Alrt type={msg.type} msg={msg.text}/>
          <Card>
            {/* Column headers */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 90px 1fr",gap:10,padding:"6px 12px",marginBottom:6}}>
              {["Project","Hours","Notes"].map(h=><span key={h} style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5}}>{h}</span>)}
            </div>
            {/* Project rows */}
            {shownProjs.length===0?(
              <div style={{textAlign:"center",padding:"36px 0",color:MUTED}}>
                <div style={{fontSize:32,marginBottom:10}}>📁</div>
                <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>{projects.length===0?"No projects created yet":"No projects allocated yet"}</div>
                {isStaff&&projects.length===0&&<Btn primary small onClick={()=>setView("projects")}>Create a Project</Btn>}
                {!isStaff&&projects.length>0&&<div style={{fontSize:13}}>Ask your manager to allocate you to a project.</div>}
              </div>
            ):shownProjs.map(p=>{
              const a=empAllocs.find(al=>String(al.projId)===String(p.id));
              const pk=String(p.id);
              const hasHrs=hours[pk]&&+hours[pk]>0;
              return <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 90px 1fr",gap:10,alignItems:"center",padding:"10px 12px",background:hasHrs?"#F0FDF9":"#F8FAFC",borderRadius:8,marginBottom:7,border:"1px solid "+(hasHrs?TEAL+"44":BORDER)}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:11,color:MUTED}}>{p.client}{a?` - ${a.hoursPerWeek}h/wk alloc`:isStaff?" - not allocated":""}</div>
                </div>
                <input type="number" min="0" max="80" value={hours[pk]||""} disabled={locked}
                  onChange={e=>setHours(h=>({...h,[pk]:e.target.value}))}
                  style={{padding:"8px",border:"1.5px solid "+(hasHrs?TEAL:BORDER),borderRadius:6,fontSize:16,fontWeight:700,textAlign:"center",width:"100%",boxSizing:"border-box",background:locked?"#F8FAFC":WHITE}}/>
                <input type="text" value={notes[pk]||""} disabled={locked} placeholder="What did you work on?"
                  onChange={e=>setNotes(n=>({...n,[pk]:e.target.value}))}
                  style={{padding:"9px 12px",border:"1px solid "+BORDER,borderRadius:6,fontSize:13,width:"100%",boxSizing:"border-box",background:locked?"#F8FAFC":WHITE}}/>
              </div>;
            })}

            {/* Add project row (admin/manager or if projects exist) */}
            {!locked&&isStaff&&unshownProjs.length>0&&<div style={{display:"flex",gap:10,marginTop:4,padding:"8px 12px",background:"#F8FAFC",borderRadius:8,border:"1px dashed "+BORDER,alignItems:"center"}}>
              <select value={addProjId} onChange={e=>setAddProjId(e.target.value)} style={{flex:1,padding:"8px 12px",border:"1px solid "+BORDER,borderRadius:6,fontSize:13,color:MUTED}}>
                <option value="">+ Add another project to this timesheet...</option>
                {unshownProjs.map(p=><option key={p.id} value={String(p.id)}>{p.name} ({p.client})</option>)}
              </select>
              <Btn small primary onClick={()=>{if(addProjId){setExtraProjs(prev=>[...prev,addProjId]);setAddProjId("");}}} disabled={!addProjId}>Add</Btn>
            </div>}

            {/* Totals row */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:totalHrs>capacity?"#FEF2F2":totalHrs>0?"#F0FDF9":"#F8FAFC",borderRadius:8,marginTop:8,border:"1px solid "+(totalHrs>capacity?"#FCA5A5":totalHrs>0?TEAL+"44":BORDER)}}>
              <span style={{fontSize:14,fontWeight:600}}>Total logged</span>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22,fontWeight:800,color:totalHrs>capacity?"#EF4444":TEAL}}>{totalHrs}h</span>
                <span style={{fontSize:13,color:MUTED}}>of {capacity}h ({utilPct}%)</span>
              </div>
            </div>
            {!locked&&user.employeeId&&shownProjs.length>0&&<div style={{display:"flex",gap:10,marginTop:12}}>
              <Btn full disabled={saving} onClick={saveDraft}>{saving?<><Spin dark/>Saving...</>:"Save Draft"}</Btn>
              <Btn primary full disabled={submitting||saving} onClick={submit}>{submitting?<><Spin/>Submitting...</>:"Submit for Approval"}</Btn>
            </div>}
          </Card>
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
  const approveTs=async ts=>{setLoading(true);const{data}=await sb.from("timesheets").update({status:"approved",comment,reviewed_by:user.employeeId,reviewed_at:new Date().toISOString()}).eq("id",ts.id).select().single();if(data){setTimesheets(prev=>prev.map(t=>t.id===ts.id?toTs(data):t));await notifyEmp(ts.empId,"Your timesheet for "+ts.week+" was approved by "+user.name,"success");}setReviewTs(null);setComment("");setLoading(false);};
  const rejectTs=async ts=>{if(!comment.trim()){alert("Comment required when returning.");return;}setLoading(true);const{data}=await sb.from("timesheets").update({status:"rejected",comment,reviewed_by:user.employeeId,reviewed_at:new Date().toISOString()}).eq("id",ts.id).select().single();if(data){setTimesheets(prev=>prev.map(t=>t.id===ts.id?toTs(data):t));await notifyEmp(ts.empId,"Your timesheet for "+ts.week+" was returned by "+user.name+" for changes","warn");}setReviewTs(null);setComment("");setLoading(false);};
  const updateLeave=async(id,status)=>{const{error}=await sb.from("leaves").update({status}).eq("id",id);if(!error){const lv=leaves.find(l=>l.id===id);setLeaves(prev=>prev.map(l=>l.id===id?{...l,status}:l));if(lv)await notifyEmp(lv.empId,"Your "+lv.type+" leave was "+status+" by "+user.name,status==="approved"?"success":"warn");}};
  const tsEntries=reviewTs?entries.filter(e=>String(e.empId)===String(reviewTs.empId)&&e.week===reviewTs.week):[];
  return(
    <div>
      <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px"}}>Approvals</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Review and action pending submissions</p></div>
      <Tabs items={[{id:"timesheets",label:"Timesheets",badge:pendingTs.length},{id:"leaves",label:"Leave Requests",badge:pendingLv.length}]} active={tab} onChange={setTab}/>
      {tab==="timesheets"&&<Card style={{padding:0,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#F8FAFC"}}>{["Employee","Week","Hours","Submitted","Status","Action"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:MUTED,borderBottom:"1px solid "+BORDER}}>{h}</th>)}</tr></thead>
          <tbody>
            {allTs.map(ts=>{const emp=employees.find(e=>e.id===ts.empId);const st=TS_STATUS[ts.status]||{};return(
              <tr key={ts.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Av name={emp?.name||"?"} color={emp?.color||TEAL} sz={28}/><div><div style={{fontWeight:600}}>{emp?.name||"?"}</div><div style={{fontSize:11,color:MUTED}}>{emp?.dept}</div></div></div></td>
                <td style={{padding:"10px 14px",fontWeight:600}}>{ts.week}</td>
                <td style={{padding:"10px 14px",fontWeight:700,color:TEAL}}>{ts.totalHours}h</td>
                <td style={{padding:"10px 14px",color:MUTED}}>{ts.submittedAt?new Date(ts.submittedAt).toLocaleDateString():"-"}</td>
                <td style={{padding:"10px 14px"}}><span style={{background:st.bg,color:st.fg,borderRadius:999,padding:"2px 10px",fontSize:11,fontWeight:600}}>{st.label||ts.status}</span></td>
                <td style={{padding:"10px 14px"}}>{ts.status==="submitted"?<Btn small primary onClick={()=>{setReviewTs(ts);setComment("");}}>Review</Btn>:<Btn small ghost onClick={()=>{setReviewTs(ts);setComment(ts.comment||"");}}>View</Btn>}</td>
              </tr>
            );})}
            {allTs.length===0&&<tr><td colSpan={6} style={{padding:"32px",textAlign:"center",color:MUTED}}>No timesheets yet.</td></tr>}
          </tbody>
        </table>
      </Card>}
      {tab==="leaves"&&<div>
        {pendingLv.length>0&&<Card style={{marginBottom:14,border:"1px solid #FDE68A"}}>
          <SecHd title={"Pending ("+pendingLv.length+")"}/>
          {pendingLv.map(l=>{const e=employees.find(em=>em.id===l.empId);return(
            <div key={l.id} style={{display:"flex",alignItems:"center",gap:12,padding:12,background:"#FFFBEB",borderRadius:8,border:"1px solid #FDE68A",marginBottom:8}}>
              <Av name={e?.name||"?"} color={e?.color||TEAL} sz={30}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{e?.name}</div><div style={{fontSize:12,color:MUTED}}>{l.type} - {l.from} to {l.to} - {l.days} day{l.days>1?"s":""}</div>{l.reason&&<div style={{fontSize:12,color:"#94A3B8"}}>{l.reason}</div>}</div>
              <div style={{display:"flex",gap:6}}>
                <Btn small onClick={()=>updateLeave(l.id,"approved")} style={{background:"#D1FAE5",color:"#065F46",border:"none"}}>Approve</Btn>
                <Btn small danger onClick={()=>updateLeave(l.id,"rejected")}>Reject</Btn>
              </div>
            </div>
          );})}
        </Card>}
        <Card style={{padding:0,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#F8FAFC"}}>{["Employee","Type","Dates","Days","Reason","Status"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:MUTED,borderBottom:"1px solid "+BORDER}}>{h}</th>)}</tr></thead>
            <tbody>
              {allLv.map(l=>{const e=employees.find(em=>em.id===l.empId);return(
                <tr key={l.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                  <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Av name={e?.name||"?"} color={e?.color||TEAL} sz={26}/><span style={{fontWeight:600}}>{e?.name||"?"}</span></div></td>
                  <td style={{padding:"10px 14px"}}>{l.type}</td>
                  <td style={{padding:"10px 14px",color:MUTED}}>{l.from} to {l.to}</td>
                  <td style={{padding:"10px 14px",fontWeight:600}}>{l.days}</td>
                  <td style={{padding:"10px 14px",color:MUTED}}>{l.reason||"-"}</td>
                  <td style={{padding:"10px 14px"}}><Badge s={l.status}/></td>
                </tr>
              );})}
              {allLv.length===0&&<tr><td colSpan={6} style={{padding:"32px",textAlign:"center",color:MUTED}}>No leave requests.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>}
      {reviewTs&&<Modal title={"Timesheet - "+(employees.find(e=>e.id===reviewTs.empId)?.name||"?")} onClose={()=>setReviewTs(null)} width={560}>
        <div style={{display:"flex",gap:16,marginBottom:16,padding:"12px 14px",background:"#F8FAFC",borderRadius:8}}>
          <div><div style={{fontSize:11,color:MUTED}}>Week</div><div style={{fontWeight:700}}>{reviewTs.week}</div></div>
          <div><div style={{fontSize:11,color:MUTED}}>Total Hours</div><div style={{fontWeight:700,color:TEAL}}>{reviewTs.totalHours}h</div></div>
          <div><div style={{fontSize:11,color:MUTED}}>Status</div><span style={{background:TS_STATUS[reviewTs.status]?.bg,color:TS_STATUS[reviewTs.status]?.fg,borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:700}}>{TS_STATUS[reviewTs.status]?.label}</span></div>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Hours Breakdown</div>
          {tsEntries.length===0?<div style={{color:"#94A3B8",fontSize:13}}>No entries recorded.</div>:tsEntries.map(e=>{const p=projects.find(pr=>String(pr.id)===String(e.projId));return(
            <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#F8FAFC",borderRadius:7,marginBottom:6,border:"1px solid "+BORDER}}>
              <div><div style={{fontSize:13,fontWeight:500}}>{p?.name||e.projId}</div>{e.note&&<div style={{fontSize:12,color:MUTED}}>{e.note}</div>}</div>
              <span style={{fontWeight:700,fontSize:16,color:TEAL}}>{e.hours}h</span>
            </div>
          );})}
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:600,color:TEXT,display:"block",marginBottom:5}}>Comment {reviewTs.status==="submitted"&&"(required for rejection)"}</label>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={3} disabled={reviewTs.status!=="submitted"} placeholder={reviewTs.status==="submitted"?"Optional for approval, required for rejection":""}
            style={{width:"100%",padding:"10px 12px",border:"1px solid "+BORDER,borderRadius:8,fontSize:13,resize:"none",boxSizing:"border-box",background:reviewTs.status!=="submitted"?"#F8FAFC":WHITE}}/>
        </div>
        {reviewTs.status==="submitted"&&<div style={{display:"flex",gap:10}}>
          <Btn primary full disabled={loading} onClick={()=>approveTs(reviewTs)}>{loading?<><Spin/>...</>:"Approve Timesheet"}</Btn>
          <Btn danger full disabled={loading} onClick={()=>rejectTs(reviewTs)}>{loading?<><Spin/>...</>:"Return for Changes"}</Btn>
        </div>}
      </Modal>}
    </div>
  );
}


function Projects({user,projects,setProjects,allocs,setAllocs,employees,entries}){
  const [showNew,setShowNew]=useState(false);const [sel,setSel]=useState(null);const [saving,setSaving]=useState(false);
  const [aForm,setAForm]=useState({empId:"",hrs:""});
  const [form,setForm]=useState({name:"",client:"",status:"planning",start:"",end:"",budget:""});
  const F=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const addProj=async()=>{if(!form.name)return;setSaving(true);const{data,error}=await sb.from("projects").insert({name:form.name,client:form.client,status:form.status,start_date:form.start||null,end_date:form.end||null,budget_hours:+form.budget||0}).select().single();setSaving(false);if(!error&&data){setProjects(prev=>[...prev,toProj(data)]);setShowNew(false);setForm({name:"",client:"",status:"planning",start:"",end:"",budget:""});}};
  const addAlloc=async projId=>{if(!aForm.empId||!aForm.hrs)return;const{data,error}=await sb.from("allocations").upsert({employee_id:aForm.empId,project_id:projId,hours_per_week:+aForm.hrs},{onConflict:"employee_id,project_id"}).select().single();if(!error&&data){setAllocs(prev=>[...prev.filter(a=>!(String(a.empId)===String(aForm.empId)&&String(a.projId)===String(projId))),toAlloc(data)]);setAForm({empId:"",hrs:""});}};
  const removeAlloc=async id=>{const{error}=await sb.from("allocations").delete().eq("id",id);if(!error)setAllocs(prev=>prev.filter(a=>a.id!==id));};
  const updateStatus=async(projId,status)=>{const{error}=await sb.from("projects").update({status}).eq("id",projId);if(!error)setProjects(prev=>prev.map(p=>p.id===projId?{...p,status}:p));};
  const canEdit=user.role==="admin"||user.role==="manager";
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px"}}>Projects</h1><p style={{color:MUTED,fontSize:13,margin:0}}>{projects.length} projects</p></div>
        {canEdit&&<Btn primary onClick={()=>setShowNew(v=>!v)}>+ New Project</Btn>}
      </div>
      {showNew&&<Card style={{marginBottom:14,border:"1px solid #06D6A033",background:"#F0FDF9"}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>Create Project</div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:0}}>
          <div style={{paddingRight:12}}><Inp label="Project Name" value={form.name} onChange={F("name")} required/><Inp label="Client" value={form.client} onChange={F("client")}/></div>
          <div style={{paddingRight:12}}><Inp label="Start Date" type="date" value={form.start} onChange={F("start")}/><Inp label="End Date" type="date" value={form.end} onChange={F("end")}/></div>
          <div><SelF label="Status" value={form.status} onChange={F("status")} options={["planning","active","review","completed"].map(s=>({value:s,label:s}))}/><Inp label="Budget (hours)" type="number" value={form.budget} onChange={F("budget")} placeholder="0"/></div>
        </div>
        <div style={{display:"flex",gap:8}}><Btn primary small disabled={saving} onClick={addProj}>{saving?<Spin/>:"Create"}</Btn><Btn small onClick={()=>setShowNew(false)}>Cancel</Btn></div>
      </Card>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {projects.map(p=>{
          const pAllocs=allocs.filter(a=>String(a.projId)===String(p.id));
          const isOpen=sel===p.id;
          const totalLog=entries.filter(e=>String(e.projId)===String(p.id)).reduce((s,e)=>s+e.hours,0);
          const budgetPct=p.budgetHours>0?Math.round((totalLog/p.budgetHours)*100):0;
          const unassigned=employees.filter(e=>e.active&&!pAllocs.find(a=>String(a.empId)===String(e.id)));
          return(
            <Card key={p.id} style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"14px 18px",cursor:"pointer"}} onClick={()=>setSel(isOpen?null:p.id)}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:14,fontWeight:700}}>{p.name}</span><Badge s={p.status}/>
                      <span style={{fontSize:12,color:MUTED}}>{p.client}</span>
                      {p.budgetHours>0&&<span style={{fontSize:11,background:"#F0F4F8",color:MUTED,borderRadius:6,padding:"2px 7px"}}>{p.budgetHours}h budget</span>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:200}}><Prog val={budgetPct}/><span style={{fontSize:11,color:MUTED,whiteSpace:"nowrap"}}>{totalLog}h/{p.budgetHours||"?"}h</span></div>
                      <span style={{fontSize:12,color:MUTED}}>{pAllocs.length} members</span>
                      {p.start&&<span style={{fontSize:12,color:"#94A3B8"}}>{p.start} to {p.end}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:3}}>{pAllocs.slice(0,4).map(a=>{const e=employees.find(em=>String(em.id)===String(a.empId));return e?<Av key={a.id} name={e.name} color={e.color||TEAL} sz={26}/>:null;})}</div>
                  <span style={{color:"#CBD5E1",marginLeft:8}}>{isOpen?"▲":"▼"}</span>
                </div>
              </div>
              {isOpen&&<div style={{borderTop:"1px solid #F1F5F9",background:"#FAFBFC",padding:"14px 18px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:MUTED,marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Team ({pAllocs.length})</div>
                    {pAllocs.length===0&&<div style={{color:"#94A3B8",fontSize:13}}>No members yet.</div>}
                    {pAllocs.map(a=>{const emp=employees.find(e=>String(e.id)===String(a.empId));if(!emp)return null;const pct=emp.capacity>0?Math.round((a.hoursPerWeek/emp.capacity)*100):0;return(
                      <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #F1F5F9"}}>
                        <Av name={emp.name} color={emp.color||TEAL} sz={26}/>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{emp.name}</div><div style={{fontSize:11,color:MUTED}}>{emp.role}</div></div>
                        <span style={{fontSize:13,fontWeight:600}}>{a.hoursPerWeek}h/wk</span>
                        <span style={{fontSize:11,background:"#EFF6FF",color:"#1D4ED8",padding:"2px 7px",borderRadius:6}}>{pct}%</span>
                        {canEdit&&<button onClick={()=>removeAlloc(a.id)} style={{border:"none",background:"none",color:"#94A3B8",cursor:"pointer",fontSize:16}}>x</button>}
                      </div>
                    );})}
                  </div>
                  <div>
                    {canEdit&&<>
                      <div style={{fontSize:12,fontWeight:700,color:MUTED,marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>Add Member</div>
                      <SelF label="" value={aForm.empId} onChange={e=>setAForm(f=>({...f,empId:e.target.value}))} options={[{value:"",label:"Select employee..."},...unassigned.map(e=>({value:String(e.id),label:e.name+" ("+e.capacity+"h cap)"}))]}/>
                      <Inp label="Hours per week" type="number" value={aForm.hrs} onChange={e=>setAForm(f=>({...f,hrs:e.target.value}))} placeholder="20"/>
                      <Btn primary small onClick={()=>addAlloc(p.id)}>Add to Project</Btn>
                      <div style={{marginTop:14,borderTop:"1px solid "+BORDER,paddingTop:12}}>
                        <div style={{fontSize:12,fontWeight:700,color:MUTED,marginBottom:8}}>Project Status</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {["planning","active","review","completed"].map(s=><button key={s} onClick={()=>updateStatus(p.id,s)} style={{padding:"4px 12px",borderRadius:6,border:"1px solid "+BORDER,background:p.status===s?TEAL:WHITE,color:p.status===s?"#fff":TEXT,fontSize:12,fontWeight:500,cursor:"pointer",textTransform:"capitalize"}}>{s}</button>)}
                        </div>
                      </div>
                    </>}
                  </div>
                </div>
              </div>}
            </Card>
          );
        })}
        {projects.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:MUTED,fontSize:14}}>No projects yet.</div>}
      </div>
    </div>
  );
}

function Utilization({user,employees,allocs,entries,timesheets}){
  const WEEKS=recentWeeks(8);
  const [selWeek,setSelWeek]=useState(WEEKS[WEEKS.length-1]);
  const isAdmin=user.role==="admin",isManager=user.role==="manager";
  const visEmps=isAdmin?employees:isManager?employees.filter(e=>e.teamId===user.teamId||e.managerId===user.employeeId):employees.filter(e=>e.id===user.employeeId);
  const weekStats=visEmps.filter(e=>e.active).map(e=>{const logged=entries.filter(en=>en.empId===e.id&&en.week===selWeek).reduce((s,en)=>s+en.hours,0);return{...e,logged,util:e.capacity>0?Math.round((logged/e.capacity)*100):0};}).sort((a,b)=>b.util-a.util);
  const heatRows=visEmps.filter(e=>e.active).map(e=>({emp:e,cells:WEEKS.map(w=>({week:w,pct:e.capacity>0?Math.round((entries.filter(en=>en.empId===e.id&&en.week===w).reduce((s,en)=>s+en.hours,0)/e.capacity)*100):0,status:timesheets.find(t=>t.empId===e.id&&t.week===w)?.status||"none"}))}));
  return(
    <div>
      <div style={{marginBottom:18}}><h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px"}}>Utilization</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Weekly resource utilization across {visEmps.length} employees</p></div>
      <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
        {WEEKS.map(w=><button key={w} onClick={()=>setSelWeek(w)} style={{padding:"6px 14px",borderRadius:8,border:"1px solid "+(selWeek===w?TEAL:BORDER),background:selWeek===w?TEAL:WHITE,color:selWeek===w?"#fff":MUTED,fontSize:12,fontWeight:600,cursor:"pointer"}}>{w.replace("2026-","")}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <Card>
          <SecHd title={"Logged vs Capacity - "+selWeek}/>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekStats.map(e=>({name:e.name.split(" ")[0],logged:e.logged,capacity:e.capacity}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
              <XAxis dataKey="name" tick={{fontSize:11,fill:"#94A3B8"}}/><YAxis tick={{fontSize:11,fill:"#94A3B8"}} unit="h"/>
              <Tooltip/><Legend/>
              <Bar dataKey="capacity" name="Capacity" fill="#E2E8F0" radius={[3,3,0,0]}/>
              <Bar dataKey="logged"   name="Logged"   radius={[3,3,0,0]}>{weekStats.map((d,i)=><Cell key={i} fill={d.util>100?"#8B5CF6":d.util>=75?TEAL:d.util>=50?"#F59E0B":"#EF4444"}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SecHd title="Summary"/>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {weekStats.map(e=>{const{bg,fg}=utilColor(e.util);const ts=timesheets.find(t=>t.empId===e.id&&t.week===selWeek);return(
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:10}}>
                <Av name={e.name} color={e.color||TEAL} sz={26}/>
                <div style={{flex:1,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</span><span style={{fontSize:12,color:MUTED,whiteSpace:"nowrap"}}>{e.logged}h/{e.capacity}h</span></div><Prog val={e.util} h={5}/></div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:12,fontWeight:700,background:bg,color:fg,borderRadius:6,padding:"2px 7px",minWidth:40,textAlign:"center"}}>{e.util}%</span>
                  {ts&&<span style={{fontSize:10,background:TS_STATUS[ts.status]?.bg,color:TS_STATUS[ts.status]?.fg,borderRadius:4,padding:"1px 5px",fontWeight:600}}>{TS_STATUS[ts.status]?.label}</span>}
                </div>
              </div>
            );})}
          </div>
        </Card>
      </div>
      <Card>
        <SecHd title="8-Week Utilization Heatmap"/>
        <div style={{fontSize:11,color:MUTED,marginBottom:12,display:"flex",gap:14,flexWrap:"wrap"}}>
          {[["No data","#F1F5F9","#94A3B8"],["Under 50%","#FEE2E2","#991B1B"],["50-75%","#FEF3C7","#92400E"],["75-100%","#D1FAE5","#065F46"],["Over 100%","#EDE9FE","#4C1D95"]].map(([lbl,bg,fg])=>(
            <span key={lbl} style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:14,borderRadius:3,background:bg,border:"1px solid "+BORDER,display:"inline-block"}}/><span style={{color:fg,fontWeight:600}}>{lbl}</span></span>
          ))}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
            <thead><tr>
              <th style={{padding:"6px 12px",textAlign:"left",fontWeight:600,color:MUTED,minWidth:160}}>Employee</th>
              {WEEKS.map(w=><th key={w} style={{padding:"6px 8px",textAlign:"center",fontWeight:600,color:MUTED,minWidth:80}}>{w.replace("2026-","")}</th>)}
              <th style={{padding:"6px 8px",textAlign:"center",fontWeight:600,color:MUTED}}>Avg</th>
            </tr></thead>
            <tbody>{heatRows.map(row=>{const valid=row.cells.filter(c=>c.pct>0).map(c=>c.pct);const avg=valid.length?Math.round(valid.reduce((s,v)=>s+v,0)/valid.length):0;return(
              <tr key={row.emp.id}>
                <td style={{padding:"5px 12px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Av name={row.emp.name} color={row.emp.color||TEAL} sz={22}/><span style={{fontWeight:500}}>{row.emp.name.split(" ")[0]}</span></div></td>
                {row.cells.map(c=>{const{bg,fg}=utilColor(c.pct);return<td key={c.week} style={{padding:"3px 5px",textAlign:"center"}}><div title={c.status!=="none"?TS_STATUS[c.status]?.label||c.status:""} style={{background:bg,color:fg,borderRadius:6,padding:"5px 6px",fontWeight:700,fontSize:11,cursor:c.status!=="none"?"help":"default"}}>{c.pct>0?c.pct+"%":"-"}</div></td>;})}
                <td style={{padding:"3px 8px",textAlign:"center"}}><div style={{background:utilColor(avg).bg,color:utilColor(avg).fg,borderRadius:6,padding:"5px 6px",fontWeight:700,fontSize:11}}>{avg>0?avg+"%":"-"}</div></td>
              </tr>
            );})}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Reports({user,employees,projects,allocs,entries,timesheets,leaves}){
  const WEEKS=recentWeeks(8),week=currentWeek();
  const isAdmin=user.role==="admin",isManager=user.role==="manager";
  const visEmps=isAdmin?employees:isManager?employees.filter(e=>e.teamId===user.teamId||e.managerId===user.employeeId):employees.filter(e=>e.id===user.employeeId);
  const totCap=visEmps.reduce((s,e)=>s+e.capacity,0);
  const totLog=entries.filter(e=>visEmps.find(em=>em.id===e.empId)&&e.week===week).reduce((s,e)=>s+e.hours,0);
  const avgUtil=totCap>0?Math.round((totLog/totCap)*100):0;
  const approvedTs=timesheets.filter(t=>t.status==="approved"&&visEmps.find(e=>e.id===t.empId)).length;
  const pendingTs=timesheets.filter(t=>t.status==="submitted"&&visEmps.find(e=>e.id===t.empId)).length;
  const approvedLv=leaves.filter(l=>l.status==="approved"&&visEmps.find(e=>e.id===l.empId)).length;
  const projData=projects.map(p=>({name:p.name.split(" ").slice(0,2).join(" "),logged:entries.filter(e=>String(e.projId)===String(p.id)).reduce((s,e)=>s+e.hours,0),budget:p.budgetHours||0})).filter(p=>p.logged>0||p.budget>0);
  const weekData=WEEKS.map(w=>{const cap=visEmps.reduce((s,e)=>s+e.capacity,0),log=entries.filter(e=>e.week===w&&visEmps.find(em=>em.id===e.empId)).reduce((s,e)=>s+e.hours,0);return{week:w.replace("2026-",""),logged:log,capacity:cap,util:cap>0?Math.round((log/cap)*100):0};});
  const exportCSV=()=>{
    const rows=timesheets.filter(t=>visEmps.find(e=>e.id===t.empId)).flatMap(t=>{
      const emp2=visEmps.find(e=>e.id===t.empId);
      const ents=entries.filter(e=>String(e.empId)===String(t.empId)&&e.week===t.week);
      if(ents.length===0)return[{"Employee":emp2?.name||t.empId,"Department":emp2?.dept||"","Week":t.week,"Project":"","Hours":0,"Notes":"","Timesheet Status":t.status,"Manager Comment":t.comment||""}];
      return ents.map(e=>{const p=projects.find(pr=>String(pr.id)===String(e.projId));return{"Employee":emp2?.name||t.empId,"Department":emp2?.dept||"","Week":t.week,"Project":p?.name||e.projId,"Hours":e.hours,"Notes":e.note||"","Timesheet Status":t.status,"Manager Comment":t.comment||""};});
    });
    if(rows.length===0){alert("No timesheet data to export yet.");return;}
    csvDownload(rows,"timesheet-export-"+currentWeek()+".csv");
  };
  const exportUtilCSV=()=>csvDownload(visEmps.map(e=>({Name:e.name,Department:e.dept,"Weekly Capacity":e.capacity,"This Week":entries.filter(en=>en.empId===e.id&&en.week===week).reduce((s,en)=>s+en.hours,0),"Util%":e.capacity>0?Math.round((entries.filter(en=>en.empId===e.id&&en.week===week).reduce((s,en)=>s+en.hours,0)/e.capacity)*100):0})),"utilization-"+week+".csv");
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px"}}>Reports</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Utilization, project health and leave summaries</p></div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={exportUtilCSV}>Utilization CSV</Btn>
          <Btn primary onClick={exportCSV}>📥 Export All Timesheets</Btn>
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <KPI label="Avg Utilization" value={avgUtil+"%"} sub="This week" icon="📊" alert={avgUtil<60}/>
        <KPI label="Approved Timesheets" value={approvedTs} sub="All time" icon="✅"/>
        <KPI label="Pending Review" value={pendingTs} sub="Awaiting" icon="⏳" alert={pendingTs>0}/>
        <KPI label="Approved Leaves" value={approvedLv} sub="All time" icon="📅"/>
        <KPI label="Active Projects" value={projects.filter(p=>p.status==="active").length} sub={projects.length+" total"} icon="📁"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <Card>
          <SecHd title="8-Week Trend"/>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekData}><CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/><XAxis dataKey="week" tick={{fontSize:11,fill:"#94A3B8"}}/><YAxis tick={{fontSize:11,fill:"#94A3B8"}} unit="h"/><Tooltip/><Legend/>
              <Bar dataKey="capacity" name="Capacity" fill="#E2E8F0" radius={[3,3,0,0]}/><Bar dataKey="logged" name="Logged" fill={TEAL} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SecHd title="Hours by Project"/>
          {projData.length===0?<div style={{color:MUTED,fontSize:13,textAlign:"center",padding:"40px 0"}}>No project hours logged yet.</div>:
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={projData} layout="vertical" margin={{left:4,right:10}}>
              <XAxis type="number" tick={{fontSize:11,fill:"#94A3B8"}}/>
              <YAxis dataKey="name" type="category" tick={{fontSize:11,fill:"#94A3B8"}} width={110}/>
              <Tooltip/><Legend/>
              <Bar dataKey="budget" name="Budget" fill="#E2E8F0" radius={[0,3,3,0]}/><Bar dataKey="logged" name="Logged" fill={TEAL} radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>}
        </Card>
      </div>
      <Card>
        <SecHd title="Employee Utilization Report"/>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#F8FAFC"}}>{["Employee","Dept","Capacity","This Week","Util%","Last Timesheet"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:600,color:MUTED,borderBottom:"1px solid "+BORDER}}>{h}</th>)}</tr></thead>
          <tbody>
            {visEmps.filter(e=>e.active).map(e=>{
              const logged=entries.filter(en=>en.empId===e.id&&en.week===week).reduce((s,en)=>s+en.hours,0);
              const util=e.capacity>0?Math.round((logged/e.capacity)*100):0;
              const lastTs=timesheets.filter(t=>t.empId===e.id).sort((a,b)=>b.week.localeCompare(a.week))[0];
              const{bg,fg}=utilColor(util);
              return(
                <tr key={e.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                  <td style={{padding:"9px 12px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Av name={e.name} color={e.color||TEAL} sz={26}/><span style={{fontWeight:600}}>{e.name}</span></div></td>
                  <td style={{padding:"9px 12px",color:MUTED}}>{e.dept}</td>
                  <td style={{padding:"9px 12px",fontWeight:600}}>{e.capacity}h</td>
                  <td style={{padding:"9px 12px",fontWeight:600,color:TEAL}}>{logged}h</td>
                  <td style={{padding:"9px 12px"}}><span style={{background:bg,color:fg,borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:700}}>{util}%</span></td>
                  <td style={{padding:"9px 12px"}}>{lastTs?<span style={{background:TS_STATUS[lastTs.status]?.bg,color:TS_STATUS[lastTs.status]?.fg,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>{TS_STATUS[lastTs.status]?.label} - {lastTs.week}</span>:<span style={{color:"#94A3B8",fontSize:12}}>No timesheets</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Leaves({user,employees,leaves,setLeaves}){
  const [form,setForm]=useState({empId:String(user.employeeId||""),type:"Annual",from:"",to:"",reason:""});
  const [saving,setSaving]=useState(false);
  const isAdmin=user.role==="admin",isManager=user.role==="manager";
  const myLeaves=leaves.filter(l=>String(l.empId)===String(user.employeeId));
  const apply=async()=>{if(!form.from||!form.to||!form.empId)return;const days=Math.max(1,Math.ceil((new Date(form.to)-new Date(form.from))/864e5)+1);setSaving(true);const{data,error}=await sb.from("leaves").insert({employee_id:form.empId,type:form.type,from_date:form.from,to_date:form.to,days,reason:form.reason,status:"pending"}).select().single();setSaving(false);if(!error&&data){setLeaves(prev=>[toLeave(data),...prev]);setForm(f=>({...f,from:"",to:"",reason:""}));}};
  return(
    <div>
      <div style={{marginBottom:18}}><h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px"}}>My Leaves</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Submit and track your leave requests</p></div>
      <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:14}}>
        <Card>
          <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>Apply for Leave</div>
          {(isAdmin||isManager)&&<SelF label="Employee" value={form.empId} onChange={e=>setForm(f=>({...f,empId:e.target.value}))} options={[{value:"",label:"Select employee..."},...employees.filter(e=>e.active).map(e=>({value:String(e.id),label:e.name}))]}/>}
          <SelF label="Leave Type" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} options={["Annual","Sick","Casual","Maternity","Paternity"].map(t=>({value:t,label:t}))}/>
          <Inp label="From" type="date" value={form.from} onChange={e=>setForm(f=>({...f,from:e.target.value}))} required/>
          <Inp label="To"   type="date" value={form.to}   onChange={e=>setForm(f=>({...f,to:e.target.value}))}   required/>
          <Inp label="Reason" value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Optional"/>
          <Btn primary full disabled={saving} onClick={apply}>{saving?<><Spin/>Submitting...</>:"Submit Request"}</Btn>
        </Card>
        <Card>
          <SecHd title="My Leave History"/>
          {myLeaves.length===0&&<div style={{color:"#94A3B8",fontSize:13,textAlign:"center",padding:"24px 0"}}>No leave requests yet.</div>}
          {myLeaves.map(l=><div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#F8FAFC",borderRadius:8,marginBottom:7,border:"1px solid "+BORDER}}>
            <div style={{flex:1}}><span style={{fontSize:13,fontWeight:500}}>{l.type} Leave</span><div style={{fontSize:12,color:MUTED}}>{l.from} to {l.to} - {l.days} day{l.days>1?"s":""}</div>{l.reason&&<div style={{fontSize:12,color:"#94A3B8"}}>{l.reason}</div>}</div>
            <Badge s={l.status}/>
          </div>)}
        </Card>
      </div>
    </div>
  );
}

function Profile({user,setUser}){
  const [form,setForm]=useState({name:user.name||"",phone:user.phone||""});
  const [pwdForm,setPwdForm]=useState({newpwd:"",confirm:""});
  const [saving,setSaving]=useState(false);const [pwdSav,setPwdSav]=useState(false);
  const [msg,setMsg]=useState({type:"",text:""});const [pwdMsg,setPwdMsg]=useState({type:"",text:""});
  const saveProfile=async()=>{setSaving(true);setMsg({type:"",text:""});const{error}=await sb.from("app_users").update({name:form.name,phone:form.phone}).eq("id",user.id);setSaving(false);if(error)setMsg({type:"error",text:error.message});else{setUser(u=>({...u,name:form.name,phone:form.phone}));setMsg({type:"ok",text:"Profile updated."});}};
  const changePwd=async()=>{if(!pwdForm.newpwd||pwdForm.newpwd.length<8){setPwdMsg({type:"error",text:"Min 8 characters."});return;}if(pwdForm.newpwd!==pwdForm.confirm){setPwdMsg({type:"error",text:"Passwords do not match."});return;}setPwdSav(true);setPwdMsg({type:"",text:""});const{error}=await sb.auth.updateUser({password:pwdForm.newpwd});setPwdSav(false);if(error)setPwdMsg({type:"error",text:error.message});else{setPwdMsg({type:"ok",text:"Password changed."});setPwdForm({newpwd:"",confirm:""});}};
  return(
    <div style={{maxWidth:700}}>
      <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px"}}>My Profile</h1><p style={{color:MUTED,fontSize:13,margin:0}}>Manage your account and security settings</p></div>
      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:22,padding:16,background:"#F8FAFC",borderRadius:10}}>
          <div style={{width:60,height:60,borderRadius:"50%",background:(user.avatarColor||TEAL)+"22",color:user.avatarColor||TEAL,fontWeight:800,fontSize:22,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid "+(user.avatarColor||TEAL)+"44"}}>
            {(user.name||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}
          </div>
          <div><div style={{fontSize:17,fontWeight:700}}>{user.name}</div><div style={{fontSize:13,color:MUTED}}>{user.email}</div><div style={{marginTop:6}}><RoleBadge role={user.role}/></div></div>
        </div>
        <Alrt type={msg.type} msg={msg.text}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Inp label="Full Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
          <Inp label="Phone"     value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+1 555 000 0000"/>
          <Inp label="Email" value={user.email||""} disabled/>
          <Inp label="Role"  value={user.role||""}  disabled/>
        </div>
        <Btn primary disabled={saving} onClick={saveProfile}>{saving?<><Spin/>Saving...</>:"Save Changes"}</Btn>
      </Card>
      <Card>
        <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>Change Password</div>
        <Alrt type={pwdMsg.type} msg={pwdMsg.text}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <Inp label="New Password"     type="password" value={pwdForm.newpwd}  onChange={e=>setPwdForm(f=>({...f,newpwd:e.target.value}))}  placeholder="Min 8 characters"/>
          <Inp label="Confirm Password" type="password" value={pwdForm.confirm} onChange={e=>setPwdForm(f=>({...f,confirm:e.target.value}))} placeholder="Repeat password"/>
        </div>
        <Btn primary disabled={pwdSav} onClick={changePwd}>{pwdSav?<><Spin/>Updating...</>:"Update Password"}</Btn>
      </Card>
    </div>
  );
}

function Teams({user,teams,setTeams,employees,setEmployees}){
  const isAdmin=user.role==="admin";
  const [showNew,setShowNew]=useState(false);const [sel,setSel]=useState(null);
  const [form,setForm]=useState({name:"",description:"",managerId:"",color:TEAL});const [loading,setLoading]=useState(false);
  const visTeams=isAdmin?teams:teams.filter(t=>t.managerId===user.employeeId||String(t.managerId)===String(user.employeeId));
  const TEAM_COLORS=[TEAL,"#8B5CF6","#3B82F6","#F59E0B","#EF4444","#10B981","#EC4899"];
  const createTeam=async()=>{if(!form.name)return;setLoading(true);const{data,error}=await sb.from("teams").insert({name:form.name,description:form.description,manager_id:form.managerId||null,color:form.color}).select().single();setLoading(false);if(error){alert(error.message);return;}setTeams(prev=>[...prev,{id:data.id,name:data.name,description:data.description||"",managerId:data.manager_id,color:data.color||TEAL,members:[]}]);setForm({name:"",description:"",managerId:"",color:TEAL});setShowNew(false);};
  const addMember=async(teamId,empId)=>{const{error}=await sb.from("team_members").upsert({team_id:teamId,employee_id:empId},{onConflict:"team_id,employee_id"});if(!error){setTeams(prev=>prev.map(t=>t.id===teamId?{...t,members:[...t.members,empId]}:t));setEmployees(prev=>prev.map(e=>e.id===empId||String(e.id)===String(empId)?{...e,teamId}:e));}};
  const removeMember=async(teamId,empId)=>{const{error}=await sb.from("team_members").delete().eq("team_id",teamId).eq("employee_id",empId);if(!error)setTeams(prev=>prev.map(t=>t.id===teamId?{...t,members:t.members.filter(m=>m!==empId)}:t));};
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px"}}>Teams</h1><p style={{color:MUTED,fontSize:13,margin:0}}>{visTeams.length} teams</p></div>
        {isAdmin&&<Btn primary onClick={()=>setShowNew(v=>!v)}>+ Create Team</Btn>}
      </div>
      {showNew&&<Card style={{marginBottom:14,border:"1px solid #06D6A033",background:"#F0FDF9"}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>New Team</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
          <div style={{paddingRight:12}}><Inp label="Team Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/><Inp label="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
          <div style={{paddingLeft:12}}>
            <SelF label="Manager" value={form.managerId} onChange={e=>setForm(f=>({...f,managerId:e.target.value}))} options={[{value:"",label:"None yet"},...employees.filter(e=>e.active).map(e=>({value:String(e.id),label:e.name}))]}/>
            <div style={{marginBottom:14}}><label style={{fontSize:12,fontWeight:600,color:TEXT,display:"block",marginBottom:8}}>Team Color</label><div style={{display:"flex",gap:8}}>{TEAM_COLORS.map(c=><div key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid "+TEXT:"3px solid transparent"}}/>)}</div></div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}><Btn primary small disabled={loading} onClick={createTeam}>{loading?<Spin/>:"Create"}</Btn><Btn small onClick={()=>setShowNew(false)}>Cancel</Btn></div>
      </Card>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
        {visTeams.map(t=>{const members=employees.filter(e=>t.members?.includes(e.id)||t.members?.includes(String(e.id)));const manager=employees.find(e=>e.id===t.managerId||String(e.id)===String(t.managerId));const isOpen=sel===t.id;const unassigned=employees.filter(e=>e.active&&!t.members?.includes(e.id)&&!t.members?.includes(String(e.id)));return(
          <Card key={t.id}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:40,height:40,borderRadius:10,background:t.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🏢</div>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700}}>{t.name}</div>{t.description&&<div style={{fontSize:12,color:MUTED}}>{t.description}</div>}</div>
              <button onClick={()=>setSel(isOpen?null:t.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:MUTED}}>{isOpen?"▲":"▼"}</button>
            </div>
            {manager&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#F8FAFC",borderRadius:8,marginBottom:10}}>
              <Av name={manager.name} color={manager.color||TEAL} sz={22}/>
              <div><div style={{fontSize:12,fontWeight:600}}>{manager.name}</div><div style={{fontSize:11,color:MUTED}}>Team Manager</div></div>
            </div>}
            <div style={{display:"flex",gap:3,marginBottom:6,flexWrap:"wrap"}}>{members.slice(0,5).map(m=><Av key={m.id} name={m.name} color={m.color||TEAL} sz={26}/>)}{members.length>5&&<div style={{width:26,height:26,borderRadius:"50%",background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:MUTED}}>+{members.length-5}</div>}</div>
            <div style={{fontSize:12,color:MUTED}}>{members.length} member{members.length!==1?"s":""}</div>
            {isOpen&&isAdmin&&<div style={{marginTop:14,borderTop:"1px solid "+BORDER,paddingTop:12}}>
              {members.map(m=><div key={m.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}><Av name={m.name} color={m.color||TEAL} sz={22}/><span style={{flex:1,fontSize:13,fontWeight:500}}>{m.name}</span><button onClick={()=>removeMember(t.id,m.id)} style={{border:"none",background:"#FEE2E2",color:"#991B1B",borderRadius:6,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>Remove</button></div>)}
              {unassigned.length>0&&<select defaultValue="" onChange={e=>{if(e.target.value)addMember(t.id,e.target.value);}} style={{width:"100%",padding:"7px 10px",border:"1px solid "+BORDER,borderRadius:6,fontSize:13,marginTop:8}}><option value="">Add member...</option>{unassigned.map(e=><option key={e.id} value={String(e.id)}>{e.name}</option>)}</select>}
            </div>}
          </Card>
        );})}
        {visTeams.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"60px 0",color:MUTED}}>{isAdmin?"No teams yet.":"You are not managing any teams."}</div>}
      </div>
    </div>
  );
}

function Employees({user,employees,setEmployees,allocs,teams}){
  const [showInvite,setShowInvite]=useState(false);const [showEdit,setShowEdit]=useState(false);const [editTarget,setEditTarget]=useState(null);const [delTarget,setDelTarget]=useState(null);
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [ok,setOk]=useState("");const [search,setSearch]=useState("");
  const [importing,setImporting]=useState(false);
  const downloadTemplate=()=>csvDownload([{name:"Jane Smith",email:"jane@company.com",role:"user",department:"Engineering",jobTitle:"Developer",capacity:40,phone:""}],"employee-import-template.csv");
  const importCSV=async file=>{
    if(!file)return;setImporting(true);setErr("");setOk("");
    const text=await file.text();const rows=text.trim().split("\n").slice(1);
    let ok2=0,fail=0;
    for(const row of rows){const cols=row.split(",").map(c=>c.replace(/^"|"$/g,"").trim());const[name,email,role,department,jobTitle,capacity,phone]=cols;if(!name||!email){fail++;continue;}try{const res=await fetch("/api/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,role:role||"user",department,jobTitle,capacity:+capacity||40,phone})});if(res.ok)ok2++;else fail++;}catch{fail++;}}
    setImporting(false);if(ok2>0)setOk(ok2+" employee(s) imported and invited.");if(fail>0)setErr(fail+" row(s) failed - check emails and format.");
  };const [fDept,setFDept]=useState("");
  const blank={name:"",email:"",role:"user",department:"",jobTitle:"",capacity:"40",teamId:"",phone:""};const [form,setForm]=useState(blank);const F=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const [importing,setImporting]=useState(false);
  const downloadTemplate=()=>csvDownload([{name:"Jane Smith",email:"jane@company.com",role:"user",department:"Engineering",jobTitle:"Developer",capacity:40,phone:""}],"employee-import-template.csv");
  const importCSV=async(file)=>{
    if(!file)return;setImporting(true);setErr("");setOk("");
    const text=await file.text();
    const rows=text.trim().split("\n").slice(1); // skip header
    let success=0,failed=0;
    for(const row of rows){
      const cols=row.split(",").map(c=>c.replace(/^"|"$/g,"").trim());
      const [name,email,role,department,jobTitle,capacity,phone]=cols;
      if(!name||!email){failed++;continue;}
      try{
        const res=await fetch("/api/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,role:role||"user",department,jobTitle,capacity:+capacity||40,phone})});
        if(res.ok)success++;else failed++;
      }catch{failed++;}
    }
    setImporting(false);
    if(success>0)setOk(success+" employee(s) imported and invited.");
    if(failed>0)setErr(failed+" row(s) failed - check emails and format.");
  };
  const depts=[...new Set(employees.map(e=>e.dept))].filter(Boolean);
  const filtered=employees.filter(e=>{const q=search.toLowerCase();return(!q||(e.name||"").toLowerCase().includes(q)||(e.email||"").toLowerCase().includes(q))&&(!fDept||e.dept===fDept);});
  const sendInvite=async()=>{if(!form.name||!form.email){setErr("Name and email required.");return;}setLoading(true);setErr("");setOk("");try{const res=await fetch("/api/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:form.name,email:form.email,role:form.role,department:form.department,jobTitle:form.jobTitle,capacity:+form.capacity||40,teamId:form.teamId||null,phone:form.phone})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Invite failed");setEmployees(prev=>[...prev,{id:data.employeeId||Date.now(),name:form.name,email:form.email,dept:form.department,role:form.jobTitle,capacity:+form.capacity||40,active:true,teamId:form.teamId||null,color:AVA_COLORS[employees.length%AVA_COLORS.length],appRole:form.role}]);setOk("Invite sent to "+form.email);setForm(blank);setShowInvite(false);}catch(e){setErr(e.message);}finally{setLoading(false);}};
  const saveEdit=async()=>{const{error}=await sb.from("employees").update({name:form.name,department:form.department,role:form.jobTitle,capacity:+form.capacity||40,active:form.active!=="false",phone:form.phone}).eq("id",editTarget.id);if(error){setErr(error.message);return;}setEmployees(prev=>prev.map(e=>e.id===editTarget.id?{...e,name:form.name,dept:form.department,role:form.jobTitle,capacity:+form.capacity||40,active:form.active!=="false",phone:form.phone}:e));setShowEdit(false);setEditTarget(null);setOk("Employee updated.");};
  const toggleActive=async emp=>{const{error}=await sb.from("employees").update({active:!emp.active}).eq("id",emp.id);if(!error)setEmployees(prev=>prev.map(e=>e.id===emp.id?{...e,active:!e.active}:e));};
  const changeRole=async(emp,newRole)=>{
    let updated=false;
    const{data:au}=await sb.from("app_users").select("id").eq("employee_id",emp.id).single();
    if(au){await sb.from("app_users").update({role:newRole}).eq("id",au.id);updated=true;}
    if(!updated){const{data:auE}=await sb.from("app_users").select("id").eq("email",emp.email).single();if(auE)await sb.from("app_users").update({role:newRole}).eq("id",auE.id);}
    setEmployees(prev=>prev.map(e=>e.id===emp.id?{...e,appRole:newRole}:e));
  };
  const deleteEmp=async emp=>{const{error}=await sb.from("employees").delete().eq("id",emp.id);if(!error){setEmployees(prev=>prev.filter(e=>e.id!==emp.id));setDelTarget(null);}else setErr(error.message);};
  const openEdit=emp=>{setForm({name:emp.name,email:emp.email,role:emp.appRole||"user",department:emp.dept,jobTitle:emp.role,capacity:String(emp.capacity),teamId:emp.teamId||"",phone:emp.phone||"",active:String(emp.active)});setEditTarget(emp);setShowEdit(true);};
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:"0 0 3px"}}>Employees</h1><p style={{color:MUTED,fontSize:13,margin:0}}>{employees.filter(e=>e.active).length} active / {employees.length} total</p></div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <label style={{padding:"8px 14px",borderRadius:8,border:"1px solid "+BORDER,background:WHITE,fontSize:13,fontWeight:500,cursor:importing?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6,opacity:importing?0.6:1}}>
            {importing?<><Spin dark/>Importing...</>:"📥 Import CSV"}
            <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importCSV(e.target.files[0]);e.target.value="";}}/>
          </label>
          <Btn onClick={downloadTemplate}>📋 Template</Btn>
          <div style={{display:"flex",gap:8}}>
          <label style={{padding:"8px 14px",borderRadius:8,border:"1px solid "+BORDER,background:WHITE,fontSize:13,fontWeight:500,cursor:importing?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6,opacity:importing?0.6:1}}>
            {importing?<><Spin dark/>Importing...</>:"📥 Import CSV"}
            <input type="file" accept=".csv" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importCSV(e.target.files[0]);e.target.value="";}}/>
          </label>
          <Btn onClick={downloadTemplate}>📋 CSV Template</Btn>
          <Btn primary onClick={()=>{setForm(blank);setErr("");setOk("");setShowInvite(true);}}>+ Invite Employee</Btn>
        </div></div>
      </div>
      {ok&&<Alrt type="ok" msg={ok}/>}
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employees..." style={{flex:1,padding:"8px 14px",border:"1px solid "+BORDER,borderRadius:8,fontSize:13}}/>
        <select value={fDept} onChange={e=>setFDept(e.target.value)} style={{padding:"8px 14px",border:"1px solid "+BORDER,borderRadius:8,fontSize:13,minWidth:160}}>
          <option value="">All Departments</option>{depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <Card style={{padding:0,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#F8FAFC"}}>{["Employee","Department","Job Title","Cap","Team","System Role","Status","Actions"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:MUTED,borderBottom:"1px solid "+BORDER}}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(e=>{const team=teams.find(t=>t.id===e.teamId||String(t.id)===String(e.teamId));return(
              <tr key={e.id} style={{borderBottom:"1px solid #F1F5F9",opacity:e.active?1:.55}}>
                <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><Av name={e.name} color={e.color||TEAL} sz={28}/><div><div style={{fontWeight:600}}>{e.name}</div><div style={{fontSize:11,color:MUTED}}>{e.email}</div></div></div></td>
                <td style={{padding:"10px 14px"}}><span style={{background:(e.color||TEAL)+"22",color:e.color||TEAL,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>{e.dept||"-"}</span></td>
                <td style={{padding:"10px 14px",color:MUTED,fontSize:12}}>{e.role||"-"}</td>
                <td style={{padding:"10px 14px",fontWeight:600}}>{e.capacity}h</td>
                <td style={{padding:"10px 14px",color:MUTED,fontSize:12}}>{team?.name||"-"}</td>
                <td style={{padding:"8px 14px"}}>
                  <select value={e.appRole||"user"} onChange={ev=>changeRole(e,ev.target.value)}
                    style={{padding:"5px 8px",border:"1px solid "+BORDER,borderRadius:6,fontSize:12,fontWeight:600,background:ROLE_C[e.appRole||"user"]+"18",color:ROLE_C[e.appRole||"user"],cursor:"pointer"}}>
                    <option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option>
                  </select>
                </td>
                <td style={{padding:"10px 14px"}}><Badge s={e.active?"active":"inactive"}/></td>
                <td style={{padding:"10px 14px"}}><div style={{display:"flex",gap:5}}>
                  <Btn small onClick={()=>openEdit(e)}>Edit</Btn>
                  <Btn small onClick={()=>toggleActive(e)} style={{background:e.active?"#FEF3C7":"#F0FDF9",color:e.active?"#92400E":"#065F46",border:"none"}}>{e.active?"Deactivate":"Activate"}</Btn>
                  <Btn small danger onClick={()=>setDelTarget(e)}>Delete</Btn>
                </div></td>
              </tr>
            );})}
            {filtered.length===0&&<tr><td colSpan={8} style={{padding:"32px",textAlign:"center",color:MUTED}}>No employees found.</td></tr>}
          </tbody>
        </table>
      </Card>
      {showInvite&&<Modal title="Invite New Employee" onClose={()=>setShowInvite(false)} width={560}>
        {err&&<Alrt type="error" msg={err}/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
          <div style={{paddingRight:12}}><Inp label="Full Name" value={form.name} onChange={F("name")} required placeholder="Jane Smith"/><Inp label="Work Email" type="email" value={form.email} onChange={F("email")} required placeholder="jane@company.com"/><Inp label="Phone" value={form.phone} onChange={F("phone")} placeholder="+1 555 000 0000"/><Inp label="Weekly Capacity (hrs)" type="number" value={form.capacity} onChange={F("capacity")} placeholder="40"/></div>
          <div style={{paddingLeft:12}}><Inp label="Department" value={form.department} onChange={F("department")} placeholder="Engineering"/><Inp label="Job Title" value={form.jobTitle} onChange={F("jobTitle")} placeholder="Developer"/><SelF label="System Role" value={form.role} onChange={F("role")} options={[{value:"user",label:"User"},{value:"manager",label:"Manager"},{value:"admin",label:"Admin"}]}/><SelF label="Assign to Team" value={form.teamId} onChange={F("teamId")} options={[{value:"",label:"No team yet"},...teams.map(t=>({value:String(t.id),label:t.name}))]}/></div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:8,paddingTop:14,borderTop:"1px solid "+BORDER}}>
          <Btn primary full disabled={loading} onClick={sendInvite}>{loading?<><Spin/>Sending...</>:"Send Invite Email"}</Btn>
          <Btn full onClick={()=>setShowInvite(false)}>Cancel</Btn>
        </div>
        <div style={{marginTop:12,fontSize:12,color:MUTED,background:"#F8FAFC",borderRadius:8,padding:"10px 12px"}}>The employee will receive an email to set their password and access ResTrack.</div>
      </Modal>}
      {showEdit&&editTarget&&<Modal title={"Edit - "+editTarget.name} onClose={()=>{setShowEdit(false);setEditTarget(null);}}>
        {err&&<Alrt type="error" msg={err}/>}
        <Inp label="Full Name" value={form.name} onChange={F("name")} required/><Inp label="Department" value={form.department} onChange={F("department")}/><Inp label="Job Title" value={form.jobTitle} onChange={F("jobTitle")}/><Inp label="Phone" value={form.phone} onChange={F("phone")}/><Inp label="Weekly Capacity" type="number" value={form.capacity} onChange={F("capacity")}/>
        <SelF label="Status" value={form.active} onChange={F("active")} options={[{value:"true",label:"Active"},{value:"false",label:"Inactive"}]}/>
        <div style={{display:"flex",gap:10,marginTop:8}}><Btn primary full onClick={saveEdit}>Save Changes</Btn><Btn full onClick={()=>{setShowEdit(false);setEditTarget(null);}}>Cancel</Btn></div>
      </Modal>}
      {delTarget&&<Modal title="Delete Employee" onClose={()=>setDelTarget(null)} width={400}>
        <p style={{fontSize:14,color:TEXT,marginBottom:20}}>Permanently delete <strong>{delTarget.name}</strong>? This cannot be undone.</p>
        <div style={{display:"flex",gap:10}}><Btn danger full onClick={()=>deleteEmp(delTarget)}>Yes, Delete</Btn><Btn full onClick={()=>setDelTarget(null)}>Cancel</Btn></div>
      </Modal>}
    </div>
  );
}

function NotifPanel({notifs,setNotifs,onClose}){
  const markAll=async()=>{await sb.from("notifications").update({read:true}).eq("read",false);setNotifs(prev=>prev.map(n=>({...n,read:true})));};
  const TYPE_ICON={success:"✅",warn:"⚠️",timesheet:"📋",info:"🔔"};
  return(
    <div style={{position:"fixed",top:0,right:0,width:360,height:"100vh",background:WHITE,boxShadow:"-4px 0 30px #00000020",zIndex:500,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"18px 20px",borderBottom:"1px solid "+BORDER,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:15,fontWeight:700}}>Notifications</span>
        <div style={{display:"flex",gap:10}}>
          <button onClick={markAll} style={{fontSize:12,color:TEAL,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Mark all read</button>
          <button onClick={onClose} style={{border:"none",background:"none",fontSize:20,cursor:"pointer",color:MUTED}}>x</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        {notifs.length===0&&<div style={{textAlign:"center",color:MUTED,fontSize:13,padding:"40px 0"}}>No notifications</div>}
        {notifs.map(n=><div key={n.id} style={{display:"flex",gap:10,padding:"10px 12px",borderRadius:8,marginBottom:8,background:n.read?"#F8FAFC":"#F0FDF9",border:"1px solid "+(n.read?BORDER:TEAL+"33")}}>
          <span style={{fontSize:18,flexShrink:0}}>{TYPE_ICON[n.type]||"🔔"}</span>
          <div style={{flex:1}}><div style={{fontSize:13,color:TEXT,lineHeight:1.4}}>{n.message}</div><div style={{fontSize:11,color:MUTED,marginTop:4}}>{n.createdAt?new Date(n.createdAt).toLocaleString():""}</div></div>
        </div>)}
      </div>
    </div>
  );
}

export default function App(){
  const [session,setSession]=useState(null);const [authLoading,setAuthLoading]=useState(true);
  const [user,setUser]=useState(null);const [view,setView]=useState("dashboard");const [dataLoading,setDataLoading]=useState(false);
  const [employees,setEmployees]=useState([]);const [projects,setProjects]=useState([]);const [allocs,setAllocs]=useState([]);
  const [entries,setEntries]=useState([]);const [leaves,setLeaves]=useState([]);const [teams,setTeams]=useState([]);
  const [timesheets,setTimesheets]=useState([]);const [notifs,setNotifs]=useState([]);const [showNotifs,setShowNotifs]=useState(false);

  useEffect(()=>{sb.auth.getSession().then(({data:{session:s}})=>{setSession(s);setAuthLoading(false);});const{data:{subscription}}=sb.auth.onAuthStateChange((_,s)=>setSession(s));return()=>subscription.unsubscribe();},[]);
  useEffect(()=>{if(!session){setUser(null);return;}loadAll(session.user);},[session]);

  async function loadAll(authUser){
    setDataLoading(true);
    let{data:profile}=await sb.from("app_users").select("*").eq("id",authUser.id).single();
    // Fallback: create profile from auth metadata if missing
    if(!profile){
      const meta=authUser.user_metadata||{};
      let empId=null;
      // Try to find or create employee record
      const{data:existEmp}=await sb.from("employees").select("id").eq("email",authUser.email).single();
      if(existEmp){empId=existEmp.id;}
      else{const{data:newEmp}=await sb.from("employees").insert({name:meta.name||authUser.email?.split("@")[0]||"User",email:authUser.email,department:"Management",role:"Administrator",capacity:40,active:true}).select().single();if(newEmp)empId=newEmp.id;}
      await sb.from("app_users").upsert({id:authUser.id,name:meta.name||authUser.email?.split("@")[0]||"User",email:authUser.email,role:meta.role||"admin",employee_id:empId,is_active:true,avatar_color:TEAL},{onConflict:"id"});
      const{data:newProfile}=await sb.from("app_users").select("*").eq("id",authUser.id).single();
      profile=newProfile;
    }
    const u={id:authUser.id,email:authUser.email,name:profile?.name||authUser.user_metadata?.name||authUser.email?.split("@")[0]||"User",role:profile?.role||authUser.user_metadata?.role||"user",teamId:profile?.team_id||null,employeeId:profile?.employee_id||null,avatarColor:profile?.avatar_color||TEAL,phone:profile?.phone||""};
    setUser(u);
    const isAdmin=u.role==="admin",isManager=u.role==="manager";
    const[empR,projR,allocR,entryR,leaveR,teamR,memberR,tsR,notifR,appUR]=await Promise.all([sb.from("employees").select("*").order("name"),sb.from("projects").select("*").order("name"),sb.from("allocations").select("*"),sb.from("time_entries").select("*"),sb.from("leaves").select("*").order("created_at",{ascending:false}),sb.from("teams").select("*").order("name"),sb.from("team_members").select("*"),sb.from("timesheets").select("*"),sb.from("notifications").select("*").eq("user_id",authUser.id).order("created_at",{ascending:false}).limit(30),sb.from("app_users").select("id,role,employee_id")]);
    const allEmps=(empR.data||[]).map(toEmp),allTeams=(teamR.data||[]).map(toTeam),members=memberR.data||[],appU=appUR.data||[];
    allTeams.forEach(t=>{t.members=members.filter(m=>m.team_id===t.id).map(m=>m.employee_id);});
    allEmps.forEach(e=>{const au=appU.find(a=>a.employee_id===e.id);if(au)e.appRole=au.role;});
    const visEmps=isAdmin?allEmps:isManager?allEmps.filter(e=>e.teamId===u.teamId||e.managerId===u.employeeId||e.id===u.employeeId):allEmps.filter(e=>e.id===u.employeeId);
    setEmployees(visEmps);setProjects((projR.data||[]).map(toProj));setAllocs((allocR.data||[]).map(toAlloc));
    setEntries((entryR.data||[]).map(toEntry).filter(e=>isAdmin||visEmps.find(em=>em.id===e.empId)));
    setLeaves((leaveR.data||[]).map(toLeave).filter(l=>isAdmin||visEmps.find(e=>e.id===l.empId)));
    setTeams(allTeams);setTimesheets((tsR.data||[]).map(toTs).filter(t=>isAdmin||visEmps.find(e=>e.id===t.empId)));
    setNotifs((notifR.data||[]).map(toNotif));setDataLoading(false);
  }

  const logout=async()=>{await sb.auth.signOut();setSession(null);setUser(null);};
  const isAdmin=user?.role==="admin",isManager=user?.role==="manager";
  const unread=notifs.filter(n=>!n.read).length;
  const pendingCount=(isAdmin||isManager)?(timesheets.filter(t=>{if(t.status!=="submitted")return false;const e=employees.find(em=>em.id===t.empId);return isAdmin||e?.managerId===user?.employeeId||e?.teamId===user?.teamId;}).length+leaves.filter(l=>{if(l.status!=="pending")return false;const e=employees.find(em=>em.id===l.empId);return isAdmin||e?.managerId===user?.employeeId||e?.teamId===user?.teamId;}).length):0;

  const nav=[
    {id:"dashboard",   label:"Dashboard",   icon:"📊"},
    ...(isAdmin||isManager?[{id:"teams",      label:"Teams",       icon:"🏢"}]:[]),
    ...(isAdmin           ?[{id:"employees",  label:"Employees",   icon:"👥"}]:[]),
    ...(isAdmin||isManager?[{id:"projects",   label:"Projects",    icon:"📁"}]:[]),
    ...(isAdmin||isManager?[{id:"approvals",  label:"Approvals",   icon:"✅",badge:pendingCount}]:[]),
    {id:"timesheets",  label:"Timesheets",  icon:"⏱️"},
    {id:"utilization", label:"Utilization", icon:"📈"},
    ...(isAdmin||isManager?[{id:"reports",    label:"Reports",     icon:"📊"}]:[]),
    {id:"leaves",      label:"My Leaves",   icon:"📅"},
    {id:"profile",     label:"My Profile",  icon:"👤"},
  ];

  if(authLoading)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:BG,flexDirection:"column",gap:12,fontFamily:"'Segoe UI',system-ui,sans-serif"}}><Spin dark/><div style={{fontSize:14,color:MUTED}}>Loading...</div></div>;
  if(!session||!user)return<><style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style><LoginPage/></>;
  if(dataLoading)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:BG,flexDirection:"column",gap:12,fontFamily:"'Segoe UI',system-ui,sans-serif"}}><Spin dark/><div style={{fontSize:14,color:MUTED}}>Loading your data...</div></div>;

  return(
    <>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{display:"flex",fontFamily:"'Segoe UI',system-ui,sans-serif",background:BG,minHeight:"100vh"}}>
        <aside style={{width:232,background:NAV,position:"sticky",top:0,height:"100vh",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
          <div style={{padding:"18px 16px 14px",borderBottom:"1px solid #ffffff14"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:9,background:TEAL,display:"flex",alignItems:"center",justifyContent:"center",color:NAV,fontWeight:900,fontSize:16}}>R</div>
                <div><div style={{color:"#fff",fontWeight:800,fontSize:16}}>ResTrack</div><div style={{fontSize:10,color:"#ffffff50"}}>Resource Management</div></div>
              </div>
              <button onClick={()=>setShowNotifs(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",position:"relative",padding:4}}>
                <span style={{fontSize:20}}>🔔</span>
                {unread>0&&<span style={{position:"absolute",top:0,right:0,background:"#EF4444",color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}
              </button>
            </div>
          </div>
          <div style={{padding:"10px 14px",borderBottom:"1px solid #ffffff14"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"#ffffff0e",borderRadius:10}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:(user.avatarColor||TEAL)+"33",color:user.avatarColor||TEAL,fontWeight:700,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",border:"1.5px solid "+(user.avatarColor||TEAL)+"44",flexShrink:0}}>
                {(user.name||"?").split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,color:"#fff",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div><div style={{fontSize:10,color:"#ffffff50",textTransform:"capitalize"}}>{user.role}</div></div>
            </div>
          </div>
          <nav style={{flex:1,padding:"10px 8px"}}>
            {nav.map(item=>(
              <button key={item.id} onClick={()=>setView(item.id)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 10px",borderRadius:9,border:"none",cursor:"pointer",background:view===item.id?"#ffffff18":"transparent",color:view===item.id?"#fff":"#ffffff60",fontSize:13,fontWeight:view===item.id?600:400,marginBottom:2,transition:"all .15s",textAlign:"left",borderLeft:view===item.id?"2.5px solid "+TEAL:"2.5px solid transparent"}}>
                <span style={{fontSize:15}}>{item.icon}</span>
                <span style={{flex:1}}>{item.label}</span>
                {item.badge>0&&<span style={{background:"#EF4444",color:"#fff",borderRadius:999,padding:"1px 6px",fontSize:10,fontWeight:700}}>{item.badge}</span>}
              </button>
            ))}
          </nav>
          <div style={{padding:"12px 16px",borderTop:"1px solid #ffffff14"}}>
            <button onClick={logout} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",borderRadius:9,border:"none",cursor:"pointer",background:"transparent",color:"#ffffff50",fontSize:13,textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.color="#fff"} onMouseLeave={e=>e.currentTarget.style.color="#ffffff50"}>
              <span style={{fontSize:16}}>🚪</span>Sign Out
            </button>
          </div>
        </aside>
        <main style={{flex:1,padding:28,overflowX:"hidden",maxWidth:"calc(100vw - 232px)"}}>
          {view==="dashboard"   &&<Dashboard    user={user} employees={employees} projects={projects} allocs={allocs} entries={entries} leaves={leaves} timesheets={timesheets} teams={teams} setView={setView}/>}
          {view==="employees"   &&<Employees    user={user} employees={employees} setEmployees={setEmployees} allocs={allocs} teams={teams}/>}
          {view==="teams"       &&<Teams        user={user} teams={teams} setTeams={setTeams} employees={employees} setEmployees={setEmployees}/>}
          {view==="projects"    &&<Projects     user={user} projects={projects} setProjects={setProjects} allocs={allocs} setAllocs={setAllocs} employees={employees} entries={entries}/>}
          {view==="approvals"   &&<Approvals    user={user} employees={employees} timesheets={timesheets} setTimesheets={setTimesheets} leaves={leaves} setLeaves={setLeaves} entries={entries} projects={projects}/>}
          {view==="timesheets"  &&<Timesheets   user={user} employees={employees} projects={projects} allocs={allocs} entries={entries} setEntries={setEntries} timesheets={timesheets} setTimesheets={setTimesheets} setView={setView}/>}
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
