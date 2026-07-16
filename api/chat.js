import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Lista de origens permitidas
const ALLOWED_ORIGINS = [
  'https://cashai.vercel.app',
  'https://controle-financeiro-seven-mauve.vercel.app',
  'http://localhost:3000'
];

export default async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────────
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── AUTENTICAÇÃO — verifica token do Clerk ─────────────────────
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const token = authHeader.split(' ')[1];
    let userId;

    try {
      const payload = await clerk.verifyToken(token);
      userId = payload.sub;
    } catch {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // ── VERIFICAÇÃO DE ACESSO PAGO ─────────────────────────────
    const user = await clerk.users.getUser(userId);
    const meta = user.publicMetadata || {};

    // Bloqueia se não tiver status active ou trial válido
    if (meta.status === 'blocked') {
      return res.status(403).json({ error: 'Acesso bloqueado' });
    }

    if (meta.status !== 'active') {
      // Verifica trial
      if (meta.trial_end) {
        const trialEnd = new Date(meta.trial_end);
        if (new Date() > trialEnd) {
          return res.status(403).json({ error: 'Trial expirado' });
        }
      } else {
        // Usa data de criação da conta (7 dias)
        const created = new Date(user.createdAt);
        const daysDiff = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          return res.status(403).json({ error: 'Trial expirado' });
        }
      }
    }

    // ── SANITIZAÇÃO DO INPUT ───────────────────────────────────
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Mensagens inválidas' });
    }

    // Limita tamanho das mensagens para evitar prompt injection massivo
    const sanitizedMessages = messages.slice(-10).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 2000) // máximo 2000 chars por mensagem
    }));

    // Detecta tentativas de prompt injection
    const lastMessage = sanitizedMessages[sanitizedMessages.length - 1]?.content || '';
    const injectionPatterns = [
      /ignore.{0,20}(previous|all|above|instrução|anterior)/i,
      /system.{0,10}prompt/i,
      /jailbreak/i,
      /você agora é/i,
      /esqueça.{0,20}(regras|instruções)/i,
    ];
    const isInjectionAttempt = injectionPatterns.some(p => p.test(lastMessage));
    if (isInjectionAttempt) {
      return res.status(400).json({ error: 'Mensagem inválida' });
    }

    // ── CHAMADA À ANTHROPIC ────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.REACT_APP_ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: system || '',
        messages: sanitizedMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: 'Erro na IA', detail: err });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Erro no handler:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
