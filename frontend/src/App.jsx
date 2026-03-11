import { useState, useEffect, useRef } from "react";

const WORDS = [
  "linux", "packet", "shadow", "terminal", "kernel", "cipher",
  "socket", "binary", "daemon", "router", "firewall", "exploit",
  "shellcode", "buffer", "pointer", "syscall", "entropy", "vector",
  "payload", "netmask", "subnet", "protocol", "stackframe", "rootkit"
];

// ── Encoding helpers ──────────────────────────────────────────────────────────
const toBase64 = (str) => btoa(unescape(encodeURIComponent(str)));
const toBase32 = (str) => {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, out = "";
  for (let i = 0; i < str.length; i++) {
    value = (value << 8) | str.charCodeAt(i);
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += "=";
  return out;
};
const toHex = (str) => Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
const toBinary = (str) => Array.from(str).map(c => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");

const ENCODERS = {
  base64: { fn: toBase64, label: "Base64" },
  base32: { fn: toBase32, label: "Base32" },
  hex:    { fn: toHex,    label: "Hex" },
  binary: { fn: toBinary, label: "Binary" },
};

const LEVEL_CONFIG = {
  easy:   { layers: 1, label: "EASY",   color: "#00ff88" },
  medium: { layers: 3, label: "MEDIUM", color: "#ffcc00" },
  hard:   { layers: 5, label: "HARD",   color: "#ff4444" },
};

function generateChallenge(level) {
  const cfg = LEVEL_CONFIG[level];
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const flag = `dzul{${word}}`;
  const encodingKeys = Object.keys(ENCODERS);
  const layers = [];
  for (let i = 0; i < cfg.layers; i++) {
    layers.push(encodingKeys[Math.floor(Math.random() * encodingKeys.length)]);
  }
  let encoded = flag;
  for (const key of layers) {
    encoded = ENCODERS[key].fn(encoded);
  }
  return { flag, encoded, layers };
}

// ── Hint generator via Claude API ────────────────────────────────────────────
async function fetchHint(encodedText, attemptCount) {

const res = await fetch("https://decode-backend-production.up.railway.app/api/hint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ encodedText, attemptCount }),
});
  const data = await res.json();
  return data.hint || "Look carefully at the character set and structure.";
}

// ── Glitch text component ─────────────────────────────────────────────────────
function GlitchText({ text, className = "" }) {
  return (
    <span className={`glitch ${className}`} data-text={text} style={{ position: "relative" }}>
      {text}
    </span>
  );
}

// ── Typing effect ─────────────────────────────────────────────────────────────
function TypeWriter({ text, speed = 30, onDone }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const iv = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) { clearInterval(iv); onDone?.(); }
    }, speed);
    return () => clearInterval(iv);
  }, [text]);
  return <span>{displayed}<span className="cursor">█</span></span>;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Decode() {
  const [screen, setScreen] = useState("home"); // home | game | result
  const [level, setLevel] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null); // correct | wrong
  const [hint, setHint] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [showLayers, setShowLayers] = useState(false);
  const [termLines, setTermLines] = useState([]);
  const [typed, setTyped] = useState(false);
  const inputRef = useRef();

  const startGame = (lvl) => {
    const ch = generateChallenge(lvl);
    setLevel(lvl);
    setChallenge(ch);
    setInput("");
    setResult(null);
    setHint("");
    setHintCount(0);
    setAttempts(0);
    setShowLayers(false);
    setTyped(false);
    setTermLines([
      `> DECODE v1.0 — CTF Training Platform`,
      `> Level: ${LEVEL_CONFIG[lvl].label} | Layers: ${LEVEL_CONFIG[lvl].layers}`,
      `> Challenge generated. Good luck, hacker.`,
      `> ----------------------------------------`,
    ]);
    setScreen("game");
  };

  const submitFlag = () => {
    if (!input.trim()) return;
    setAttempts(a => a + 1);
    const correct = input.trim() === challenge.flag;
    setResult(correct ? "correct" : "wrong");
    setTermLines(l => [...l, `> $ submit "${input.trim()}"`, correct ? `> ✓ FLAG ACCEPTED` : `> ✗ WRONG FLAG — try again`]);
    if (correct) setScreen("result");
  };

  const getHint = async () => {
    if (hintLoading) return;
    setHintLoading(true);
    setHint("");
    const h = await fetchHint(challenge.encoded, hintCount + 1);
    setHintCount(c => c + 1);
    setHint(h);
    setTermLines(l => [...l, `> $ hint --request`, `> AI: ${h}`]);
    setHintLoading(false);
  };

  const copyChallenge = () => {
    navigator.clipboard.writeText(challenge.encoded);
    setTermLines(l => [...l, `> Copied to clipboard.`]);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #030a06;
          --surface: #060f08;
          --border: #0d2a12;
          --green: #00ff88;
          --green-dim: #00ff8844;
          --green-mid: #00cc66;
          --yellow: #ffcc00;
          --red: #ff4444;
          --text: #a8ffc4;
          --text-dim: #4a7a5a;
          --font-mono: 'Share Tech Mono', monospace;
          --font-display: 'Orbitron', monospace;
        }

        body { background: var(--bg); color: var(--text); font-family: var(--font-mono); }

        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          overflow: hidden;
        }

        /* scanlines */
        .app::before {
          content: '';
          position: fixed; inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px);
          pointer-events: none; z-index: 999;
        }

        /* grid bg */
        .app::after {
          content: '';
          position: fixed; inset: 0;
          background-image: linear-gradient(var(--border) 1px, transparent 1px),
                            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none; opacity: 0.4;
        }

        .container { width: 100%; max-width: 720px; margin: 0 auto; position: relative; z-index: 1; }

        /* ── HOME ── */
        .logo {
          font-family: var(--font-display);
          font-size: clamp(3rem, 10vw, 6rem);
          font-weight: 900;
          color: var(--green);
          letter-spacing: 0.15em;
          line-height: 1;
          text-shadow: 0 0 40px var(--green), 0 0 80px var(--green-dim);
          animation: pulse 3s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { text-shadow: 0 0 40px var(--green), 0 0 80px var(--green-dim); }
          50% { text-shadow: 0 0 60px var(--green), 0 0 120px var(--green-dim), 0 0 200px var(--green-dim); }
        }

        .glitch { display: inline-block; }
        .glitch::before, .glitch::after {
          content: attr(data-text);
          position: absolute; top: 0; left: 0;
          clip-path: polygon(0 0, 100% 0, 100% 35%, 0 35%);
        }
        .glitch::before {
          color: #ff0055;
          transform: translate(-2px, 0);
          animation: glitch1 4s infinite;
          opacity: 0.7;
        }
        .glitch::after {
          color: #00ffff;
          transform: translate(2px, 0);
          animation: glitch2 4s infinite;
          opacity: 0.7;
        }
        @keyframes glitch1 {
          0%, 85%, 100% { transform: translate(0); clip-path: none; opacity: 0; }
          86% { transform: translate(-3px, 1px); clip-path: polygon(0 20%, 100% 20%, 100% 50%, 0 50%); opacity: 0.7; }
          88% { transform: translate(3px, -1px); opacity: 0.7; }
          90% { transform: translate(0); opacity: 0; }
        }
        @keyframes glitch2 {
          0%, 88%, 100% { transform: translate(0); clip-path: none; opacity: 0; }
          89% { transform: translate(3px, -2px); clip-path: polygon(0 55%, 100% 55%, 100% 80%, 0 80%); opacity: 0.7; }
          91% { transform: translate(-3px, 2px); opacity: 0.7; }
          93% { transform: translate(0); opacity: 0; }
        }

        .tagline {
          color: var(--text-dim);
          font-size: 0.85rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-top: 8px;
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 0.7rem;
          letter-spacing: 0.3em;
          color: var(--text-dim);
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .level-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 8px;
        }

        .level-btn {
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          padding: 20px 12px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        .level-btn::before {
          content: '';
          position: absolute; inset: 0;
          background: var(--level-color, var(--green));
          opacity: 0;
          transition: opacity 0.2s;
        }
        .level-btn:hover::before { opacity: 0.08; }
        .level-btn:hover {
          border-color: var(--level-color, var(--green));
          box-shadow: 0 0 20px var(--level-color, var(--green-dim));
          color: var(--level-color, var(--green));
        }

        .level-layers {
          display: block;
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 400;
          letter-spacing: 0.1em;
          margin-top: 6px;
          opacity: 0.5;
        }

        .info-box {
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 3px solid var(--green);
          padding: 16px;
          font-size: 0.78rem;
          line-height: 1.7;
          color: var(--text-dim);
          margin-top: 8px;
        }
        .info-box span { color: var(--green); }

        /* ── GAME ── */
        .panel {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 20px;
          margin-bottom: 12px;
        }
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .badge {
          font-family: var(--font-display);
          font-size: 0.6rem;
          letter-spacing: 0.2em;
          padding: 4px 10px;
          border: 1px solid currentColor;
        }

        .challenge-box {
          background: #000;
          border: 1px solid #0a2010;
          padding: 16px;
          font-size: 0.8rem;
          word-break: break-all;
          line-height: 1.8;
          color: var(--green);
          max-height: 160px;
          overflow-y: auto;
          position: relative;
        }
        .challenge-box::-webkit-scrollbar { width: 4px; }
        .challenge-box::-webkit-scrollbar-track { background: #000; }
        .challenge-box::-webkit-scrollbar-thumb { background: var(--green-mid); }

        .copy-btn {
          position: absolute; top: 8px; right: 8px;
          background: transparent;
          border: 1px solid var(--text-dim);
          color: var(--text-dim);
          font-family: var(--font-mono);
          font-size: 0.65rem;
          padding: 3px 8px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .copy-btn:hover { border-color: var(--green); color: var(--green); }

        .encoding-list {
          display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;
        }
        .enc-tag {
          font-size: 0.65rem;
          padding: 3px 10px;
          border: 1px solid var(--border);
          color: var(--text-dim);
          letter-spacing: 0.15em;
        }

        .flag-input {
          width: 100%;
          background: #000;
          border: 1px solid var(--border);
          border-bottom: 2px solid var(--green);
          color: var(--green);
          font-family: var(--font-mono);
          font-size: 0.9rem;
          padding: 12px 16px;
          outline: none;
          transition: border-color 0.2s;
          letter-spacing: 0.05em;
        }
        .flag-input:focus { border-color: var(--green); box-shadow: 0 0 20px var(--green-dim); }
        .flag-input::placeholder { color: var(--text-dim); opacity: 0.5; }
        .flag-input.wrong { border-bottom-color: var(--red); animation: shake 0.3s; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }

        .btn-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

        .btn {
          font-family: var(--font-display);
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          padding: 10px 20px;
          border: 1px solid;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          flex: 1;
          min-width: 100px;
        }
        .btn-primary {
          border-color: var(--green);
          color: var(--green);
        }
        .btn-primary:hover {
          background: var(--green);
          color: #000;
          box-shadow: 0 0 30px var(--green-dim);
        }
        .btn-secondary {
          border-color: var(--border);
          color: var(--text-dim);
        }
        .btn-secondary:hover { border-color: var(--yellow); color: var(--yellow); }
        .btn-danger {
          border-color: var(--border);
          color: var(--text-dim);
        }
        .btn-danger:hover { border-color: var(--red); color: var(--red); }

        .hint-box {
          background: #0a1a0e;
          border: 1px solid #0d3318;
          border-left: 3px solid var(--yellow);
          padding: 12px 16px;
          font-size: 0.8rem;
          line-height: 1.6;
          color: #ccaa44;
          margin-top: 10px;
          animation: fadeIn 0.4s;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

        .wrong-msg {
          color: var(--red);
          font-size: 0.75rem;
          margin-top: 8px;
          letter-spacing: 0.1em;
        }

        /* terminal */
        .terminal {
          background: #000;
          border: 1px solid #0a1a0a;
          padding: 12px 16px;
          font-size: 0.72rem;
          color: #3a6a4a;
          max-height: 120px;
          overflow-y: auto;
          line-height: 1.8;
        }
        .terminal::-webkit-scrollbar { width: 3px; }
        .terminal::-webkit-scrollbar-thumb { background: #0d2a12; }

        .cursor {
          display: inline-block;
          width: 8px; height: 1em;
          background: var(--green);
          margin-left: 2px;
          animation: blink 1s step-end infinite;
          vertical-align: text-bottom;
        }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

        /* ── RESULT ── */
        .result-screen {
          text-align: center;
          padding: 40px 20px;
        }
        .result-icon {
          font-size: 4rem;
          margin-bottom: 16px;
          display: block;
          animation: bounceIn 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .result-flag {
          font-size: 1.2rem;
          color: var(--green);
          letter-spacing: 0.1em;
          margin: 16px 0;
          text-shadow: 0 0 20px var(--green);
        }
        .result-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 20px 0;
        }
        .stat-box {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 12px;
        }
        .stat-val {
          font-family: var(--font-display);
          font-size: 1.5rem;
          color: var(--green);
        }
        .stat-label { font-size: 0.65rem; color: var(--text-dim); margin-top: 4px; letter-spacing: 0.1em; }

        .divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }

        .mt-1 { margin-top: 4px; }
        .mt-2 { margin-top: 8px; }
        .mt-3 { margin-top: 16px; }
        .mb-3 { margin-bottom: 16px; }

        .flex-between { display: flex; align-items: center; justify-content: space-between; }
        .text-dim { color: var(--text-dim); font-size: 0.75rem; }
        .text-green { color: var(--green); }
        .text-small { font-size: 0.7rem; }

        @media (max-width: 480px) {
          .level-grid { grid-template-columns: 1fr; }
          .result-stats { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      <div className="app">
        <div className="container">

          {/* ── HOME ── */}
          {screen === "home" && (
            <>
              <div className="mb-3">
                <div className="logo"><GlitchText text="DECODE" /></div>
                <div className="tagline">// CTF Encoding Training Platform</div>
              </div>

              <hr className="divider" />

              <div className="mb-3">
                <div className="section-title">// select_difficulty</div>
                <div className="level-grid">
                  {Object.entries(LEVEL_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      className="level-btn"
                      style={{ "--level-color": cfg.color }}
                      onClick={() => startGame(key)}
                    >
                      {cfg.label}
                      <span className="level-layers">{cfg.layers} layer{cfg.layers > 1 ? "s" : ""}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="info-box">
                <span>Encode methods:</span> base64 · base32 · hex · binary<br />
                <span>Flag format:</span> <code>dzul&#123;something_here&#125;</code><br />
                <span>Goal:</span> Decode the challenge string to find the hidden flag.<br />
                <span>Tip:</span> Use your terminal, Python, or any online decoder tool.
              </div>
            </>
          )}

          {/* ── GAME ── */}
          {screen === "game" && challenge && (
            <>
              <div className="flex-between mb-3">
                <div className="logo" style={{ fontSize: "1.8rem" }}>DECODE</div>
                <div className="flex-between" style={{ gap: 8 }}>
                  <span className="badge" style={{ color: LEVEL_CONFIG[level].color, borderColor: LEVEL_CONFIG[level].color }}>
                    {LEVEL_CONFIG[level].label}
                  </span>
                  <button className="btn btn-danger" style={{ flex: "none", padding: "6px 12px" }} onClick={() => setScreen("home")}>
                    EXIT
                  </button>
                </div>
              </div>

              {/* Challenge */}
              <div className="panel">
                <div className="panel-header">
                  <div className="section-title" style={{ margin: 0 }}>// encoded_challenge</div>
                  <span className="text-dim text-small">{LEVEL_CONFIG[level].layers} layer{LEVEL_CONFIG[level].layers > 1 ? "s" : ""} deep</span>
                </div>
                <div className="challenge-box" style={{ position: "relative" }}>
                  {typed
                    ? challenge.encoded
                    : <TypeWriter text={challenge.encoded} speed={10} onDone={() => setTyped(true)} />
                  }
                  <button className="copy-btn" onClick={copyChallenge}>COPY</button>
                </div>

                <div className="encoding-list">
                  <span className="enc-tag">base64</span>
                  <span className="enc-tag">base32</span>
                  <span className="enc-tag">hex</span>
                  <span className="enc-tag">binary</span>
                </div>

                {showLayers && (
                  <div className="hint-box mt-2" style={{ borderLeftColor: "#ff8844", color: "#cc6622" }}>
                    ⚠ Spoiler — Encoding layers (reversed): {[...challenge.layers].reverse().map(l => ENCODERS[l].label).join(" → ")}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="panel">
                <div className="section-title">// submit_flag</div>
                <input
                  ref={inputRef}
                  className={`flag-input${result === "wrong" ? " wrong" : ""}`}
                  placeholder="dzul{your_answer_here}"
                  value={input}
                  onChange={e => { setInput(e.target.value); setResult(null); }}
                  onKeyDown={e => e.key === "Enter" && submitFlag()}
                />
                {result === "wrong" && (
                  <div className="wrong-msg">✗ Wrong flag. Keep trying! (Attempt {attempts})</div>
                )}

                <div className="btn-row">
                  <button className="btn btn-primary" onClick={submitFlag}>SUBMIT FLAG</button>
                  <button className="btn btn-secondary" onClick={getHint} disabled={hintLoading}>
                    {hintLoading ? "THINKING..." : `HINT (${hintCount})`}
                  </button>
                  <button className="btn btn-danger" onClick={() => setShowLayers(s => !s)}>
                    {showLayers ? "HIDE" : "REVEAL"}
                  </button>
                </div>

                {hint && (
                  <div className="hint-box">
                    <span style={{ color: "#ffcc00", marginRight: 6 }}>💡 AI Hint:</span>{hint}
                  </div>
                )}
              </div>

              {/* Terminal log */}
              <div className="panel" style={{ padding: "12px" }}>
                <div className="section-title" style={{ marginBottom: 8 }}>// terminal_log</div>
                <div className="terminal">
                  {termLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                  <span className="cursor" />
                </div>
              </div>
            </>
          )}

          {/* ── RESULT ── */}
          {screen === "result" && challenge && (
            <div className="result-screen">
              <span className="result-icon">🚩</span>
              <div className="logo" style={{ fontSize: "2.5rem" }}>FLAG CAPTURED</div>
              <div className="result-flag">{challenge.flag}</div>

              <div className="result-stats">
                <div className="stat-box">
                  <div className="stat-val">{attempts}</div>
                  <div className="stat-label">ATTEMPTS</div>
                </div>
                <div className="stat-box">
                  <div className="stat-val">{hintCount}</div>
                  <div className="stat-label">HINTS USED</div>
                </div>
                <div className="stat-box">
                  <div className="stat-val" style={{ color: LEVEL_CONFIG[level].color }}>
                    {LEVEL_CONFIG[level].label}
                  </div>
                  <div className="stat-label">DIFFICULTY</div>
                </div>
              </div>

              <div className="info-box" style={{ textAlign: "left" }}>
                <span>Encoding chain used:</span><br />
                {challenge.layers.map((l, i) => (
                  <span key={i}>
                    {i === 0 ? "  Original flag" : `  ${ENCODERS[challenge.layers[i - 1]].label} output`}
                    {" → "}<span>{ENCODERS[l].label}</span>
                    {i === challenge.layers.length - 1 ? " → Challenge shown" : ""}<br />
                  </span>
                ))}
              </div>

              <hr className="divider" />

              <div className="btn-row" style={{ justifyContent: "center" }}>
                <button className="btn btn-primary" onClick={() => startGame(level)}>PLAY AGAIN</button>
                <button className="btn btn-secondary" onClick={() => setScreen("home")}>CHANGE LEVEL</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
