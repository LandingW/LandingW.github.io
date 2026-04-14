import { profile, education } from "@/lib/resume";
import TypewriterTitle from "./TypewriterTitle";
import FadeUp from "./FadeUp";

export default function Hero() {
  return (
    <section id="home" className="section" style={{ paddingTop: 80, paddingBottom: 0 }}>

      {/* ① Status badge — immediate, delay 0 */}
      <FadeUp immediate delay={0}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 12px",
            borderRadius: 20,
            background: "rgba(52,211,153,0.08)",
            border: "1px solid rgba(52,211,153,0.2)",
            marginBottom: 20,
          }}
        >
          <span className="status-dot" />
          <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--green)" }}>
            在职 · 米哈游 Varsapura
          </span>
        </div>
      </FadeUp>

      {/* ② Typewriter title — immediate, delay 120 */}
      <FadeUp immediate delay={120}>
        <TypewriterTitle />
      </FadeUp>

      {/* ③ Role / subtitle — immediate, delay 240 */}
      <FadeUp immediate delay={240}>
        <p
          style={{
            fontSize: "clamp(0.9rem, 1.8vw, 1.05rem)",
            color: "var(--text-2)",
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          游戏引擎开发 · 图形渲染工程师 · 1 年+ GI 研发经验
        </p>
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 13,
            color: "var(--text-3)",
            marginBottom: 36,
            letterSpacing: "0.04em",
          }}
        >
          UE5 &nbsp;·&nbsp; Global Illumination &nbsp;·&nbsp; SparseRT &nbsp;·&nbsp; Ray Tracing
        </p>
      </FadeUp>

      {/* ④ Contacts — immediate, delay 360 */}
      <FadeUp immediate delay={360}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 44 }}>
          <a href={`mailto:${profile.email}`} className="contact-link">
            <MailIcon />
            {profile.email}
          </a>
          <a href={profile.zhihu} target="_blank" rel="noopener noreferrer" className="contact-link">
            <ZhihuIcon />
            知乎
          </a>
          <a href={profile.github} target="_blank" rel="noopener noreferrer" className="contact-link">
            <GithubIcon />
            GitHub
          </a>
        </div>
      </FadeUp>

      {/* ⑤ Education card — immediate, delay 480 */}
      <FadeUp immediate delay={480}>
        <div
          className="glass-card"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 20px",
            marginBottom: 80,
          }}
        >
          <span style={{ fontSize: 22 }}>🎓</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
                {education[0].school}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--accent)",
                  background: "var(--accent-dim)",
                  border: "1px solid rgba(96,165,250,0.2)",
                  borderRadius: 4,
                  padding: "2px 8px",
                }}
              >
                {education[0].badge}
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--text-3)",
                marginTop: 3,
              }}
            >
              {education[0].degree} &nbsp;·&nbsp; {education[0].period}
            </div>
          </div>
        </div>
      </FadeUp>
    </section>
  );
}

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 8l10 6 10-6" />
    </svg>
  );
}

function ZhihuIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.721 0C2.562 0 0 2.562 0 5.721v12.558C0 21.438 2.562 24 5.721 24h12.558C21.438 24 24 21.438 24 18.279V5.721C24 2.562 21.438 0 18.279 0zm1.964 5.109c-.065.363-.145.72-.245 1.073h3.504v1.257h-1.83c-.09.75-.225 1.484-.404 2.195h1.805v1.257H8.64c.48.748.974 1.436 1.485 2.05-.285.21-.569.42-.854.63a13.78 13.78 0 0 1-1.605-2.37v5.7H6.41v-5.414c-.57 1.14-1.26 2.175-2.04 3.09-.195-.375-.405-.75-.615-1.11 1.065-1.095 1.965-2.37 2.64-3.576H4.2V9.634h2.21V7.44H4.665V6.182h1.745c-.105-.39-.255-.765-.405-1.073zM15.3 4.5v14.97h-1.215l-.72-1.44s-2.19 1.755-3.885 1.605l.33-1.44s2.94.45 3.855-1.26V11.7h-2.64c.045-.87.06-1.77.045-2.685h2.595V7.05h-2.19c.09-1.05.135-2.055.15-3h1.26c0 .93-.045 1.935-.135 3h.915V4.5z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
