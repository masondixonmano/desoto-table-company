import { useState, useEffect, useRef } from "react";

const BRAND = {
  name: "DeSoto Table Company",
  tagline: "Handcrafted Heirloom Furniture",
  sub: "Mason Dixon Manor LLC",
};

const SYSTEM_PROMPT = `You are a refined, warm sales assistant for DeSoto Table Company — a premium custom furniture maker specializing in heirloom-quality hardwood pieces. Your tone is like a trusted master craftsman: knowledgeable, unhurried, never pushy. Think of the brand as Rolex meets a Tennessee woodshop.

Your job is to gently qualify leads by gathering these 5 pieces of information in a natural conversation:
1. Piece type (dining table, bed, cabinet, shelves, etc.)
2. Dimensions (length, width, seats how many)
3. Wood/material preference (oak, walnut, pine, painted, etc.)
4. Budget range
5. Timeline/deadline

Rules:
- Ask one or two questions at a time, never a list of 5 at once.
- If their budget is under $2,000, be gracious but honest: "Our pieces start around $2,000 — we may not be the right fit for every budget, but I'd love to point you in the right direction."
- If they mention needing something in under 6 weeks, note there is a 25% rush surcharge.
- Once you have all 5 data points, provide a rough estimate and suggest scheduling a consultation.
- Known pricing: Dining table red oak seats 6 with benches & chairs = $3,500 (4–6 weeks). Farmhouse table seats 8 painted base solid oak top = $3,800 (4–6 weeks). Rush (under 6 weeks) = +25%.
- For other pieces, give a reasonable range based on complexity and materials.
- End qualified leads with: ask for their name, email or phone, and offer to have the craftsman follow up within 24 hours.
- Keep responses concise — 2–4 sentences max unless explaining pricing.
- Never use bullet points or numbered lists in chat. Write naturally.
- Sign off warmly. You represent a brand people will pass down to their grandchildren.

When you have collected all lead info, include this JSON block at the very end of your message (hidden from display, I will parse it):
LEAD_DATA:{"name":"...","contact":"...","pieceType":"...","dimensions":"...","material":"...","budget":"...","timeline":"...","estimate":"...","qualified":true/false}`;

const OPENING = `Welcome to DeSoto Table Company. I'm here to help you start your custom piece — whether you have a clear vision or just a feeling, we'll figure it out together.

What brings you here today? Are you looking for a specific piece, or just exploring what's possible?`;

function estimateFromConversation(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.content.includes("LEAD_DATA:")) {
      const match = m.content.match(/LEAD_DATA:(\{.*\})/);
      if (match) {
        try { return JSON.parse(match[1]); } catch { return null; }
      }
    }
  }
  return null;
}

function cleanMessage(text) {
  return text.replace(/LEAD_DATA:\{.*\}/, "").trim();
}

export default function DeSotoChat() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: OPENING, id: 0 }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [leadData, setLeadData] = useState(null);
  const [phase, setPhase] = useState("chat");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim(), id: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "I'm sorry, something went wrong. Please try again.";
      const assistantMsg = { role: "assistant", content: raw, id: Date.now() + 1 };
      const updated = [...newMessages, assistantMsg];
      setMessages(updated);

      const lead = estimateFromConversation(updated);
      if (lead && lead.qualified) {
        setLeadData(lead);
        setPhase("captured");
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I apologize — we seem to have a connection issue. Please try again in a moment.",
        id: Date.now() + 2,
      }]);
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div style={styles.root}>
      <div style={styles.grain} />
      <header style={styles.header}>
        <div style={styles.logoMark}>✦</div>
        <div style={styles.brandBlock}>
          <div style={styles.brandName}>{BRAND.name}</div>
          <div style={styles.brandTagline}>{BRAND.tagline}</div>
        </div>
        <div style={styles.logoMark}>✦</div>
      </header>

      <div style={styles.dividerLine} />

      <div style={styles.chatOuter}>
        <div style={styles.chatInner}>
          {messages.map((m, i) => (
            <MessageBubble key={m.id ?? i} msg={m} isFirst={i === 0} />
          ))}
          {loading && <TypingIndicator />}
          {leadData && phase === "captured" && <QuoteCard lead={leadData} />}
          <div ref={bottomRef} />
        </div>
      </div>

      <div style={styles.inputBar}>
        <div style={styles.inputWrapper}>
          <textarea
            ref={inputRef}
            style={styles.textarea}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Tell us about your vision…"
            rows={1}
            disabled={loading}
          />
          <button style={styles.sendBtn} onClick={sendMessage} disabled={loading || !input.trim()}>
            <SendIcon />
          </button>
        </div>
        <div style={styles.inputHint}>Press Enter to send · Shift+Enter for new line</div>
      </div>

      <div style={styles.footer}>{BRAND.sub} · All pieces handcrafted to order</div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isAssistant = msg.role === "assistant";
  const text = cleanMessage(msg.content);
  return (
    <div style={{ ...styles.bubbleRow, justifyContent: isAssistant ? "flex-start" : "flex-end" }}>
      {isAssistant && <div style={styles.avatarDot}>D</div>}
      <div style={{
        ...styles.bubble,
        ...(isAssistant ? styles.bubbleAssistant : styles.bubbleUser),
      }}>
        {text.split("\n").map((line, i) => (
          <p key={i} style={styles.bubbleLine}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ ...styles.bubbleRow, justifyContent: "flex-start" }}>
      <div style={styles.avatarDot}>D</div>
      <div style={{ ...styles.bubble, ...styles.bubbleAssistant, ...styles.typingBubble }}>
        <span style={styles.dot1} />
        <span style={styles.dot2} />
        <span style={styles.dot3} />
      </div>
    </div>
  );
}

function QuoteCard({ lead }) {
  return (
    <div style={styles.quoteCard}>
      <div style={styles.quoteHeader}>
        <div style={styles.quoteLabel}>ROUGH ESTIMATE</div>
        <div style={styles.quoteEstimate}>{lead.estimate}</div>
      </div>
      <div style={styles.quoteDivider} />
      <div style={styles.quoteGrid}>
        {lead.pieceType && <QuoteRow label="Piece" value={lead.pieceType} />}
        {lead.material && <QuoteRow label="Material" value={lead.material} />}
        {lead.dimensions && <QuoteRow label="Dimensions" value={lead.dimensions} />}
        {lead.timeline && <QuoteRow label="Timeline" value={lead.timeline} />}
      </div>
      <div style={styles.quoteDivider} />
      <div style={styles.quoteFooter}>
        ✦ A craftsman will follow up within 24 hours to discuss your piece in detail.
      </div>
    </div>
  );
}

function QuoteRow({ label, value }) {
  return (
    <div style={styles.quoteRow}>
      <span style={styles.quoteRowLabel}>{label}</span>
      <span style={styles.quoteRowValue}>{value}</span>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

const BRASS = "#C9A84C";
const DARK = "#0F0D0B";
const SURFACE = "#1A1713";
const SURFACE2 = "#221F1A";
const SURFACE3 = "#2C2820";
const TEXT = "#F0EAE0";
const TEXT_DIM = "#8C8070";
const TEXT_MUTED = "#5A5040";

const styles = {
  root: {
    minHeight: "100vh",
    background: DARK,
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    color: TEXT,
    position: "relative",
    overflow: "hidden",
  },
  grain: {
    position: "fixed",
    inset: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
    pointerEvents: "none",
    zIndex: 0,
    opacity: 0.6,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    padding: "28px 24px 20px",
    position: "relative",
    zIndex: 1,
  },
  logoMark: { color: BRASS, fontSize: "18px", opacity: 0.7 },
  brandBlock: { textAlign: "center" },
  brandName: {
    fontSize: "22px",
    fontWeight: "normal",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: TEXT,
    lineHeight: 1.2,
  },
  brandTagline: {
    fontSize: "11px",
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    color: BRASS,
    marginTop: "4px",
    fontStyle: "italic",
  },
  dividerLine: {
    height: "1px",
    background: `linear-gradient(to right, transparent, ${BRASS}44, ${BRASS}88, ${BRASS}44, transparent)`,
    margin: "0 40px",
    position: "relative",
    zIndex: 1,
  },
  chatOuter: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 16px",
    position: "relative",
    zIndex: 1,
  },
  chatInner: {
    maxWidth: "680px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  bubbleRow: { display: "flex", alignItems: "flex-end", gap: "10px" },
  avatarDot: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${BRASS} 0%, #8B6914 100%)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "bold",
    color: DARK,
    flexShrink: 0,
    letterSpacing: "0.05em",
  },
  bubble: {
    maxWidth: "78%",
    padding: "14px 18px",
    borderRadius: "2px",
    lineHeight: 1.7,
    fontSize: "15px",
  },
  bubbleAssistant: {
    background: SURFACE2,
    border: `1px solid ${SURFACE3}`,
    borderLeft: `2px solid ${BRASS}66`,
    color: TEXT,
  },
  bubbleUser: {
    background: SURFACE3,
    border: `1px solid #3A3328`,
    color: TEXT,
    borderRadius: "2px",
  },
  bubbleLine: { margin: "0 0 6px 0" },
  typingBubble: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "16px 18px",
    minWidth: "60px",
  },
  dot1: { width: "6px", height: "6px", borderRadius: "50%", background: BRASS, opacity: 0.4 },
  dot2: { width: "6px", height: "6px", borderRadius: "50%", background: BRASS, opacity: 0.4 },
  dot3: { width: "6px", height: "6px", borderRadius: "50%", background: BRASS, opacity: 0.4 },
  inputBar: {
    padding: "16px 16px 8px",
    background: SURFACE,
    borderTop: `1px solid ${SURFACE3}`,
    position: "relative",
    zIndex: 1,
  },
  inputWrapper: {
    maxWidth: "680px",
    margin: "0 auto",
    display: "flex",
    alignItems: "flex-end",
    gap: "10px",
    background: SURFACE2,
    border: `1px solid ${SURFACE3}`,
    borderRadius: "2px",
    padding: "10px 12px",
  },
  textarea: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: TEXT,
    fontFamily: "Georgia, serif",
    fontSize: "15px",
    resize: "none",
    lineHeight: 1.6,
    minHeight: "24px",
    maxHeight: "120px",
  },
  sendBtn: {
    background: "transparent",
    border: "none",
    color: BRASS,
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.8,
    flexShrink: 0,
  },
  inputHint: {
    maxWidth: "680px",
    margin: "6px auto 0",
    fontSize: "11px",
    color: TEXT_MUTED,
    letterSpacing: "0.08em",
    textAlign: "right",
  },
  footer: {
    textAlign: "center",
    padding: "10px 16px 16px",
    fontSize: "10px",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: TEXT_MUTED,
    position: "relative",
    zIndex: 1,
  },
  quoteCard: {
    background: SURFACE2,
    border: `1px solid ${BRASS}55`,
    borderTop: `2px solid ${BRASS}`,
    padding: "24px 28px",
    marginTop: "8px",
  },
  quoteHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  quoteLabel: {
    fontSize: "10px",
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    color: BRASS,
  },
  quoteEstimate: { fontSize: "22px", color: TEXT, letterSpacing: "0.05em" },
  quoteDivider: { height: "1px", background: `${BRASS}33`, margin: "16px 0" },
  quoteGrid: { display: "flex", flexDirection: "column", gap: "10px" },
  quoteRow: { display: "flex", justifyContent: "space-between", fontSize: "13px" },
  quoteRowLabel: {
    color: TEXT_DIM,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontSize: "11px",
  },
  quoteRowValue: { color: TEXT, textAlign: "right", maxWidth: "60%" },
  quoteFooter: {
    fontSize: "12px",
    color: BRASS,
    letterSpacing: "0.06em",
    fontStyle: "italic",
    textAlign: "center",
  },
};

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 0.2; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.1); }
    }
    textarea::placeholder { color: #5A5040; }
    textarea:focus { outline: none; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: #0F0D0B; }
    ::-webkit-scrollbar-thumb { background: #3A3328; border-radius: 2px; }
  `;
  document.head.appendChild(style);
}
