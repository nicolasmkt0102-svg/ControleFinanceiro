import { useState, useEffect, useRef } from "react";
import { useUser, SignIn, SignUp, UserButton } from "@clerk/clerk-react";
import { ptBR } from "@clerk/localizations";

const C = {
  bg: "#0F1117", card: "#1A1D27", cardBorder: "#2A2510",
  gold: "#F0B429", goldDim: "#F0B42918", goldMid: "#F0B42933",
  coral: "#FF6B6B", coralDim: "#FF6B6B22",
  amber: "#FFB347", amberDim: "#FFB34722",
  blue: "#4B9EFF", blueDim: "#4B9EFF22",
  text: "#E8EAF0", textMuted: "#6B7280", textDim: "#9CA3AF",
  inputBg: "#12141C", userBubble: "#1C1500", aiBubble: "#1A1D27",
};

const CATEGORIES = {
  alimentacao: { label: "Alimentação", emoji: "🍽️", color: C.amber },
  transporte:  { label: "Transporte",  emoji: "🚗", color: C.blue },
  moradia:     { label: "Moradia",     emoji: "🏠", color: C.coral },
  saude:       { label: "Saúde",       emoji: "💊", color: "#A78BFA" },
  lazer:       { label: "Lazer",       emoji: "🎉", color: "#F472B6" },
  assinatura:  { label: "Assinaturas", emoji: "📱", color: C.blue },
  cartao:      { label: "Cartão",      emoji: "💳", color: C.coral },
  receita:     { label: "Receita",     emoji: "💰", color: C.gold },
  outros:      { label: "Outros",      emoji: "📦", color: C.textMuted },
};

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const fmt = n => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const today = () => new Date().toISOString().split("T")[0];
const monthKey = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`; };
const load = (k,f) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):f; } catch{return f;} };
const save = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch{} };

async function callClaude(messages, system) {
  const res = await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages,system})});
  const data = await res.json();
  return data.content?.map(b=>b.text||"").join("")||"";
}

// ── Auth ──────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const clerkAppearance = {
    variables: { colorPrimary: C.gold, colorBackground: C.card, colorText: C.text, colorInputBackground: C.inputBg, colorInputText: C.text, borderRadius: "10px" },
    elements: { card: { background: "transparent", boxShadow: "none", border: "none" }, rootBox: { width: "100%" } }
  };
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px 16px" }}>
      <div style={{ marginBottom:28, textAlign:"center" }}>
        <div style={{ fontSize:52, marginBottom:8 }}>🤖</div>
        <div style={{ fontSize:28, fontWeight:800, color:C.gold, letterSpacing:"-1px" }}>CashAI</div>
        <div style={{ fontSize:13, color:C.textMuted, marginTop:4 }}>Seu assistente financeiro com IA</div>
      </div>
      <div style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:20, padding:24, width:"100%", maxWidth:400 }}>
        <div style={{ display:"flex", gap:8, marginBottom:24 }}>
          {[["signin","Entrar"],["signup","Criar conta"]].map(([m,label])=>(
            <button key={m} onClick={()=>setMode(m)} style={{ flex:1, background:mode===m?C.goldDim:"transparent", color:mode===m?C.gold:C.textMuted, border:`1px solid ${mode===m?C.gold:C.cardBorder}`, borderRadius:10, padding:"10px", cursor:"pointer", fontSize:14, fontWeight:mode===m?700:400, transition:"all .15s" }}>{label}</button>
          ))}
        </div>
        {mode==="signin"?<SignIn routing="hash" appearance={clerkAppearance}/>:<SignUp routing="hash" appearance={clerkAppearance}/>}
      </div>
    </div>
  );
}

// ── Trial check ───────────────────────────────────────────────────
const TRIAL_DAYS = 7;

function getTrialStatus(user) {
  const meta = user.publicMetadata || {};
  // Admin pode definir trial_end ou status no Clerk
  if (meta.status === "active") return { status: "active", daysLeft: null };
  if (meta.status === "blocked") return { status: "blocked", daysLeft: 0 };

  // Data de término do trial definida pelo admin no Clerk
  if (meta.trial_end) {
    const end = new Date(meta.trial_end);
    const now = new Date();
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return { status: "expired", daysLeft: 0 };
    return { status: "trial", daysLeft };
  }

  // Se não tem metadata, usa data de criação da conta
  const created = new Date(user.createdAt);
  const now = new Date();
  const daysUsed = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  const daysLeft = TRIAL_DAYS - daysUsed;

  if (daysLeft <= 0) return { status: "expired", daysLeft: 0 };
  return { status: "trial", daysLeft };
}

function BlockedScreen({ user, status }) {
  const isExpired = status === "expired";
  return (
    <div style={{ minHeight:"100vh", minHeight:"100dvh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 20px", textAlign:"center" }}>
      <div style={{ fontSize:52, marginBottom:16 }}>{isExpired ? "⏰" : "🔒"}</div>
      <div style={{ fontSize:22, fontWeight:800, color:C.gold, marginBottom:8 }}>CashAI</div>
      <div style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:10 }}>
        {isExpired ? "Seu período gratuito encerrou" : "Acesso bloqueado"}
      </div>
      <div style={{ fontSize:14, color:C.textMuted, maxWidth:300, lineHeight:1.6, marginBottom:32 }}>
        {isExpired
          ? "Seus 7 dias de teste gratuito terminaram. Assine agora para continuar organizando suas finanças com IA."
          : "Seu acesso foi suspenso. Entre em contato para mais informações."}
      </div>

      {isExpired && (
        <div style={{ width:"100%", maxWidth:320, display:"flex", flexDirection:"column", gap:10, marginBottom:28 }}>
          {[
            ["Mensal", "R$29,90/mês", "#"],
            ["Trimestral", "R$74,90/trim.", "#"],
            ["Semestral", "R$129,90/sem.", "#"],
            ["Anual", "R$197,90/ano 🔥", "#"],
          ].map(([label, price, link]) => (
            <a key={label} href={link} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:label==="Anual"?C.goldDim:C.card, border:`1px solid ${label==="Anual"?C.gold:C.cardBorder}`, borderRadius:12, padding:"13px 16px", textDecoration:"none", transition:"all .15s" }}>
              <span style={{ fontSize:14, fontWeight:600, color:label==="Anual"?C.gold:C.text }}>{label}</span>
              <span style={{ fontSize:14, fontWeight:700, color:label==="Anual"?C.gold:C.textMuted }}>{price}</span>
            </a>
          ))}
        </div>
      )}

      <div style={{ fontSize:12, color:C.textMuted }}>
        Dúvidas? Fale conosco pelo WhatsApp
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function App() {
  const { isSignedIn, user, isLoaded } = useUser();
  if (!isLoaded) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontSize:40, animation:"spin 1s linear infinite" }}>🤖</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!isSignedIn) return <AuthScreen/>;

  const trial = getTrialStatus(user);
  if (trial.status === "expired" || trial.status === "blocked") {
    return <BlockedScreen user={user} status={trial.status}/>;
  }

  return <MainApp user={user} trialDaysLeft={trial.daysLeft}/>;
}

// ── Main ──────────────────────────────────────────────────────────
function MainApp({ user, trialDaysLeft }) {
  const uid = user.id;
  const [tab, setTab] = useState("chat");
  const [transactions, setTransactions] = useState(()=>load(`ca_tx_${uid}`,[]));
  const [budgets, setBudgets] = useState(()=>load(`ca_bg_${uid}`,[]));
  const [messages, setMessages] = useState(()=>{
    const s = load(`ca_msg_${uid}`,[]);
    return s.length>0?s:[{role:"assistant",text:`Olá${user.firstName?", "+user.firstName:""}! 👋 Bem-vindo ao **CashAI**.\n\nLance assim:\n• _"recebi 3200 de salário"_\n• _"gastei 45 no mercado"_\n• _"paguei 89 de Netflix"_\n• _"quanto falta no mês?"_\n\nO que vai lançar? 🤖`,ts:Date.now()}];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(()=>{
    const txs = load(`ca_tx_${uid}`,[]);
    if (txs.length > 0) {
      const months = [...new Set(txs.map(t=>monthKey(t.date)))].sort().reverse();
      return months[0];
    }
    return monthKey(today());
  });
  const chatEndRef = useRef(null);

  useEffect(()=>{save(`ca_tx_${uid}`,transactions);},[transactions,uid]);
  useEffect(()=>{save(`ca_msg_${uid}`,messages.slice(-60));},[messages,uid]);
  useEffect(()=>{save(`ca_bg_${uid}`,budgets);},[budgets,uid]);
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  const summary = () => {
    const currentMonth = monthKey(today());
    // Topo sempre = mês atual real
    const currentFiltered = transactions.filter(t=>monthKey(t.date)===currentMonth);
    const income = currentFiltered.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
    const expenseTx = currentFiltered.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
    const budgetPaid = budgets.filter(b=>b.paid).reduce((s,b)=>s+b.amount,0);
    const budgetPending = budgets.filter(b=>!b.paid).reduce((s,b)=>s+b.amount,0);
    const expense = expenseTx + budgetPaid;
    const balance = income - expense;
    // filtered = mês selecionado no extrato
    const filtered = transactions.filter(t=>monthKey(t.date)===selectedMonth);
    return { income, expense, budgetPending, balance, filtered };
  };

  async function sendMessage() {
    if (!input.trim()||loading) return;
    const userText = input.trim();
    setInput("");
    const userMsg = {role:"user",text:userText,ts:Date.now()};
    const newMsgs = [...messages,userMsg];
    setMessages(newMsgs);
    setLoading(true);

    const {income,expense,balance,budgetPending} = summary();
    const budgetInfo = budgets.map(b=>`${b.description}: R$${b.amount} (${b.paid?"✅ pago":"⏳ pendente"})`).join(", ");

    const system = `Você é o assistente do CashAI. Responda SEMPRE em português, amigável e conciso (2-4 linhas). Use emojis com moderação.

FINANCEIRO ATUAL (${selectedMonth}):
- Receitas: ${fmt(income)} | Saídas: ${fmt(expense)} | Saldo: ${fmt(balance)}
- Pendentes orçamento: ${fmt(budgetPending)}
- Orçamento: ${budgetInfo||"nenhum"}
- Transações: ${JSON.stringify(transactions.slice(-15))}

Retorne APENAS JSON puro (sem texto fora, sem markdown):
{"action":"add_transaction","transaction":{"description":"desc","amount":0,"type":"income","category":"receita","date":"YYYY-MM-DD","recurring":false},"reply":"texto amigável"}
Para consultas: {"action":"chat","transaction":null,"reply":"texto"}
CATEGORIAS: alimentacao, transporte, moradia, saude, lazer, assinatura, cartao, receita, outros`;

    const apiMsgs = newMsgs.slice(-10).map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.text}));
    try {
      const raw = await callClaude(apiMsgs,system);
      let parsed;
      try { const m=raw.match(/\{[\s\S]*\}/); parsed=m?JSON.parse(m[0]):{action:"chat",transaction:null,reply:raw}; }
      catch { parsed={action:"chat",transaction:null,reply:raw}; }
      let reply = parsed.reply||"Entendido!";
      if (reply.includes('"action"')||reply.includes("```")) reply="Lançamento registrado! ✅";
      if (parsed.action==="add_transaction"&&parsed.transaction?.amount>0) {
        const tx={id:Date.now(),description:parsed.transaction.description,amount:parsed.transaction.amount,type:parsed.transaction.type,category:parsed.transaction.category||"outros",date:parsed.transaction.date||today(),recurring:parsed.transaction.recurring||false};
        setTransactions(p=>[tx,...p]);
      }
      setMessages([...newMsgs,{role:"assistant",text:reply,transaction:parsed.action==="add_transaction"?parsed.transaction:null,ts:Date.now()}]);
    } catch {
      setMessages([...newMsgs,{role:"assistant",text:"Ops, problema de conexão. Tenta de novo? 🙏",ts:Date.now()}]);
    }
    setLoading(false);
  }

  const {income,expense,budgetPending,balance,filtered} = summary();

  // Nav tabs com labels responsivos
  const tabs = [["chat","💬","Chat"],["dashboard","📊","Extrato"],["budget","🎯","Orçamento"]];

  return (
    <div style={{ minHeight:"100vh", minHeight:"100dvh", background:C.bg, color:C.text, fontFamily:"'Inter',system-ui,sans-serif", display:"flex", flexDirection:"column", WebkitTextSizeAdjust:"100%" }}>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{overscroll-behavior:none;}
        input,button{font-family:inherit;}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
        @keyframes fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .msg{animation:fadein .2s ease;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${C.goldDim};border-radius:2px;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
      `}</style>

      {/* Header */}
      <div style={{ background:C.card, borderBottom:`1px solid ${C.cardBorder}`, padding:"0 12px", display:"flex", alignItems:"center", position:"sticky", top:0, zIndex:10, WebkitBackdropFilter:"blur(10px)" }}>
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, padding:"11px 0" }}>
          <span style={{ fontSize:20 }}>🤖</span>
          <span style={{ fontWeight:800, fontSize:16, color:C.gold, letterSpacing:"-0.5px" }}>CashAI</span>
        </div>
        <div style={{ display:"flex", gap:1, alignItems:"center" }}>
          {tabs.map(([id,icon,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ background:tab===id?C.goldDim:"transparent", color:tab===id?C.gold:C.textMuted, border:"none", borderRadius:8, padding:"7px 8px", cursor:"pointer", fontWeight:tab===id?700:400, fontSize:12, display:"flex", alignItems:"center", gap:3, transition:"all .15s", whiteSpace:"nowrap" }}>
              <span>{icon}</span>
              <span style={{ display:"inline" }}>{label}</span>
            </button>
          ))}
          <div style={{ marginLeft:8 }}><UserButton appearance={{elements:{avatarBox:{width:28,height:28}}}}/></div>
        </div>
      </div>

      {/* Trial banner */}
      {trialDaysLeft !== null && (
        <div style={{ background: trialDaysLeft<=2?"#2A0A00":"#1A1200", borderBottom:`1px solid ${trialDaysLeft<=2?C.coral+"44":C.goldMid}`, padding:"7px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:12, color:trialDaysLeft<=2?C.coral:C.amber }}>
            {trialDaysLeft<=2?"⚠️":"⏳"} {trialDaysLeft===1?"Último dia de teste gratuito!":`${trialDaysLeft} dias restantes no período gratuito`}
          </span>
          <span style={{ fontSize:11, color:C.textMuted }}>Assine para continuar</span>
        </div>
      )}

      {/* Saldo bar */}
      <div style={{ background:"linear-gradient(135deg, #1C1500 0%, #0F1117 100%)", borderBottom:`1px solid ${C.cardBorder}`, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:1 }}>Saldo disponível</div>
          <div style={{ fontSize:20, fontWeight:800, color:balance>=0?C.gold:C.coral, letterSpacing:"-0.5px" }}>{fmt(balance)}</div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9, color:C.gold }}>↑ Entradas</div>
            <div style={{ fontSize:12, fontWeight:600 }}>{fmt(income)}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9, color:C.coral }}>↓ Saídas</div>
            <div style={{ fontSize:12, fontWeight:600 }}>{fmt(expense)}</div>
          </div>
          {budgetPending>0&&(
            <div style={{ textAlign:"right", borderLeft:`1px solid ${C.cardBorder}`, paddingLeft:10 }}>
              <div style={{ fontSize:9, color:C.amber }}>⏳ Previsto</div>
              <div style={{ fontSize:12, fontWeight:600, color:C.amber }}>{fmt(budgetPending)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {tab==="chat"?<ChatView messages={messages} loading={loading} input={input} setInput={setInput} sendMessage={sendMessage} chatEndRef={chatEndRef}/>
        :tab==="dashboard"?<DashboardView transactions={transactions} setTransactions={setTransactions} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} filtered={filtered} income={income} expense={expense} balance={balance}/>
        :<BudgetView budgets={budgets} setBudgets={setBudgets} selectedMonth={selectedMonth}/>}
      </div>
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────
function renderText(t) {
  return t.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/_(.*?)_/g,"<em>$1</em>").replace(/\n/g,"<br/>");
}

function ChatView({ messages, loading, input, setInput, sendMessage, chatEndRef }) {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
        {messages.map((m,i)=>(
          <div key={i} className="msg" style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            {m.role==="assistant"&&<div style={{ width:26,height:26,borderRadius:"50%",background:C.goldDim,border:`1px solid ${C.goldMid}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,marginRight:7,flexShrink:0,marginTop:2 }}>🤖</div>}
            <div style={{ maxWidth:"82%", background:m.role==="user"?C.userBubble:C.aiBubble, border:`1px solid ${m.role==="user"?C.goldMid:C.cardBorder}`, borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", padding:"10px 13px", fontSize:14, lineHeight:1.55 }}>
              {m.transaction?.amount>0&&(
                <div style={{ background:m.transaction.type==="income"?C.goldDim:C.coralDim, border:`1px solid ${m.transaction.type==="income"?C.gold+"44":C.coral+"44"}`, borderRadius:7, padding:"5px 9px", marginBottom:7, fontSize:12, color:m.transaction.type==="income"?C.gold:C.coral }}>
                  {m.transaction.type==="income"?"✅ +":"✅ -"}{fmt(m.transaction.amount)} · {m.transaction.description}
                </div>
              )}
              <span dangerouslySetInnerHTML={{__html:renderText(m.text)}}/>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:26,height:26,borderRadius:"50%",background:C.goldDim,border:`1px solid ${C.goldMid}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>🤖</div>
            <div style={{ background:C.aiBubble, border:`1px solid ${C.cardBorder}`, borderRadius:"18px 18px 18px 4px", padding:"12px 16px" }}>
              <div style={{ display:"flex", gap:4 }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:"50%",background:C.gold,animation:`bounce 1s infinite ${i*.15}s`,opacity:.8 }}/>)}</div>
            </div>
          </div>
        )}
        <div ref={chatEndRef}/>
      </div>

      {/* Quick actions */}
      <div style={{ padding:"0 14px 8px", display:"flex", gap:6, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        {["Ver extrato","Resumo do mês","Maiores gastos","Quanto falta?","Pendentes"].map(q=>(
          <button key={q} onClick={()=>setInput(q)} style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:20, padding:"6px 12px", fontSize:12, color:C.textDim, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>{q}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding:"8px 14px 14px", padding:"8px 14px max(14px, env(safe-area-inset-bottom))", borderTop:`1px solid ${C.cardBorder}`, display:"flex", gap:9, alignItems:"center" }}>
        <input
          placeholder="Gastei 50 no mercado, recebi salário..."
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}
          style={{ flex:1, background:C.inputBg, border:`1px solid ${C.cardBorder}`, borderRadius:24, padding:"11px 16px", color:C.text, fontSize:14, outline:"none", WebkitAppearance:"none" }}
        />
        <button onClick={sendMessage} disabled={loading||!input.trim()} style={{ width:42,height:42,borderRadius:"50%",background:loading||!input.trim()?C.cardBorder:C.gold,border:"none",cursor:loading||!input.trim()?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,color:loading||!input.trim()?C.textMuted:"#000",transition:"background .15s" }}>↑</button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────
function DashboardView({ transactions, setTransactions, selectedMonth, setSelectedMonth, filtered, income, expense, balance }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [form, setForm] = useState({description:"",amount:"",type:"expense",category:"alimentacao",date:today(),recurring:false});

  const months = [...new Set(transactions.map(t=>monthKey(t.date)))].sort().reverse();

  // Se não tem lançamentos, não mostra seletor de mês

  // Aplica filtro de data se definido
  const filteredByDate = (dateFrom || dateTo)
    ? filtered.filter(t => {
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        return true;
      })
    : filtered;

  const periodIncome = filteredByDate.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const periodExpense = filteredByDate.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const isFiltering = dateFrom || dateTo;

  const byCategory = filteredByDate.filter(t=>t.type==="expense").reduce((acc,t)=>{acc[t.category]=(acc[t.category]||0)+t.amount;return acc;},{});
  const topCats = Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).slice(0,5);

  function addManual() {
    if (!form.description||!form.amount) return;
    setTransactions([{id:Date.now(),...form,amount:parseFloat(form.amount)},...transactions]);
    setShowAdd(false);
    setForm({description:"",amount:"",type:"expense",category:"alimentacao",date:today(),recurring:false});
  }

  function clearFilter() { setDateFrom(""); setDateTo(""); setShowFilter(false); }

  return (
    <div style={{ flex:1, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:14, WebkitOverflowScrolling:"touch" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
        <div style={{ display:"flex", gap:6, overflowX:"auto", WebkitOverflowScrolling:"touch", flexShrink:1 }}>
          {months.length === 0 ? (
            <span style={{ fontSize:12, color:C.textMuted, padding:"6px 0" }}>Nenhum lançamento ainda</span>
          ) : months.slice(0,6).map(m=>{const[y,mo]=m.split("-"); return(
            <div key={m} style={{ display:"flex", alignItems:"center", background:selectedMonth===m?C.gold:C.card, border:`1px solid ${selectedMonth===m?C.gold:C.cardBorder}`, borderRadius:20, overflow:"hidden", flexShrink:0 }}>
              <button onClick={()=>setSelectedMonth(m)} style={{ background:"transparent", border:"none", padding:"6px 10px", fontSize:12, cursor:"pointer", color:selectedMonth===m?"#000":C.textMuted, fontWeight:selectedMonth===m?700:400, whiteSpace:"nowrap" }}>{MONTHS[parseInt(mo)-1]}/{y.slice(2)}</button>
              {months.length > 1 && <button onClick={()=>{
                const newTxs = transactions.filter(t=>monthKey(t.date)!==m);
                setTransactions(newTxs);
                if (selectedMonth===m) setSelectedMonth(months.filter(x=>x!==m)[0]||monthKey(today()));
              }} style={{ background:"transparent", border:"none", borderLeft:`1px solid ${selectedMonth===m?"#00000022":C.cardBorder}`, padding:"6px 7px", cursor:"pointer", color:selectedMonth===m?"#000":C.textMuted, fontSize:12, lineHeight:1 }}>×</button>}
            </div>
          );})}
        </div>
        <button onClick={()=>setShowAdd(true)} style={{ background:C.gold, color:"#000", border:"none", borderRadius:20, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0 }}>+ Lançar</button>
      </div>

      {/* Filtro de período */}
      <div style={{ background:C.card, border:`1px solid ${isFiltering?C.gold:C.cardBorder}`, borderRadius:12, padding:"10px 14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: showFilter?10:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:13, color:isFiltering?C.gold:C.textMuted, fontWeight:isFiltering?600:400 }}>
              📅 {isFiltering ? `${dateFrom||"início"} → ${dateTo||"hoje"}` : "Filtrar por período"}
            </span>
            {isFiltering && <span style={{ fontSize:11, background:C.goldDim, color:C.gold, padding:"2px 8px", borderRadius:20, fontWeight:600 }}>{filteredByDate.length} itens</span>}
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {isFiltering && <button onClick={clearFilter} style={{ background:"none", border:`1px solid ${C.cardBorder}`, borderRadius:20, padding:"4px 10px", fontSize:11, color:C.textMuted, cursor:"pointer" }}>Limpar</button>}
            <button onClick={()=>setShowFilter(!showFilter)} style={{ background:isFiltering?C.goldDim:"none", border:`1px solid ${isFiltering?C.gold:C.cardBorder}`, borderRadius:20, padding:"4px 10px", fontSize:11, color:isFiltering?C.gold:C.textMuted, cursor:"pointer" }}>{showFilter?"Fechar":"Filtrar"}</button>
          </div>
        </div>
        {showFilter && (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:C.textMuted, marginBottom:3 }}>De</div>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ width:"100%", background:C.inputBg, border:`1px solid ${C.cardBorder}`, borderRadius:8, padding:"8px 10px", color:C.text, fontSize:13, outline:"none", boxSizing:"border-box", WebkitAppearance:"none" }}/>
            </div>
            <div style={{ fontSize:12, color:C.textMuted, marginTop:14 }}>→</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:C.textMuted, marginBottom:3 }}>Até</div>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ width:"100%", background:C.inputBg, border:`1px solid ${C.cardBorder}`, borderRadius:8, padding:"8px 10px", color:C.text, fontSize:13, outline:"none", boxSizing:"border-box", WebkitAppearance:"none" }}/>
            </div>
          </div>
        )}
        {isFiltering && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
            <div style={{ background:C.goldDim, border:`1px solid ${C.gold}33`, borderRadius:10, padding:"8px 12px" }}>
              <div style={{ fontSize:9, color:C.gold }}>↑ Entradas no período</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.gold }}>{fmt(periodIncome)}</div>
            </div>
            <div style={{ background:C.coralDim, border:`1px solid ${C.coral}33`, borderRadius:10, padding:"8px 12px" }}>
              <div style={{ fontSize:9, color:C.coral }}>↓ Saídas no período</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.coral }}>{fmt(periodExpense)}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
        {[["+Entradas",fmt(income),C.gold,C.goldDim],["-Saídas",fmt(expense),C.coral,C.coralDim],["Saldo",fmt(balance),balance>=0?C.gold:C.coral,balance>=0?C.goldDim:C.coralDim]].map(([label,val,col,bg])=>(
          <div key={label} style={{ background:bg, border:`1px solid ${col}33`, borderRadius:12, padding:"10px 12px" }}>
            <div style={{ fontSize:10, color:col, marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:700, color:col }}>{val}</div>
          </div>
        ))}
      </div>

      {topCats.length>0&&(
        <div style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:14, padding:14 }}>
          <div style={{ fontSize:12, fontWeight:600, marginBottom:10, color:C.textDim }}>Por categoria {isFiltering?"(período)":"(mês)"}</div>
          {topCats.map(([cat,val])=>{const c=CATEGORIES[cat]||CATEGORIES.outros;const total=isFiltering?periodExpense:expense;const pct=total>0?(val/total)*100:0;return(
            <div key={cat} style={{ marginBottom:9 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                <span>{c.emoji} {c.label}</span>
                <span style={{ color:C.textMuted }}>{fmt(val)} <span style={{ fontSize:10 }}>({pct.toFixed(0)}%)</span></span>
              </div>
              <div style={{ height:5, background:C.inputBg, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:c.color, borderRadius:3 }}/>
              </div>
            </div>
          );})}
        </div>
      )}

      <div style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:14, overflow:"hidden" }}>
        <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.cardBorder}`, fontSize:12, fontWeight:600, color:C.textDim }}>
          Lançamentos · {filteredByDate.length}{isFiltering?" (filtrado)":""}
        </div>
        {filteredByDate.length===0
          ?<div style={{ padding:24, textAlign:"center", color:C.textMuted, fontSize:13 }}>Nenhum lançamento {isFiltering?"nesse período":"este mês"}.<br/>{!isFiltering&&"Use o chat para lançar."}</div>
          :filteredByDate.map(t=>{const c=CATEGORIES[t.category]||CATEGORIES.outros;return(
            <div key={t.id} style={{ display:"flex", alignItems:"center", padding:"11px 14px", borderBottom:`1px solid ${C.cardBorder}`, gap:10 }}>
              <div style={{ width:34,height:34,borderRadius:9,background:t.type==="income"?C.goldDim:C.coralDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0 }}>{c.emoji}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.description}</div>
                <div style={{ fontSize:11, color:C.textMuted }}>{t.date}{t.recurring?" · 🔄":""}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:t.type==="income"?C.gold:C.coral, flexShrink:0 }}>{t.type==="income"?"+":"-"}{fmt(t.amount)}</div>
              <button onClick={()=>setTransactions(transactions.filter(x=>x.id!==t.id))} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:18,padding:"4px 6px",lineHeight:1 }}>×</button>
            </div>
          );})}
      </div>

      {showAdd&&(
        <div style={{ position:"fixed",inset:0,background:"#000B",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:50 }} onClick={()=>setShowAdd(false)}>
          <div style={{ background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:"20px 20px 0 0",padding:"20px 16px",paddingBottom:`max(20px, env(safe-area-inset-bottom))`,width:"100%",maxWidth:500 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:14 }}>Novo lançamento</div>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              {["expense","income"].map(tp=>(
                <button key={tp} onClick={()=>setForm(f=>({...f,type:tp}))} style={{ flex:1,background:form.type===tp?(tp==="income"?C.goldDim:C.coralDim):C.inputBg,border:`1px solid ${form.type===tp?(tp==="income"?C.gold:C.coral):C.cardBorder}`,borderRadius:10,padding:"10px",color:form.type===tp?(tp==="income"?C.gold:C.coral):C.textMuted,cursor:"pointer",fontSize:13,fontWeight:600 }}>
                  {tp==="income"?"💰 Entrada":"💸 Saída"}
                </button>
              ))}
            </div>
            {[["Descrição","text","description","Ex: Mercado, Netflix..."],["Valor (R$)","number","amount","0,00"],["Data","date","date",""]].map(([label,type,key,ph])=>(
              <div key={key} style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:C.textMuted, marginBottom:3 }}>{label}</div>
                <input type={type} placeholder={ph} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{ width:"100%",background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"10px 12px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",WebkitAppearance:"none" }}/>
              </div>
            ))}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Categoria</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {Object.entries(CATEGORIES).filter(([k])=>k!=="receita").map(([k,c])=>(
                  <button key={k} onClick={()=>setForm(f=>({...f,category:k}))} style={{ background:form.category===k?c.color+"33":C.inputBg,border:`1px solid ${form.category===k?c.color:C.cardBorder}`,borderRadius:20,padding:"5px 10px",fontSize:12,color:form.category===k?c.color:C.textMuted,cursor:"pointer" }}>{c.emoji} {c.label}</button>
                ))}
              </div>
            </div>
            <label style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14,cursor:"pointer",fontSize:12,color:C.textDim }}>
              <input type="checkbox" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))}/> 🔄 Recorrente (assinatura)
            </label>
            <button onClick={addManual} style={{ width:"100%",background:C.gold,color:"#000",border:"none",borderRadius:12,padding:"13px",fontWeight:700,fontSize:15,cursor:"pointer" }}>Confirmar lançamento</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Budget ────────────────────────────────────────────────────────
function BudgetView({ budgets, setBudgets, selectedMonth }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({description:"",amount:"",category:"alimentacao"});

  const totalBudgeted = budgets.reduce((s,b)=>s+b.amount,0);
  const totalPaid = budgets.filter(b=>b.paid).reduce((s,b)=>s+b.amount,0);
  const totalPending = totalBudgeted-totalPaid;

  const togglePaid = id => setBudgets(budgets.map(b=>b.id===id?{...b,paid:!b.paid,paidAt:!b.paid?today():null}:b));
  const openAdd = () => { setForm({description:"",amount:"",category:"alimentacao"}); setEditId(null); setShowAdd(true); };
  const openEdit = b => { setForm({description:b.description,amount:String(b.amount),category:b.category}); setEditId(b.id); setShowAdd(true); };
  const saveBudget = () => {
    if (!form.description||!form.amount) return;
    const updated = editId
      ?budgets.map(b=>b.id===editId?{...b,...form,amount:parseFloat(form.amount)}:b)
      :[...budgets,{id:Date.now(),...form,amount:parseFloat(form.amount),paid:false,paidAt:null}];
    setBudgets(updated); setShowAdd(false);
  };

  const [mo] = (()=>{const[y,m]=selectedMonth.split("-");return[MONTHS[parseInt(m)-1],y];})();

  return (
    <div style={{ flex:1, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:14, WebkitOverflowScrolling:"touch" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontWeight:700, fontSize:16 }}>Orçamento · {mo}</div>
          <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>Despesas previstas do mês</div>
        </div>
        <button onClick={openAdd} style={{ background:C.gold, color:"#000", border:"none", borderRadius:20, padding:"8px 14px", fontSize:13, fontWeight:700, cursor:"pointer" }}>+ Adicionar</button>
      </div>

      {budgets.length>0&&(
        <div style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:14, padding:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
            <div><div style={{ fontSize:9, color:C.textMuted }}>Total previsto</div><div style={{ fontSize:15, fontWeight:700 }}>{fmt(totalBudgeted)}</div></div>
            <div><div style={{ fontSize:9, color:C.gold }}>✅ Pago</div><div style={{ fontSize:15, fontWeight:700, color:C.gold }}>{fmt(totalPaid)}</div></div>
            <div><div style={{ fontSize:9, color:C.amber }}>⏳ Pendente</div><div style={{ fontSize:15, fontWeight:700, color:C.amber }}>{fmt(totalPending)}</div></div>
          </div>
          <div style={{ height:5, background:C.inputBg, borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${totalBudgeted>0?(totalPaid/totalBudgeted)*100:0}%`, background:C.gold, borderRadius:3, transition:"width .4s" }}/>
          </div>
          <div style={{ fontSize:10, color:C.textMuted, marginTop:5 }}>{totalBudgeted>0?((totalPaid/totalBudgeted)*100).toFixed(0):0}% das despesas pagas</div>
        </div>
      )}

      {budgets.length===0?(
        <div style={{ background:C.card, border:`1px solid ${C.cardBorder}`, borderRadius:14, padding:36, textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🎯</div>
          <div style={{ fontWeight:600, marginBottom:5 }}>Nenhuma despesa prevista</div>
          <div style={{ fontSize:12, color:C.textMuted, marginBottom:14 }}>Adicione suas contas fixas do mês — aluguel, luz, assinaturas...</div>
          <button onClick={openAdd} style={{ background:C.gold,color:"#000",border:"none",borderRadius:20,padding:"10px 20px",fontWeight:700,cursor:"pointer" }}>+ Adicionar despesa</button>
        </div>
      ):(
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          {budgets.map(b=>{
            const cat=CATEGORIES[b.category]||CATEGORIES.outros;
            return(
              <div key={b.id} style={{ background:C.card, border:`1px solid ${b.paid?C.gold+"44":C.cardBorder}`, borderRadius:14, padding:13, opacity:b.paid?.88:1, transition:"all .2s" }}>
                <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <div style={{ width:34,height:34,borderRadius:9,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0 }}>{cat.emoji}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, textDecoration:b.paid?"line-through":"none", color:b.paid?C.textMuted:C.text }}>{b.description}</div>
                    <div style={{ fontSize:11, color:C.textMuted }}>{cat.label}{b.paid&&b.paidAt?` · pago ${b.paidAt}`:""}</div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:b.paid?C.textMuted:C.coral, flexShrink:0 }}>{fmt(b.amount)}</div>
                  <div style={{ display:"flex", gap:5, marginLeft:2 }}>
                    <button onClick={()=>togglePaid(b.id)} style={{ background:b.paid?C.goldDim:C.inputBg, border:`1px solid ${b.paid?C.gold:C.cardBorder}`, borderRadius:8, padding:"5px 9px", cursor:"pointer", fontSize:11, color:b.paid?C.gold:C.textMuted, fontWeight:600, whiteSpace:"nowrap", transition:"all .2s" }}>
                      {b.paid?"✅ Pago":"⏳ Pagar"}
                    </button>
                    <button onClick={()=>openEdit(b)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"4px 5px" }}>✏️</button>
                    <button onClick={()=>setBudgets(budgets.filter(x=>x.id!==b.id))} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:17,padding:"4px 5px",lineHeight:1 }}>×</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd&&(
        <div style={{ position:"fixed",inset:0,background:"#000B",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:50 }} onClick={()=>setShowAdd(false)}>
          <div style={{ background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:"20px 20px 0 0",padding:"20px 16px",paddingBottom:`max(20px, env(safe-area-inset-bottom))`,width:"100%",maxWidth:500 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>{editId?"Editar despesa":"Nova despesa prevista"}</div>
            <div style={{ fontSize:12, color:C.textMuted, marginBottom:14 }}>Adicione uma conta fixa ou prevista para o mês</div>
            {[["Descrição","text","description","Ex: Aluguel, Netflix, Academia..."],["Valor (R$)","number","amount","0,00"]].map(([label,type,key,ph])=>(
              <div key={key} style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:C.textMuted, marginBottom:3 }}>{label}</div>
                <input type={type} placeholder={ph} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{ width:"100%",background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:10,padding:"10px 12px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",WebkitAppearance:"none" }}/>
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>Categoria</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {Object.entries(CATEGORIES).filter(([k])=>k!=="receita").map(([k,c])=>(
                  <button key={k} onClick={()=>setForm(f=>({...f,category:k}))} style={{ background:form.category===k?c.color+"33":C.inputBg,border:`1px solid ${form.category===k?c.color:C.cardBorder}`,borderRadius:20,padding:"5px 10px",fontSize:12,color:form.category===k?c.color:C.textMuted,cursor:"pointer" }}>{c.emoji} {c.label}</button>
                ))}
              </div>
            </div>
            <button onClick={saveBudget} style={{ width:"100%",background:C.gold,color:"#000",border:"none",borderRadius:12,padding:"13px",fontWeight:700,fontSize:15,cursor:"pointer" }}>{editId?"Salvar":"Adicionar despesa"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
