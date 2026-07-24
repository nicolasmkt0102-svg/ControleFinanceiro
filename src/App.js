import { useState, useEffect, useRef, useMemo } from "react";
import { useUser, SignIn, SignUp, UserButton, useAuth } from "@clerk/clerk-react";

const C = {
  bg:"#0F1117",card:"#1A1D27",cardBorder:"#2A2510",
  gold:"#F0B429",goldDim:"rgba(240,180,41,0.1)",goldMid:"rgba(240,180,41,0.2)",
  coral:"#FF6B6B",coralDim:"rgba(255,107,107,0.1)",
  amber:"#FFB347",blue:"#4B9EFF",blueDim:"rgba(75,158,255,0.1)",
  green:"#00C896",greenDim:"rgba(0,200,150,0.1)",
  purple:"#A78BFA",text:"#E8EAF0",textMuted:"#6B7280",textDim:"#9CA3AF",
  inputBg:"#12141C",userBubble:"#1C1500",aiBubble:"#1A1D27",sidebar:"#13151F",
};

const CATEGORIES = {
  alimentacao:{label:"Alimentação",emoji:"🍽️",color:C.amber},
  transporte:{label:"Transporte",emoji:"🚗",color:C.blue},
  moradia:{label:"Moradia",emoji:"🏠",color:C.coral},
  saude:{label:"Saúde",emoji:"💊",color:C.purple},
  lazer:{label:"Lazer",emoji:"🎉",color:"#F472B6"},
  assinatura:{label:"Assinaturas",emoji:"📱",color:C.blue},
  cartao:{label:"Cartão",emoji:"💳",color:C.coral},
  receita:{label:"Receita",emoji:"💰",color:C.gold},
  servico:{label:"Serviço",emoji:"🔧",color:C.green},
  outros:{label:"Outros",emoji:"📦",color:C.textMuted},
};

const MONTHS=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmt=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const today=()=>new Date().toISOString().split("T")[0];
const monthKey=d=>{const x=new Date(d);return`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`;};
const EK="ca2026xk";
function enc(s){try{return btoa(encodeURIComponent(s).split("").map((c,i)=>String.fromCharCode(c.charCodeAt(0)^EK.charCodeAt(i%EK.length))).join(""));}catch{return s;}}
function dec(s){try{return decodeURIComponent(atob(s).split("").map((c,i)=>String.fromCharCode(c.charCodeAt(0)^EK.charCodeAt(i%EK.length))).join(""));}catch{return s;}}
const load=(k,f)=>{try{const v=localStorage.getItem(k);if(!v)return f;try{return JSON.parse(dec(v));}catch{return JSON.parse(v);}}catch{return f;}};
const save=(k,v)=>{try{localStorage.setItem(k,enc(JSON.stringify(v)));}catch{}};

async function callClaude(messages,system,token){
  const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({messages,system})});
  if(res.status===401||res.status===403)throw new Error("unauthorized");
  const data=await res.json();
  return data.content?.map(b=>b.text||"").join("")||"";
}

function getTrialStatus(user){
  const meta=user.publicMetadata||{};
  if(meta.status==="active")return{status:"active",daysLeft:null};
  if(meta.status==="blocked")return{status:"blocked",daysLeft:0};
  if(meta.trial_end){const end=new Date(meta.trial_end);const d=Math.ceil((end-new Date())/(864e5));return d<=0?{status:"expired",daysLeft:0}:{status:"trial",daysLeft:d};}
  const d=Math.floor((new Date()-new Date(user.createdAt))/(864e5));
  return 7-d<=0?{status:"expired",daysLeft:0}:{status:"trial",daysLeft:7-d};
}

function BlockedScreen(){
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",textAlign:"center",color:C.text,fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{fontSize:52,marginBottom:16}}>⏰</div>
      <div style={{fontSize:22,fontWeight:800,color:C.gold,marginBottom:8}}>CashAI</div>
      <div style={{fontSize:17,fontWeight:700,marginBottom:10}}>Seu período gratuito encerrou</div>
      <div style={{fontSize:14,color:C.textMuted,maxWidth:300,lineHeight:1.6,marginBottom:32}}>Assine agora para continuar organizando suas finanças com IA.</div>
      <div style={{width:"100%",maxWidth:320,display:"flex",flexDirection:"column",gap:10}}>
        {[["Mensal","R$39,90 no 1º mês","#"],["Anual","R$197,90/ano 🔥","#"]].map(([l,p,href])=>(
          <a key={l} href={href} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:l==="Anual"?C.goldDim:C.card,border:`1px solid ${l==="Anual"?C.gold:C.cardBorder}`,borderRadius:12,padding:"13px 16px",textDecoration:"none"}}>
            <span style={{fontSize:14,fontWeight:600,color:l==="Anual"?C.gold:C.text}}>{l}</span>
            <span style={{fontSize:14,fontWeight:700,color:l==="Anual"?C.gold:C.textMuted}}>{p}</span>
          </a>
        ))}
      </div>
      <div style={{fontSize:12,color:C.textMuted,marginTop:20}}>Dúvidas? Fale pelo WhatsApp</div>
    </div>
  );
}

function AuthScreen(){
  const[mode,setMode]=useState("signin");
  const ap={variables:{colorPrimary:C.gold,colorBackground:C.card,colorText:C.text,colorInputBackground:C.inputBg,colorInputText:C.text,borderRadius:"10px"},elements:{card:{background:"transparent",boxShadow:"none",border:"none"},rootBox:{width:"100%"}}};
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 16px",fontFamily:"Inter,system-ui,sans-serif",color:C.text}}>
      <div style={{marginBottom:28,textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:8}}>🤖</div>
        <div style={{fontSize:28,fontWeight:800,color:C.gold,letterSpacing:"-1px"}}>CashAI</div>
        <div style={{fontSize:13,color:C.textMuted,marginTop:4}}>Seu assistente financeiro com IA</div>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:20,padding:24,width:"100%",maxWidth:400}}>
        <div style={{display:"flex",gap:8,marginBottom:24}}>
          {[["signin","Entrar"],["signup","Criar conta"]].map(([m,l])=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,background:mode===m?C.goldDim:"transparent",color:mode===m?C.gold:C.textMuted,border:`1px solid ${mode===m?C.gold:C.cardBorder}`,borderRadius:10,padding:"10px",cursor:"pointer",fontSize:14,fontWeight:mode===m?700:400}}>{l}</button>
          ))}
        </div>
        {mode==="signin"?<SignIn routing="hash" appearance={ap}/>:<SignUp routing="hash" appearance={ap}/>}
      </div>
    </div>
  );
}

export default function App(){
  const{isSignedIn,user,isLoaded}=useUser();
  if(!isLoaded)return<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40}}>🤖</div>;
  if(!isSignedIn)return<AuthScreen/>;
  const t=getTrialStatus(user);
  if(t.status==="expired"||t.status==="blocked")return<BlockedScreen/>;
  return<MainApp user={user} trialDaysLeft={t.daysLeft}/>;
}

const NAV=[{id:"chat",icon:"💬",label:"Chat"},{id:"dashboard",icon:"📊",label:"Extrato"},{id:"budget",icon:"🎯",label:"Orçamento"},{id:"relatorios",icon:"📈",label:"Relatórios"},{id:"clientes",icon:"👥",label:"Clientes"},{id:"agendamentos",icon:"📅",label:"Agenda"}];

function MainApp({user,trialDaysLeft}){
  const uid=user.id;
  const{getToken}=useAuth();
  const[tab,setTab]=useState("chat");
  const[mob,setMob]=useState(false);
  const[transactions,setTransactions]=useState(()=>{const n=load(`ca_tx_${uid}`,[]);const o=load(`cf_tx_${uid}`,[]);return n.length>0?n:o;});
  const[budgets,setBudgets]=useState(()=>{const n=load(`ca_bg_${uid}`,[]);const o=load(`cf_bg_${uid}`,[]);return n.length>0?n:o;});
  const[clientes,setClientes]=useState(()=>load(`ca_cl_${uid}`,[]));
  const[agendamentos,setAgendamentos]=useState(()=>load(`ca_ag_${uid}`,[]));
  const[messages,setMessages]=useState(()=>{
    const n=load(`ca_msg_${uid}`,[]);const o=load(`cf_msg_${uid}`,[]);const s=n.length>0?n:o;
    return s.length>0?s:[{role:"assistant",text:`Olá${user.firstName?", "+user.firstName:""}! 👋 Bem-vindo ao **CashAI**.\n\nLance assim:\n• _"recebi 3200 de salário"_\n• _"gastei 45 no mercado hoje"_\n• _"quanto falta no mês?"_\n\nO que vai lançar? 🤖`,ts:Date.now()}];
  });
  const[input,setInput]=useState("");
  const[loading,setLoading]=useState(false);
  const[selectedMonth,setSelectedMonth]=useState(()=>{const t=load(`ca_tx_${uid}`,[]);if(t.length>0){const m=[...new Set(t.map(x=>monthKey(x.date)))].sort().reverse();return m[0];}return monthKey(today());});
  const chatEndRef=useRef(null);

  useEffect(()=>{save(`ca_tx_${uid}`,transactions);},[transactions,uid]);
  useEffect(()=>{save(`ca_msg_${uid}`,messages.slice(-60));},[messages,uid]);
  useEffect(()=>{save(`ca_bg_${uid}`,budgets);},[budgets,uid]);
  useEffect(()=>{save(`ca_cl_${uid}`,clientes);},[clientes,uid]);
  useEffect(()=>{save(`ca_ag_${uid}`,agendamentos);},[agendamentos,uid]);
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  const{income,expense,budgetPending,balance,filtered}=useMemo(()=>{
    const cm=monthKey(today());
    const cf=transactions.filter(t=>monthKey(t.date)===cm);
    const inc=cf.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
    const exp=cf.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
    const bp=budgets.filter(b=>b.paid).reduce((s,b)=>s+b.amount,0);
    const bpend=budgets.filter(b=>!b.paid).reduce((s,b)=>s+b.amount,0);
    return{income:inc,expense:exp+bp,budgetPending:bpend,balance:inc-exp-bp,filtered:transactions.filter(t=>monthKey(t.date)===selectedMonth)};
  },[transactions,budgets,selectedMonth]);

  async function sendMessage(){
    if(!input.trim()||loading)return;
    const ut=input.trim();setInput("");
    const um={role:"user",text:ut,ts:Date.now()};
    const nm=[...messages,um];setMessages(nm);setLoading(true);
    const bi=budgets.map(b=>`${b.description}:R$${b.amount}(${b.paid?"pago":"pendente"})`).join(",");
    const sys=`Você é o assistente CashAI. Responda em português, amigável, conciso (2-4 linhas).
DATA HOJE: ${today()} — use SEMPRE para novos lançamentos.
FINANCEIRO (${monthKey(today())}): Receitas:${fmt(income)} Saídas:${fmt(expense)} Saldo:${fmt(balance)} Pendentes:${fmt(budgetPending)}
Orçamento: ${bi||"nenhum"} | Transações: ${JSON.stringify(transactions.slice(-10))}
REGRAS: "hoje"=${today()}, sem data=pergunte antes de lançar.
Retorne JSON puro: {"action":"add_transaction","transaction":{"description":"","amount":0,"type":"income","category":"receita","date":"${today()}","recurring":false},"reply":"texto"}
Consultas: {"action":"chat","transaction":null,"reply":"texto"}
CATEGORIAS: alimentacao,transporte,moradia,saude,lazer,assinatura,cartao,receita,servico,outros`;
    const am=nm.slice(-10).map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.text}));
    try{
      const tk=await getToken();
      const raw=await callClaude(am,sys,tk);
      let p;try{const m=raw.match(/\{[\s\S]*\}/);p=m?JSON.parse(m[0]):{action:"chat",transaction:null,reply:raw};}catch{p={action:"chat",transaction:null,reply:raw};}
      let reply=p.reply||"Entendido!";
      if(reply.includes('"action"')||reply.includes("```"))reply="Lançamento registrado! ✅";
      if(p.action==="add_transaction"&&p.transaction?.amount>0){
        const tx={id:Date.now(),description:p.transaction.description,amount:p.transaction.amount,type:p.transaction.type,category:p.transaction.category||"outros",date:p.transaction.date||today(),recurring:p.transaction.recurring||false};
        setTransactions(prev=>[tx,...prev]);
      }
      setMessages([...nm,{role:"assistant",text:reply,transaction:p.action==="add_transaction"?p.transaction:null,ts:Date.now()}]);
    }catch(e){setMessages([...nm,{role:"assistant",text:e.message==="unauthorized"?"Sessão expirada. Faça login novamente. 🔒":"Ops, problema de conexão. Tenta de novo? 🙏",ts:Date.now()}]);}
    setLoading(false);
  }

  const SB=({style={}})=>(
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.sidebar,...style}}>
      <div style={{padding:"18px 16px",borderBottom:`1px solid ${C.cardBorder}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>🤖</span><span style={{fontWeight:800,fontSize:16,color:C.gold}}>CashAI</span></div>
        {trialDaysLeft!==null&&<div style={{fontSize:10,color:trialDaysLeft<=2?C.coral:C.amber,marginTop:6}}>{trialDaysLeft<=2?"⚠️":"⏳"} {trialDaysLeft}d restantes</div>}
      </div>
      <nav style={{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:2}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>{setTab(n.id);setMob(false);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",background:tab===n.id?C.goldDim:"transparent",color:tab===n.id?C.gold:C.textMuted,cursor:"pointer",fontSize:13,fontWeight:tab===n.id?700:400,textAlign:"left",transition:"all .15s"}}>
            <span style={{fontSize:16}}>{n.icon}</span>{n.label}
          </button>
        ))}
      </nav>
      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.cardBorder}`,display:"flex",alignItems:"center",gap:8}}>
        <UserButton appearance={{elements:{avatarBox:{width:28,height:28}}}}/>
        <div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.firstName||"Usuário"}</div></div>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",minHeight:"100dvh",background:C.bg,color:C.text,fontFamily:"Inter,system-ui,sans-serif",display:"flex"}}>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}body{overscroll-behavior:none;}input,button,select,textarea{font-family:inherit;}@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}@keyframes fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}.msg{animation:fadein .2s ease;}::-webkit-scrollbar{width:3px;height:3px;}::-webkit-scrollbar-thumb{background:${C.goldDim};}input[type=date],input[type=time]{color-scheme:dark;}@media(min-width:768px){.mob-header{display:none!important}.desktop-sb{display:flex!important}}@media(max-width:767px){.desktop-sb{display:none!important}}`}</style>
      <div className="desktop-sb" style={{width:200,flexShrink:0,height:"100vh",position:"sticky",top:0,borderRight:`1px solid ${C.cardBorder}`,display:"none"}}><SB/></div>
      {mob&&<div style={{position:"fixed",inset:0,zIndex:100,display:"flex"}}><div style={{width:220,animation:"slideIn .2s ease"}}><SB style={{borderRight:`1px solid ${C.cardBorder}`}}/></div><div style={{flex:1,background:"rgba(0,0,0,0.5)"}} onClick={()=>setMob(false)}/></div>}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        <div className="mob-header" style={{background:C.card,borderBottom:`1px solid ${C.cardBorder}`,padding:"11px 14px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:10}}>
          <button onClick={()=>setMob(!mob)} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:20,padding:2,lineHeight:1}}>☰</button>
          <span style={{fontWeight:700,fontSize:15,color:C.gold}}>🤖 CashAI</span>
          <span style={{fontSize:13,color:C.textMuted}}>· {NAV.find(n=>n.id===tab)?.label}</span>
        </div>
        <div style={{background:"linear-gradient(135deg,#1C1500,#0F1117)",borderBottom:`1px solid ${C.cardBorder}`,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:1}}>Saldo disponível</div><div style={{fontSize:20,fontWeight:800,color:balance>=0?C.gold:C.coral,letterSpacing:"-0.5px"}}>{fmt(balance)}</div></div>
          <div style={{display:"flex",gap:10}}>
            <div style={{textAlign:"right"}}><div style={{fontSize:9,color:C.gold}}>↑ Entradas</div><div style={{fontSize:12,fontWeight:600}}>{fmt(income)}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:9,color:C.coral}}>↓ Saídas</div><div style={{fontSize:12,fontWeight:600}}>{fmt(expense)}</div></div>
            {budgetPending>0&&<div style={{textAlign:"right",borderLeft:`1px solid ${C.cardBorder}`,paddingLeft:10}}><div style={{fontSize:9,color:C.amber}}>⏳ Previsto</div><div style={{fontSize:12,fontWeight:600,color:C.amber}}>{fmt(budgetPending)}</div></div>}
          </div>
        </div>
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          {tab==="chat"&&<ChatView messages={messages} loading={loading} input={input} setInput={setInput} sendMessage={sendMessage} chatEndRef={chatEndRef}/>}
          {tab==="dashboard"&&<DashboardView transactions={transactions} setTransactions={setTransactions} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} filtered={filtered} income={income} expense={expense} balance={balance}/>}
          {tab==="budget"&&<BudgetView budgets={budgets} setBudgets={setBudgets} selectedMonth={selectedMonth}/>}
          {tab==="relatorios"&&<RelatoriosView transactions={transactions}/>}
          {tab==="clientes"&&<ClientesView clientes={clientes} setClientes={setClientes} agendamentos={agendamentos}/>}
          {tab==="agendamentos"&&<AgendamentosView agendamentos={agendamentos} setAgendamentos={setAgendamentos} clientes={clientes}/>}
        </div>
      </div>
    </div>
  );
}

function RT(t){return t.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/_(.*?)_/g,"<em>$1</em>").replace(/\n/g,"<br/>");}
function Card({children,style={}}){return<div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:14,...style}}>{children}</div>;}
function Inp({label,...p}){return<div style={{marginBottom:10}}>{label&&<div style={{fontSize:11,color:C.textMuted,marginBottom:3}}>{label}</div>}<input {...p} style={{width:"100%",background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"10px 12px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",...(p.style||{})}}/></div>;}
function BtnG({children,onClick,style={}}){return<button onClick={onClick} style={{background:C.gold,color:"#000",border:"none",borderRadius:12,padding:"12px 20px",fontWeight:700,fontSize:14,cursor:"pointer",...style}}>{children}</button>;}
function Modal({show,onClose,title,children}){if(!show)return null;return<div style={{position:"fixed",inset:0,background:"#000B",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:50}} onClick={onClose}><div style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:"20px 20px 0 0",padding:20,paddingBottom:"max(20px,env(safe-area-inset-bottom))",width:"100%",maxWidth:500}} onClick={e=>e.stopPropagation()}><div style={{fontWeight:700,fontSize:16,marginBottom:16}}>{title}</div>{children}</div></div>;}

function ChatView({messages,loading,input,setInput,sendMessage,chatEndRef}){
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
        {messages.map((m,i)=>(
          <div key={i} className="msg" style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:"50%",background:C.goldDim,border:`1px solid ${C.goldMid}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,marginRight:7,flexShrink:0,marginTop:2}}>🤖</div>}
            <div style={{maxWidth:"82%",background:m.role==="user"?C.userBubble:C.aiBubble,border:`1px solid ${m.role==="user"?C.goldMid:C.cardBorder}`,borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"10px 13px",fontSize:14,lineHeight:1.55}}>
              {m.transaction?.amount>0&&<div style={{background:m.transaction.type==="income"?C.goldDim:C.coralDim,border:`1px solid ${m.transaction.type==="income"?C.gold+"44":C.coral+"44"}`,borderRadius:7,padding:"5px 9px",marginBottom:7,fontSize:12,color:m.transaction.type==="income"?C.gold:C.coral}}>{m.transaction.type==="income"?"✅ +":"✅ -"}{fmt(m.transaction.amount)} · {m.transaction.description}</div>}
              <span dangerouslySetInnerHTML={{__html:RT(m.text)}}/>
            </div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:26,height:26,borderRadius:"50%",background:C.goldDim,border:`1px solid ${C.goldMid}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🤖</div><div style={{background:C.aiBubble,border:`1px solid ${C.cardBorder}`,borderRadius:"18px 18px 18px 4px",padding:"12px 16px"}}><div style={{display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.gold,animation:`bounce 1s infinite ${i*.15}s`}}/>)}</div></div></div>}
        <div ref={chatEndRef}/>
      </div>
      <div style={{padding:"0 14px 8px",display:"flex",gap:6,overflowX:"auto"}}>
        {["Ver extrato","Resumo do mês","Maiores gastos","Quanto falta?","Pendentes"].map(q=>(
          <button key={q} onClick={()=>setInput(q)} style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:20,padding:"6px 12px",fontSize:12,color:C.textDim,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{q}</button>
        ))}
      </div>
      <div style={{padding:"8px 14px 14px",paddingBottom:"max(14px,env(safe-area-inset-bottom))",borderTop:`1px solid ${C.cardBorder}`,display:"flex",gap:9,alignItems:"center"}}>
        <input placeholder="Gastei 50 no mercado, recebi salário..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()} style={{flex:1,background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:24,padding:"11px 16px",color:C.text,fontSize:14,outline:"none"}}/>
        <button onClick={sendMessage} disabled={loading||!input.trim()} style={{width:42,height:42,borderRadius:"50%",background:loading||!input.trim()?C.cardBorder:C.gold,border:"none",cursor:loading||!input.trim()?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,color:loading||!input.trim()?C.textMuted:"#000"}}>↑</button>
      </div>
    </div>
  );
}

function DashboardView({transactions,setTransactions,selectedMonth,setSelectedMonth,filtered,income,expense,balance}){
  const[showAdd,setShowAdd]=useState(false);
  const[showFilter,setShowFilter]=useState(false);
  const[df,setDf]=useState("");const[dt,setDt]=useState("");
  const[form,setForm]=useState({description:"",amount:"",type:"expense",category:"alimentacao",date:today(),recurring:false});
  const months=[...new Set(transactions.map(t=>monthKey(t.date)))].sort().reverse();
  const fbd=(df||dt)?filtered.filter(t=>{if(df&&t.date<df)return false;if(dt&&t.date>dt)return false;return true;}):filtered;
  const pInc=fbd.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const pExp=fbd.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const isF=df||dt;
  const byCat=fbd.filter(t=>t.type==="expense").reduce((a,t)=>{a[t.category]=(a[t.category]||0)+t.amount;return a;},{});
  const topC=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const add=()=>{if(!form.description||!form.amount)return;setTransactions([{id:Date.now(),...form,amount:parseFloat(form.amount)},...transactions]);setShowAdd(false);setForm({description:"",amount:"",type:"expense",category:"alimentacao",date:today(),recurring:false});};
  const clrF=()=>{setDf("");setDt("");setShowFilter(false);};
  return(
    <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
        <div style={{display:"flex",gap:6,overflowX:"auto",flexShrink:1}}>
          {months.slice(0,6).map(m=>{const[y,mo]=m.split("-");return(
            <div key={m} style={{display:"flex",alignItems:"center",background:selectedMonth===m?C.gold:C.card,border:`1px solid ${selectedMonth===m?C.gold:C.cardBorder}`,borderRadius:20,overflow:"hidden",flexShrink:0}}>
              <button onClick={()=>{setSelectedMonth(m);clrF();}} style={{background:"transparent",border:"none",padding:"6px 10px",fontSize:12,cursor:"pointer",color:selectedMonth===m?"#000":C.textMuted,fontWeight:selectedMonth===m?700:400,whiteSpace:"nowrap"}}>{MONTHS[parseInt(mo)-1]}/{y.slice(2)}</button>
              {months.length>1&&<button onClick={()=>{const n=transactions.filter(t=>monthKey(t.date)!==m);setTransactions(n);if(selectedMonth===m)setSelectedMonth(months.filter(x=>x!==m)[0]||monthKey(today()));}} style={{background:"transparent",border:"none",borderLeft:`1px solid ${selectedMonth===m?"#00000022":C.cardBorder}`,padding:"6px 7px",cursor:"pointer",color:selectedMonth===m?"#000":C.textMuted,fontSize:12}}>×</button>}
            </div>
          );})}
        </div>
        <BtnG onClick={()=>setShowAdd(true)} style={{borderRadius:20,padding:"8px 14px",fontSize:13,flexShrink:0}}>+ Lançar</BtnG>
      </div>
      <Card style={{padding:"10px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showFilter?10:0}}>
          <span style={{fontSize:13,color:isF?C.gold:C.textMuted}}>📅 {isF?`${df||"início"} → ${dt||"hoje"}`:"Filtrar por período"}</span>
          <div style={{display:"flex",gap:6}}>
            {isF&&<button onClick={clrF} style={{background:"none",border:`1px solid ${C.cardBorder}`,borderRadius:20,padding:"4px 10px",fontSize:11,color:C.textMuted,cursor:"pointer"}}>Limpar</button>}
            <button onClick={()=>setShowFilter(!showFilter)} style={{background:isF?C.goldDim:"none",border:`1px solid ${isF?C.gold:C.cardBorder}`,borderRadius:20,padding:"4px 10px",fontSize:11,color:isF?C.gold:C.textMuted,cursor:"pointer"}}>{showFilter?"Fechar":"Filtrar"}</button>
          </div>
        </div>
        {showFilter&&<div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{flex:1}}><div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>De</div><input type="date" value={df} onChange={e=>setDf(e.target.value)} style={{width:"100%",background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:14}}>→</div>
          <div style={{flex:1}}><div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>Até</div><input type="date" value={dt} onChange={e=>setDt(e.target.value)} style={{width:"100%",background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>
        </div>}
        {isF&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
          <div style={{background:C.goldDim,border:`1px solid ${C.gold}33`,borderRadius:10,padding:"8px 12px"}}><div style={{fontSize:9,color:C.gold}}>↑ Entradas</div><div style={{fontSize:14,fontWeight:700,color:C.gold}}>{fmt(pInc)}</div></div>
          <div style={{background:C.coralDim,border:`1px solid ${C.coral}33`,borderRadius:10,padding:"8px 12px"}}><div style={{fontSize:9,color:C.coral}}>↓ Saídas</div><div style={{fontSize:14,fontWeight:700,color:C.coral}}>{fmt(pExp)}</div></div>
        </div>}
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {[["+Entradas",fmt(income),C.gold,C.goldDim],["-Saídas",fmt(expense),C.coral,C.coralDim],["Saldo",fmt(balance),balance>=0?C.gold:C.coral,balance>=0?C.goldDim:C.coralDim]].map(([l,v,col,bg])=>(
          <div key={l} style={{background:bg,border:`1px solid ${col}33`,borderRadius:12,padding:"10px 12px"}}><div style={{fontSize:10,color:col,marginBottom:3}}>{l}</div><div style={{fontSize:13,fontWeight:700,color:col}}>{v}</div></div>
        ))}
      </div>
      {topC.length>0&&<Card style={{padding:14}}><div style={{fontSize:12,fontWeight:600,marginBottom:10,color:C.textDim}}>Por categoria</div>{topC.map(([cat,val])=>{const c=CATEGORIES[cat]||CATEGORIES.outros;const pct=expense>0?(val/expense)*100:0;return(<div key={cat} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span>{c.emoji} {c.label}</span><span style={{color:C.textMuted}}>{fmt(val)} ({pct.toFixed(0)}%)</span></div><div style={{height:5,background:C.inputBg,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:c.color,borderRadius:3}}/></div></div>);})}</Card>}
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.cardBorder}`,fontSize:12,fontWeight:600,color:C.textDim}}>Lançamentos · {fbd.length}{isF?" (filtrado)":""}</div>
        {fbd.length===0?<div style={{padding:24,textAlign:"center",color:C.textMuted,fontSize:13}}>Nenhum lançamento {isF?"nesse período":"este mês"}.</div>
        :fbd.map(t=>{const c=CATEGORIES[t.category]||CATEGORIES.outros;return(<div key={t.id} style={{display:"flex",alignItems:"center",padding:"11px 14px",borderBottom:`1px solid ${C.cardBorder}`,gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:t.type==="income"?C.goldDim:C.coralDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{c.emoji}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.description}</div><div style={{fontSize:11,color:C.textMuted}}>{t.date}{t.recurring?" · 🔄":""}</div></div>
          <div style={{fontSize:14,fontWeight:700,color:t.type==="income"?C.gold:C.coral,flexShrink:0}}>{t.type==="income"?"+":"-"}{fmt(t.amount)}</div>
          <button onClick={()=>setTransactions(transactions.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:18,padding:"4px 6px",lineHeight:1}}>×</button>
        </div>);})}
      </Card>
      <Modal show={showAdd} onClose={()=>setShowAdd(false)} title="Novo lançamento">
        <div style={{display:"flex",gap:8,marginBottom:12}}>{["expense","income"].map(tp=>(<button key={tp} onClick={()=>setForm(f=>({...f,type:tp}))} style={{flex:1,background:form.type===tp?(tp==="income"?C.goldDim:C.coralDim):C.inputBg,border:`1px solid ${form.type===tp?(tp==="income"?C.gold:C.coral):C.cardBorder}`,borderRadius:10,padding:"10px",color:form.type===tp?(tp==="income"?C.gold:C.coral):C.textMuted,cursor:"pointer",fontSize:13,fontWeight:600}}>{tp==="income"?"💰 Entrada":"💸 Saída"}</button>))}</div>
        <Inp label="Descrição" type="text" placeholder="Ex: Mercado, Salário..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
        <Inp label="Valor (R$)" type="number" placeholder="0,00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
        <Inp label="Data" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
        <div style={{marginBottom:12}}><div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>Categoria</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{Object.entries(CATEGORIES).filter(([k])=>k!=="receita").map(([k,c])=>(<button key={k} onClick={()=>setForm(f=>({...f,category:k}))} style={{background:form.category===k?c.color+"33":C.inputBg,border:`1px solid ${form.category===k?c.color:C.cardBorder}`,borderRadius:20,padding:"5px 10px",fontSize:12,color:form.category===k?c.color:C.textMuted,cursor:"pointer"}}>{c.emoji} {c.label}</button>))}</div></div>
        <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,cursor:"pointer",fontSize:12,color:C.textDim}}><input type="checkbox" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))}/> 🔄 Recorrente</label>
        <BtnG onClick={add} style={{width:"100%",padding:"13px"}}>Confirmar</BtnG>
      </Modal>
    </div>
  );
}

function BudgetView({budgets,setBudgets,selectedMonth}){
  const[showAdd,setShowAdd]=useState(false);const[editId,setEditId]=useState(null);
  const[form,setForm]=useState({description:"",amount:"",category:"alimentacao"});
  const tp=budgets.reduce((s,b)=>s+b.amount,0);const paid=budgets.filter(b=>b.paid).reduce((s,b)=>s+b.amount,0);const pend=tp-paid;
  const tog=id=>setBudgets(budgets.map(b=>b.id===id?{...b,paid:!b.paid,paidAt:!b.paid?today():null}:b));
  const oA=()=>{setForm({description:"",amount:"",category:"alimentacao"});setEditId(null);setShowAdd(true);};
  const oE=b=>{setForm({description:b.description,amount:String(b.amount),category:b.category});setEditId(b.id);setShowAdd(true);};
  const sv=()=>{if(!form.description||!form.amount)return;const u=editId?budgets.map(b=>b.id===editId?{...b,...form,amount:parseFloat(form.amount)}:b):[...budgets,{id:Date.now(),...form,amount:parseFloat(form.amount),paid:false,paidAt:null}];setBudgets(u);setShowAdd(false);};
  const[mo]=(()=>{const[y,m]=selectedMonth.split("-");return[MONTHS[parseInt(m)-1],y];})();
  return(
    <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontWeight:700,fontSize:16}}>Orçamento · {mo}</div><div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Despesas previstas do mês</div></div>
        <BtnG onClick={oA} style={{borderRadius:20,padding:"8px 14px",fontSize:13}}>+ Adicionar</BtnG>
      </div>
      {budgets.length>0&&<Card style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          <div><div style={{fontSize:9,color:C.textMuted}}>Previsto</div><div style={{fontSize:15,fontWeight:700}}>{fmt(tp)}</div></div>
          <div><div style={{fontSize:9,color:C.gold}}>✅ Pago</div><div style={{fontSize:15,fontWeight:700,color:C.gold}}>{fmt(paid)}</div></div>
          <div><div style={{fontSize:9,color:C.amber}}>⏳ Pendente</div><div style={{fontSize:15,fontWeight:700,color:C.amber}}>{fmt(pend)}</div></div>
        </div>
        <div style={{height:5,background:C.inputBg,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${tp>0?(paid/tp)*100:0}%`,background:C.gold,borderRadius:3,transition:"width .4s"}}/></div>
      </Card>}
      {budgets.length===0?<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:32,marginBottom:10}}>🎯</div><div style={{color:C.textMuted,fontSize:13,marginBottom:14}}>Nenhuma despesa prevista</div><BtnG onClick={oA} style={{borderRadius:20,padding:"10px 20px"}}>+ Adicionar</BtnG></Card>
      :<div style={{display:"flex",flexDirection:"column",gap:9}}>{budgets.map(b=>{const cat=CATEGORIES[b.category]||CATEGORIES.outros;return(<Card key={b.id} style={{padding:13,border:`1px solid ${b.paid?C.gold+"44":C.cardBorder}`,opacity:b.paid?.88:1}}><div style={{display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:34,height:34,borderRadius:9,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{cat.emoji}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13,textDecoration:b.paid?"line-through":"none",color:b.paid?C.textMuted:C.text}}>{b.description}</div><div style={{fontSize:11,color:C.textMuted}}>{cat.label}{b.paid&&b.paidAt?` · ${b.paidAt}`:""}</div></div>
        <div style={{fontSize:14,fontWeight:700,color:b.paid?C.textMuted:C.coral,flexShrink:0}}>{fmt(b.amount)}</div>
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>tog(b.id)} style={{background:b.paid?C.goldDim:C.inputBg,border:`1px solid ${b.paid?C.gold:C.cardBorder}`,borderRadius:8,padding:"5px 9px",cursor:"pointer",fontSize:11,color:b.paid?C.gold:C.textMuted,fontWeight:600,whiteSpace:"nowrap"}}>{b.paid?"✅ Pago":"⏳ Pagar"}</button>
          <button onClick={()=>oE(b)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"4px 5px"}}>✏️</button>
          <button onClick={()=>setBudgets(budgets.filter(x=>x.id!==b.id))} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:17,padding:"4px 5px",lineHeight:1}}>×</button>
        </div>
      </div></Card>);})}</div>}
      <Modal show={showAdd} onClose={()=>setShowAdd(false)} title={editId?"Editar":"Nova despesa"}>
        <Inp label="Descrição" type="text" placeholder="Ex: Aluguel, Netflix..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
        <Inp label="Valor (R$)" type="number" placeholder="0,00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
        <div style={{marginBottom:16}}><div style={{fontSize:11,color:C.textMuted,marginBottom:6}}>Categoria</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{Object.entries(CATEGORIES).filter(([k])=>k!=="receita").map(([k,c])=>(<button key={k} onClick={()=>setForm(f=>({...f,category:k}))} style={{background:form.category===k?c.color+"33":C.inputBg,border:`1px solid ${form.category===k?c.color:C.cardBorder}`,borderRadius:20,padding:"5px 10px",fontSize:12,color:form.category===k?c.color:C.textMuted,cursor:"pointer"}}>{c.emoji} {c.label}</button>))}</div></div>
        <BtnG onClick={sv} style={{width:"100%",padding:"13px"}}>{editId?"Salvar":"Adicionar"}</BtnG>
      </Modal>
    </div>
  );
}

function RelatoriosView({transactions}){
  const[periodo,setPeriodo]=useState("mes");
  const now=new Date();
  const getF=()=>{
    if(periodo==="mes")return transactions.filter(t=>monthKey(t.date)===monthKey(today()));
    if(periodo==="trimestre"){const d=new Date(now);d.setMonth(d.getMonth()-3);return transactions.filter(t=>new Date(t.date)>=d);}
    if(periodo==="ano")return transactions.filter(t=>new Date(t.date).getFullYear()===now.getFullYear());
    return transactions;
  };
  const f=getF();
  const inc=f.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const exp=f.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const byCat=f.filter(t=>t.type==="expense").reduce((a,t)=>{a[t.category]=(a[t.category]||0)+t.amount;return a;},{});
  const topC=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const byM=f.reduce((a,t)=>{const m=monthKey(t.date);if(!a[m])a[m]={inc:0,exp:0};a[m][t.type==="income"?"inc":"exp"]+=t.amount;return a;},{});
  const months=Object.entries(byM).sort((a,b)=>a[0].localeCompare(b[0]));
  return(
    <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:700,fontSize:16}}>📈 Relatórios</div>
        <div style={{display:"flex",gap:6}}>{[["mes","Mês"],["trimestre","Trim."],["ano","Ano"]].map(([v,l])=>(<button key={v} onClick={()=>setPeriodo(v)} style={{background:periodo===v?C.goldDim:C.card,border:`1px solid ${periodo===v?C.gold:C.cardBorder}`,borderRadius:20,padding:"6px 12px",fontSize:12,color:periodo===v?C.gold:C.textMuted,cursor:"pointer",fontWeight:periodo===v?700:400}}>{l}</button>))}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <div style={{background:C.goldDim,border:`1px solid ${C.gold}33`,borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:10,color:C.gold}}>↑ Entradas</div><div style={{fontSize:14,fontWeight:700,color:C.gold}}>{fmt(inc)}</div></div>
        <div style={{background:C.coralDim,border:`1px solid ${C.coral}33`,borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:10,color:C.coral}}>↓ Saídas</div><div style={{fontSize:14,fontWeight:700,color:C.coral}}>{fmt(exp)}</div></div>
        <div style={{background:inc-exp>=0?C.goldDim:C.coralDim,border:`1px solid ${inc-exp>=0?C.gold:C.coral}33`,borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:10,color:inc-exp>=0?C.gold:C.coral}}>Resultado</div><div style={{fontSize:14,fontWeight:700,color:inc-exp>=0?C.gold:C.coral}}>{fmt(inc-exp)}</div></div>
      </div>
      {topC.length>0&&<Card style={{padding:14}}><div style={{fontSize:13,fontWeight:600,marginBottom:12,color:C.textDim}}>Gastos por categoria</div>{topC.map(([cat,val])=>{const c=CATEGORIES[cat]||CATEGORIES.outros;const pct=exp>0?(val/exp)*100:0;return(<div key={cat} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span>{c.emoji} {c.label}</span><span style={{color:C.textMuted}}>{fmt(val)} · {pct.toFixed(0)}%</span></div><div style={{height:5,background:C.inputBg,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:c.color,borderRadius:3}}/></div></div>);})}</Card>}
      {months.length>0&&<Card style={{padding:14}}><div style={{fontSize:13,fontWeight:600,marginBottom:12,color:C.textDim}}>Por mês</div>{months.map(([m,d])=>{const[y,mo]=m.split("-");return(<div key={m} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.cardBorder}`,alignItems:"center"}}><div style={{fontSize:13,fontWeight:500}}>{MONTHS[parseInt(mo)-1]}/{y.slice(2)}</div><div style={{display:"flex",gap:12}}><span style={{fontSize:12,color:C.gold}}>+{fmt(d.inc)}</span><span style={{fontSize:12,color:C.coral}}>-{fmt(d.exp)}</span><span style={{fontSize:12,fontWeight:700,color:d.inc-d.exp>=0?C.gold:C.coral}}>{fmt(d.inc-d.exp)}</span></div></div>);})}</Card>}
      {f.length===0&&<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:32,marginBottom:10}}>📈</div><div style={{color:C.textMuted,fontSize:13}}>Nenhum dado para o período</div></Card>}
    </div>
  );
}

function ClientesView({clientes,setClientes,agendamentos}){
  const[showAdd,setShowAdd]=useState(false);const[search,setSearch]=useState("");
  const[form,setForm]=useState({nome:"",telefone:"",email:"",obs:""});
  const filtered=clientes.filter(c=>c.nome.toLowerCase().includes(search.toLowerCase())||c.telefone?.includes(search));
  const add=()=>{if(!form.nome)return;setClientes([{id:Date.now(),...form,criadoEm:today()},...clientes]);setShowAdd(false);setForm({nome:"",telefone:"",email:"",obs:""});};
  return(
    <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontWeight:700,fontSize:16}}>👥 Clientes</div><div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{clientes.length} cadastrado{clientes.length!==1?"s":""}</div></div>
        <BtnG onClick={()=>setShowAdd(true)} style={{borderRadius:20,padding:"8px 14px",fontSize:13}}>+ Novo</BtnG>
      </div>
      <div style={{position:"relative"}}><span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:C.textMuted}}>🔍</span><input placeholder="Buscar cliente..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"10px 12px 10px 34px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>
      {filtered.length===0?<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:32,marginBottom:10}}>👥</div><div style={{color:C.textMuted,fontSize:13}}>{search?"Nenhum encontrado":"Nenhum cliente cadastrado"}</div>{!search&&<BtnG onClick={()=>setShowAdd(true)} style={{borderRadius:20,padding:"10px 20px",marginTop:14}}>+ Cadastrar</BtnG>}</Card>
      :<div style={{display:"flex",flexDirection:"column",gap:9}}>{filtered.map(c=>{const ags=agendamentos.filter(a=>a.clienteId===c.id);return(<Card key={c.id} style={{padding:14}}><div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:40,height:40,borderRadius:20,background:C.goldDim,border:`1px solid ${C.goldMid}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:C.gold,flexShrink:0}}>{c.nome[0].toUpperCase()}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600}}>{c.nome}</div><div style={{fontSize:12,color:C.textMuted}}>{c.telefone||c.email||"Sem contato"}</div>{ags.length>0&&<div style={{fontSize:11,color:C.gold,marginTop:2}}>📅 {ags.length} agendamento{ags.length!==1?"s":""}</div>}</div>
        <button onClick={()=>setClientes(clientes.filter(x=>x.id!==c.id))} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:18,padding:"4px 6px"}}>×</button>
      </div>{c.obs&&<div style={{fontSize:12,color:C.textMuted,marginTop:10,padding:"8px 10px",background:C.inputBg,borderRadius:8}}>📝 {c.obs}</div>}</Card>);})}</div>}
      <Modal show={showAdd} onClose={()=>setShowAdd(false)} title="Novo cliente">
        <Inp label="Nome *" type="text" placeholder="Nome completo" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}/>
        <Inp label="Telefone" type="tel" placeholder="(00) 00000-0000" value={form.telefone} onChange={e=>setForm(f=>({...f,telefone:e.target.value}))}/>
        <Inp label="Email" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
        <Inp label="Observações" type="text" placeholder="Anotações sobre o cliente..." value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}/>
        <BtnG onClick={add} style={{width:"100%",padding:"13px"}}>Cadastrar</BtnG>
      </Modal>
    </div>
  );
}

function AgendamentosView({agendamentos,setAgendamentos,clientes}){
  const[showAdd,setShowAdd]=useState(false);const[fd,setFd]=useState(today());
  const[form,setForm]=useState({clienteId:"",servico:"",data:today(),hora:"09:00",valor:"",obs:"",status:"pendente"});
  const filtered=agendamentos.filter(a=>a.data===fd).sort((a,b)=>a.hora.localeCompare(b.hora));
  const add=()=>{if(!form.servico||!form.data||!form.hora)return;setAgendamentos([{id:Date.now(),...form,valor:parseFloat(form.valor)||0},...agendamentos]);setShowAdd(false);setForm({clienteId:"",servico:"",data:today(),hora:"09:00",valor:"",obs:"",status:"pendente"});};
  const tog=id=>setAgendamentos(agendamentos.map(a=>a.id===id?{...a,status:a.status==="concluido"?"pendente":"concluido"}:a));
  const ST={pendente:{l:"Pendente",c:C.amber},concluido:{l:"Concluído",c:C.green},cancelado:{l:"Cancelado",c:C.coral}};
  const totalDia=filtered.filter(a=>a.status==="concluido").reduce((s,a)=>s+(a.valor||0),0);
  return(
    <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontWeight:700,fontSize:16}}>📅 Agenda</div><div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{filtered.length} agendamento{filtered.length!==1?"s":""} · {fmt(totalDia)} faturado</div></div>
        <BtnG onClick={()=>setShowAdd(true)} style={{borderRadius:20,padding:"8px 14px",fontSize:13}}>+ Novo</BtnG>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <input type="date" value={fd} onChange={e=>setFd(e.target.value)} style={{flex:1,background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:12,padding:"10px 12px",color:C.text,fontSize:14,outline:"none"}}/>
        <button onClick={()=>setFd(today())} style={{background:fd===today()?C.goldDim:C.card,border:`1px solid ${fd===today()?C.gold:C.cardBorder}`,borderRadius:12,padding:"10px 14px",fontSize:13,color:fd===today()?C.gold:C.textMuted,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>Hoje</button>
      </div>
      {filtered.length===0?<Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:32,marginBottom:10}}>📅</div><div style={{color:C.textMuted,fontSize:13}}>Nenhum agendamento para este dia</div><BtnG onClick={()=>setShowAdd(true)} style={{borderRadius:20,padding:"10px 20px",marginTop:14}}>+ Agendar</BtnG></Card>
      :<div style={{display:"flex",flexDirection:"column",gap:9}}>{filtered.map(a=>{const cl=clientes.find(c=>c.id===a.clienteId);const st=ST[a.status]||ST.pendente;return(<Card key={a.id} style={{padding:14,borderLeft:`3px solid ${st.c}`}}><div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{textAlign:"center",flexShrink:0}}><div style={{fontSize:16,fontWeight:700,color:C.gold}}>{a.hora}</div></div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600}}>{a.servico}</div><div style={{fontSize:12,color:C.textMuted}}>{cl?`👤 ${cl.nome}`:"Sem cliente"}{a.valor>0?` · ${fmt(a.valor)}`:""}</div>{a.obs&&<div style={{fontSize:11,color:C.textMuted,marginTop:4}}>📝 {a.obs}</div>}</div>
        <div style={{display:"flex",gap:5,flexDirection:"column",alignItems:"flex-end"}}>
          <button onClick={()=>tog(a.id)} style={{background:`${st.c}22`,border:`1px solid ${st.c}44`,borderRadius:8,padding:"4px 9px",fontSize:11,color:st.c,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>{st.l}</button>
          <button onClick={()=>setAgendamentos(agendamentos.filter(x=>x.id!==a.id))} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:14,padding:"2px 4px"}}>×</button>
        </div>
      </div></Card>);})}</div>}
      <Modal show={showAdd} onClose={()=>setShowAdd(false)} title="Novo agendamento">
        <div style={{marginBottom:10}}><div style={{fontSize:11,color:C.textMuted,marginBottom:3}}>Cliente</div><select value={form.clienteId} onChange={e=>setForm(f=>({...f,clienteId:e.target.value}))} style={{width:"100%",background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"10px 12px",color:form.clienteId?C.text:C.textMuted,fontSize:14,outline:"none",boxSizing:"border-box"}}><option value="">Selecionar...</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
        <Inp label="Serviço *" type="text" placeholder="Ex: Corte, Barba, Manicure..." value={form.servico} onChange={e=>setForm(f=>({...f,servico:e.target.value}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Inp label="Data *" type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))}/>
          <Inp label="Hora *" type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))}/>
        </div>
        <Inp label="Valor (R$)" type="number" placeholder="0,00" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))}/>
        <Inp label="Observações" type="text" placeholder="Detalhes..." value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}/>
        <BtnG onClick={add} style={{width:"100%",padding:"13px"}}>Confirmar</BtnG>
      </Modal>
    </div>
  );
}
