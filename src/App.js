import { useState, useEffect, useRef } from "react";
import { useUser, SignIn, SignUp, UserButton } from "@clerk/clerk-react";
import { ptBR } from "@clerk/localizations";

const COLORS = {
  bg: "#0F1117", card: "#1A1D27", cardBorder: "#252836",
  emerald: "#00C896", emeraldDim: "#00C89622",
  coral: "#FF6B6B", coralDim: "#FF6B6B22",
  amber: "#FFB347", amberDim: "#FFB34722",
  blue: "#4B9EFF", blueDim: "#4B9EFF22",
  text: "#E8EAF0", textMuted: "#6B7280", textDim: "#9CA3AF",
  inputBg: "#12141C", userBubble: "#1E3A2F", aiBubble: "#1A1D27",
};

const CATEGORIES = {
  alimentacao: { label: "Alimentação", emoji: "🍽️", color: COLORS.amber },
  transporte: { label: "Transporte", emoji: "🚗", color: COLORS.blue },
  moradia: { label: "Moradia", emoji: "🏠", color: COLORS.coral },
  saude: { label: "Saúde", emoji: "💊", color: "#A78BFA" },
  lazer: { label: "Lazer", emoji: "🎉", color: "#F472B6" },
  assinatura: { label: "Assinaturas", emoji: "📱", color: COLORS.blue },
  cartao: { label: "Cartão de Crédito", emoji: "💳", color: COLORS.coral },
  receita: { label: "Receita", emoji: "💰", color: COLORS.emerald },
  outros: { label: "Outros", emoji: "📦", color: COLORS.textMuted },
};

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_KEY || "";

function formatBRL(n) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
function today() { return new Date().toISOString().split("T")[0]; }
function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

async function callClaude(messages, systemPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-calls": "true",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: systemPrompt, messages }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("") || "";
}

// ── Auth Screen ───────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("signin");
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🤖</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.5px" }}>Controle Financeiro</div>
        <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>Gerencie suas finanças com IA</div>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[["signin", "Entrar"], ["signup", "Criar conta"]].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, background: mode === m ? COLORS.emeraldDim : "transparent", color: mode === m ? COLORS.emerald : COLORS.textMuted, border: `1px solid ${mode === m ? COLORS.emerald : COLORS.cardBorder}`, borderRadius: 10, padding: "10px", cursor: "pointer", fontSize: 14, fontWeight: mode === m ? 600 : 400, transition: "all .15s" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ 
          "--clerk-font-family": "Inter, system-ui, sans-serif",
        }}>
          {mode === "signin" 
            ? <SignIn routing="hash" appearance={{ variables: { colorPrimary: COLORS.emerald, colorBackground: COLORS.card, colorText: COLORS.text, colorInputBackground: COLORS.inputBg, colorInputText: COLORS.text, borderRadius: "10px" }, elements: { card: { background: "transparent", boxShadow: "none", border: "none" }, rootBox: { width: "100%" } } }} />
            : <SignUp routing="hash" appearance={{ variables: { colorPrimary: COLORS.emerald, colorBackground: COLORS.card, colorText: COLORS.text, colorInputBackground: COLORS.inputBg, colorInputText: COLORS.text, borderRadius: "10px" }, elements: { card: { background: "transparent", boxShadow: "none", border: "none" }, rootBox: { width: "100%" } } }} />
          }
        </div>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────
export default function App() {
  const { isSignedIn, user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: COLORS.emerald, fontSize: 32 }}>🤖</div>
      </div>
    );
  }

  if (!isSignedIn) return <AuthScreen />;
  return <MainApp user={user} />;
}

function MainApp({ user }) {
  const userId = user.id;
  const [tab, setTab] = useState("chat");
  const [transactions, setTransactions] = useState(() => load(`cf_tx_${userId}`, []));
  const [messages, setMessages] = useState(() => {
    const saved = load(`cf_msg_${userId}`, []);
    return saved.length > 0 ? saved : [{
      role: "assistant",
      text: `Olá, ${user.firstName || ""}! 👋 Bem-vindo ao seu **Controle Financeiro**.\n\nPode lançar assim:\n• _"gastei 45 no mercado"_\n• _"recebi 3200 de salário"_\n• _"paguei 89 de Netflix"_\n\nO que vai lançar? 🤖`,
      ts: Date.now(),
    }];
  });
  const [budgets, setBudgets] = useState(() => load(`cf_bg_${userId}`, []));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(today()));
  const chatEndRef = useRef(null);

  useEffect(() => { save(`cf_tx_${userId}`, transactions); }, [transactions, userId]);
  useEffect(() => { save(`cf_msg_${userId}`, messages.slice(-60)); }, [messages, userId]);
  useEffect(() => { save(`cf_bg_${userId}`, budgets); }, [budgets, userId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const summary = (txs) => {
    const filtered = txs.filter(t => monthKey(t.date) === selectedMonth);
    const income = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense, filtered };
  };

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    const userMsg = { role: "user", text: userText, ts: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    const { income, expense, balance } = summary(transactions);
    const systemPrompt = `Você é um assistente de Controle Financeiro. Seu tom é amigável, direto e usa emojis com moderação.

ESTADO FINANCEIRO ATUAL (mês ${selectedMonth}):
- Receitas: ${formatBRL(income)}
- Despesas: ${formatBRL(expense)}
- Saldo: ${formatBRL(balance)}
- Transações recentes: ${JSON.stringify(transactions.slice(-20))}

CATEGORIAS DISPONÍVEIS: alimentacao, transporte, moradia, saude, lazer, assinatura, cartao, receita, outros

FORMATO DE RESPOSTA OBRIGATÓRIO - retorne SEMPRE um JSON neste formato exato (sem markdown):
{
  "action": "add_transaction" | "query" | "chat",
  "transaction": {
    "description": "descrição curta",
    "amount": 0,
    "type": "income" | "expense",
    "category": "categoria",
    "date": "YYYY-MM-DD",
    "person": null,
    "recurring": false
  },
  "reply": "sua resposta amigável aqui"
}

Se não for um lançamento, action = "chat" e transaction = null.
Para lançamentos, calcule o NOVO saldo incluindo a transação e mostre no reply.
Seja muito conciso (2-4 linhas). Use **negrito** apenas para valores importantes.`;

    const apiMessages = newMessages.slice(-10).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));

    try {
      const raw = await callClaude(apiMessages, systemPrompt);
      let parsed;
      try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
      catch { parsed = { action: "chat", transaction: null, reply: raw }; }

      if (parsed.action === "add_transaction" && parsed.transaction?.amount > 0) {
        const newTx = { id: Date.now(), description: parsed.transaction.description, amount: parsed.transaction.amount, type: parsed.transaction.type, category: parsed.transaction.category || "outros", date: parsed.transaction.date || today(), person: parsed.transaction.person, recurring: parsed.transaction.recurring || false };
        setTransactions(prev => [newTx, ...prev]);
      }

      setMessages([...newMessages, { role: "assistant", text: parsed.reply || "Entendido!", transaction: parsed.action === "add_transaction" ? parsed.transaction : null, ts: Date.now() }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", text: "Ops, tive um problema. Tenta de novo? 🙏", ts: Date.now() }]);
    }
    setLoading(false);
  }

  const { income, expense, balance, filtered } = summary(transactions);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <div style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.cardBorder}`, padding: "0 16px", display: "flex", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "14px 0" }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>Controle Financeiro</span>
        </div>
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {[["chat","💬"],["dashboard","📊"],["budget","🎯"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: tab===id ? COLORS.emeraldDim : "transparent", color: tab===id ? COLORS.emerald : COLORS.textMuted, border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontWeight: tab===id ? 600 : 400, fontSize: 16, transition: "all .15s" }}>{label}</button>
          ))}
          <div style={{ marginLeft: 8 }}>
            <UserButton appearance={{ elements: { avatarBox: { width: 32, height: 32 } } }} />
          </div>
        </div>
      </div>

      {/* Saldo */}
      <div style={{ background: "linear-gradient(135deg, #0F2818 0%, #0F1117 100%)", borderBottom: `1px solid ${COLORS.cardBorder}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Saldo do mês</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: balance >= 0 ? COLORS.emerald : COLORS.coral, letterSpacing: "-0.5px" }}>{formatBRL(balance)}</div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: COLORS.emerald }}>↑ Entradas</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{formatBRL(income)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: COLORS.coral }}>↓ Saídas</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{formatBRL(expense)}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "chat" ? <ChatView messages={messages} loading={loading} input={input} setInput={setInput} sendMessage={sendMessage} chatEndRef={chatEndRef} />
         : tab === "dashboard" ? <DashboardView transactions={transactions} setTransactions={setTransactions} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} filtered={filtered} income={income} expense={expense} balance={balance} />
         : <BudgetView budgets={budgets} setBudgets={setBudgets} transactions={transactions} selectedMonth={selectedMonth} />}
      </div>
    </div>
  );
}

function renderText(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/_(.*?)_/g, '<em>$1</em>').replace(/\n/g, '<br/>');
}

function ChatView({ messages, loading, input, setInput, sendMessage, chatEndRef }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && <div style={{ width: 28, height: 28, borderRadius: "50%", background: COLORS.emeraldDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8, flexShrink: 0, marginTop: 2 }}>🤖</div>}
            <div style={{ maxWidth: "80%", background: m.role === "user" ? COLORS.userBubble : COLORS.aiBubble, border: `1px solid ${m.role === "user" ? "#1a4a30" : COLORS.cardBorder}`, borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 14px", fontSize: 14, lineHeight: 1.5 }}>
              {m.transaction && <div style={{ background: COLORS.emeraldDim, border: `1px solid ${COLORS.emerald}33`, borderRadius: 8, padding: "6px 10px", marginBottom: 8, fontSize: 12, color: COLORS.emerald }}>✅ {m.transaction.type === "income" ? "+" : "-"}{formatBRL(m.transaction.amount)} · {m.transaction.description}</div>}
              <span dangerouslySetInnerHTML={{ __html: renderText(m.text) }} />
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: COLORS.emeraldDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
            <div style={{ background: COLORS.aiBubble, border: `1px solid ${COLORS.cardBorder}`, borderRadius: "18px 18px 18px 4px", padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: 4 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.emerald, animation: `bounce 1s infinite ${i*0.15}s`, opacity: 0.7 }} />)}</div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div style={{ padding: "0 16px 8px", display: "flex", gap: 6, overflowX: "auto" }}>
        {["Ver extrato","Resumo do mês","Maiores gastos","Quanto falta?"].map(q => (
          <button key={q} onClick={() => setInput(q)} style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 20, padding: "6px 12px", fontSize: 12, color: COLORS.textDim, cursor: "pointer", whiteSpace: "nowrap" }}>{q}</button>
        ))}
      </div>
      <div style={{ padding: "8px 16px 16px", borderTop: `1px solid ${COLORS.cardBorder}`, display: "flex", gap: 10, alignItems: "center" }}>
        <input placeholder="Gastei 50 no mercado, recebi salário..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} style={{ flex: 1, background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 24, padding: "11px 16px", color: COLORS.text, fontSize: 14, outline: "none" }} />
        <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ width: 44, height: 44, borderRadius: "50%", background: loading || !input.trim() ? COLORS.cardBorder : COLORS.emerald, border: "none", cursor: loading || !input.trim() ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>↑</button>
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

function DashboardView({ transactions, setTransactions, selectedMonth, setSelectedMonth, filtered, income, expense, balance }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", type: "expense", category: "alimentacao", date: today(), person: "", recurring: false });

  const months = [...new Set(transactions.map(t => monthKey(t.date)))].sort().reverse();
  if (!months.includes(selectedMonth)) months.unshift(selectedMonth);

  const byCategory = filtered.filter(t => t.type === "expense").reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});
  const topCats = Object.entries(byCategory).sort((a, b) => b[1]-a[1]).slice(0,5);

  function addManual() {
    if (!form.description || !form.amount) return;
    setTransactions([{ id: Date.now(), ...form, amount: parseFloat(form.amount) }, ...transactions]);
    setShowAdd(false);
    setForm({ description: "", amount: "", type: "expense", category: "alimentacao", date: today(), person: "", recurring: false });
  }

  const fmt = n => formatBRL(n);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {months.slice(0,6).map(m => { const [y,mo] = m.split("-"); return <button key={m} onClick={() => setSelectedMonth(m)} style={{ background: selectedMonth===m ? COLORS.emerald : COLORS.card, color: selectedMonth===m ? "#000" : COLORS.textMuted, border: `1px solid ${selectedMonth===m ? COLORS.emerald : COLORS.cardBorder}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: selectedMonth===m ? 600 : 400, whiteSpace: "nowrap" }}>{MONTHS[parseInt(mo)-1]}/{y.slice(2)}</button>; })}
        </div>
        <button onClick={() => setShowAdd(true)} style={{ background: COLORS.emerald, color: "#000", border: "none", borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, marginLeft: 8 }}>+ Lançar</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[["+Entradas",fmt(income),COLORS.emerald,COLORS.emeraldDim],["-Saídas",fmt(expense),COLORS.coral,COLORS.coralDim],["Saldo",fmt(balance),balance>=0?COLORS.emerald:COLORS.coral,balance>=0?COLORS.emeraldDim:COLORS.coralDim]].map(([label,val,c,bg]) => (
          <div key={label} style={{ background: bg, border: `1px solid ${c}33`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: c, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{val}</div>
          </div>
        ))}
      </div>

      {topCats.length > 0 && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: COLORS.textDim }}>Por categoria</div>
          {topCats.map(([cat,val]) => { const c = CATEGORIES[cat]||CATEGORIES.outros; const pct = expense>0?(val/expense)*100:0; return (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span>{c.emoji} {c.label}</span><span style={{ color: COLORS.textMuted }}>{fmt(val)} <span style={{ fontSize: 11 }}>({pct.toFixed(0)}%)</span></span></div>
              <div style={{ height: 6, background: COLORS.inputBg, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: c.color, borderRadius: 3 }} /></div>
            </div>
          ); })}
        </div>
      )}

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${COLORS.cardBorder}`, fontSize: 13, fontWeight: 600, color: COLORS.textDim }}>Lançamentos · {filtered.length}</div>
        {filtered.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 14 }}>Nenhum lançamento este mês.</div>
          : filtered.map(t => { const c = CATEGORIES[t.category]||CATEGORIES.outros; return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${COLORS.cardBorder}`, gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: t.type==="income"?COLORS.emeraldDim:COLORS.coralDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{c.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t.date}{t.person?` · ${t.person}`:""}{t.recurring?" · 🔄":""}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.type==="income"?COLORS.emerald:COLORS.coral, flexShrink: 0 }}>{t.type==="income"?"+":"-"}{fmt(t.amount)}</div>
              <button onClick={() => setTransactions(transactions.filter(x=>x.id!==t.id))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted, fontSize: 16, padding: 4 }}>×</button>
            </div>
          ); })}
      </div>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000A", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={() => setShowAdd(false)}>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Novo lançamento</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {["expense","income"].map(t => <button key={t} onClick={() => setForm(f=>({...f,type:t}))} style={{ flex: 1, background: form.type===t?(t==="income"?COLORS.emeraldDim:COLORS.coralDim):COLORS.inputBg, border: `1px solid ${form.type===t?(t==="income"?COLORS.emerald:COLORS.coral):COLORS.cardBorder}`, borderRadius: 10, padding: "10px", color: form.type===t?(t==="income"?COLORS.emerald:COLORS.coral):COLORS.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{t==="income"?"💰 Entrada":"💸 Saída"}</button>)}
            </div>
            {[["Descrição","text","description","Ex: Mercado, Netflix..."],["Valor (R$)","number","amount","0,00"],["Data","date","date",""],["Quem pagou? (opcional)","text","person","Ex: João..."]].map(([label,type,key,ph]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>{label}</div>
                <input type={type} placeholder={ph} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{ width: "100%", background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>Categoria</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(CATEGORIES).filter(([k])=>k!=="receita").map(([k,c]) => <button key={k} onClick={()=>setForm(f=>({...f,category:k}))} style={{ background: form.category===k?c.color+"33":COLORS.inputBg, border: `1px solid ${form.category===k?c.color:COLORS.cardBorder}`, borderRadius: 20, padding: "5px 10px", fontSize: 12, color: form.category===k?c.color:COLORS.textMuted, cursor: "pointer" }}>{c.emoji} {c.label}</button>)}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer", fontSize: 13, color: COLORS.textDim }}>
              <input type="checkbox" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))} /> 🔄 Recorrente (assinatura)
            </label>
            <button onClick={addManual} style={{ width: "100%", background: COLORS.emerald, color: "#000", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Confirmar lançamento</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetView({ budgets, setBudgets, transactions, selectedMonth }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ description: "", amount: "", category: "alimentacao" });

  const spent = transactions.filter(t=>monthKey(t.date)===selectedMonth&&t.type==="expense").reduce((acc,t)=>{acc[t.category]=(acc[t.category]||0)+t.amount;return acc;},{});
  const totalBudgeted = budgets.reduce((s,b)=>s+b.amount,0);
  const totalSpent = budgets.reduce((s,b)=>s+(spent[b.category]||0),0);
  const totalLeft = totalBudgeted-totalSpent;
  const fmt = n => formatBRL(n);

  function openAdd() { setForm({description:"",amount:"",category:"alimentacao"}); setEditId(null); setShowAdd(true); }
  function openEdit(b) { setForm({description:b.description,amount:String(b.amount),category:b.category}); setEditId(b.id); setShowAdd(true); }
  function saveBudget() {
    if(!form.description||!form.amount) return;
    const updated = editId ? budgets.map(b=>b.id===editId?{...b,...form,amount:parseFloat(form.amount)}:b) : [...budgets,{id:Date.now(),...form,amount:parseFloat(form.amount)}];
    setBudgets(updated); setShowAdd(false);
  }
  const [mo] = (()=>{const[y,m]=selectedMonth.split("-");return[MONTHS[parseInt(m)-1],y];})();

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontWeight: 700, fontSize: 16 }}>Orçamento · {mo}</div><div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Previsão de gastos do mês</div></div>
        <button onClick={openAdd} style={{ background: COLORS.emerald, color: "#000", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Adicionar</button>
      </div>

      {budgets.length > 0 && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div><div style={{ fontSize: 11, color: COLORS.textMuted }}>Total previsto</div><div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(totalBudgeted)}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: COLORS.coral }}>Gasto até agora</div><div style={{ fontSize: 20, fontWeight: 700, color: COLORS.coral }}>{fmt(totalSpent)}</div></div>
          </div>
          <div style={{ height: 8, background: COLORS.inputBg, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${Math.min(totalBudgeted>0?(totalSpent/totalBudgeted)*100:0,100)}%`, background: totalSpent>totalBudgeted?COLORS.coral:totalSpent/totalBudgeted>0.8?COLORS.amber:COLORS.emerald, borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: COLORS.textMuted }}>{totalBudgeted>0?((totalSpent/totalBudgeted)*100).toFixed(0):0}% utilizado</span>
            <span style={{ color: totalLeft>=0?COLORS.emerald:COLORS.coral, fontWeight: 600 }}>{totalLeft>=0?`${fmt(totalLeft)} restante`:`${fmt(Math.abs(totalLeft))} acima do previsto`}</span>
          </div>
        </div>
      )}

      {budgets.length === 0 ? (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 14, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma previsão ainda</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>Adicione quanto planeja gastar em cada categoria este mês.</div>
          <button onClick={openAdd} style={{ background: COLORS.emerald, color: "#000", border: "none", borderRadius: 20, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}>+ Criar primeiro orçamento</button>
        </div>
      ) : budgets.map(b => {
        const cat=CATEGORIES[b.category]||CATEGORIES.outros; const spentAmt=spent[b.category]||0; const pct=b.amount>0?Math.min((spentAmt/b.amount)*100,100):0; const over=spentAmt>b.amount; const warn=!over&&pct>=80; const left=b.amount-spentAmt;
        return (
          <div key={b.id} style={{ background: COLORS.card, border: `1px solid ${over?COLORS.coral+"44":COLORS.cardBorder}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: cat.color+"22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{b.description}</div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{cat.label}</div></div>
              <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(b.amount)}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>previsto</div></div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={()=>openEdit(b)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 4 }}>✏️</button>
                <button onClick={()=>setBudgets(budgets.filter(x=>x.id!==b.id))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted, fontSize: 16, padding: 4 }}>×</button>
              </div>
            </div>
            <div style={{ height: 6, background: COLORS.inputBg, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}><div style={{ height: "100%", width: `${pct}%`, background: over?COLORS.coral:warn?COLORS.amber:COLORS.emerald, borderRadius: 3 }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: COLORS.textMuted }}>Gasto: <strong style={{ color: COLORS.text }}>{fmt(spentAmt)}</strong></span>
              {over?<span style={{ color: COLORS.coral, fontWeight: 600 }}>⚠️ {fmt(Math.abs(left))} acima</span>:warn?<span style={{ color: COLORS.amber, fontWeight: 600 }}>⚡ {fmt(left)} restante</span>:<span style={{ color: COLORS.emerald }}>{fmt(left)} restante</span>}
            </div>
          </div>
        );
      })}

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "#000A", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={()=>setShowAdd(false)}>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 480 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{editId?"Editar previsão":"Nova previsão de gasto"}</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>Quanto pretende gastar nessa categoria?</div>
            {[["Descrição","text","description","Ex: Supermercado, Aluguel..."],["Valor previsto (R$)","number","amount","0,00"]].map(([label,type,key,ph])=>(
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>{label}</div>
                <input type={type} placeholder={ph} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{ width: "100%", background: COLORS.inputBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>Categoria</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(CATEGORIES).filter(([k])=>k!=="receita").map(([k,c])=><button key={k} onClick={()=>setForm(f=>({...f,category:k}))} style={{ background: form.category===k?c.color+"33":COLORS.inputBg, border: `1px solid ${form.category===k?c.color:COLORS.cardBorder}`, borderRadius: 20, padding: "5px 10px", fontSize: 12, color: form.category===k?c.color:COLORS.textMuted, cursor: "pointer" }}>{c.emoji} {c.label}</button>)}
              </div>
            </div>
            <button onClick={saveBudget} style={{ width: "100%", background: COLORS.emerald, color: "#000", border: "none", borderRadius: 12, padding: "13px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{editId?"Salvar alterações":"Adicionar previsão"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
