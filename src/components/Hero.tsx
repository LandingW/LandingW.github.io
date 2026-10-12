import { profile } from "@/lib/resume";
import TeapotStudy from "./TeapotStudy";
import GrowingFractal from "./GrowingFractal";
import FractalMark from "./FractalMark";
import { Arrow } from "./Icons";
import { headlineTiming } from "@/lib/motion";
import type { CSSProperties } from "react";

function letters(text: string, offset = 0) {
  return [...text].map((letter, index) => {
    const timing = headlineTiming(index + offset);
    return letter === " " ? (
      <span key={index} className="hero-space">
        {" "}
      </span>
    ) : (
      <span
        key={index}
        className={`hero-letter ignition-${timing.pattern}`}
        style={
          {
            "--ignition-delay": `${timing.delay}ms`,
            "--ignition-duration": `${timing.duration}ms`,
          } as CSSProperties
        }
      >
        {letter}
      </span>
    );
  });
}

export default function Hero() {
  return (
    <section id="home" className="hero">
      <GrowingFractal />
      <div className="hero-topline mono">
        <span>GRAPHICS ENGINEER & ENGINE DEVELOPER</span>
        <span>A PERSONAL COLLECTION</span>
      </div>
      <div className="hero-stage">
        <div className="hero-copy">
          <p className="hero-author">
            {profile.nameReal}
            <span> / {profile.name}</span>
          </p>
          <h1 className="hero-title" aria-label="THINK IN PIXELS.">
            <span aria-hidden="true">{letters("Think in")}</span>
            <span className="title-second" aria-hidden="true">
              {letters("pixels", 8)}
              <span className="accent">.</span>
            </span>
          </h1>
          <p className="hero-lead">于细微处，构建真实。</p>
          <div className="hero-bio">
            <p>
              一名图形程序。探索实时渲染、GPU
              编程与引擎系统，也记录光线、风景和旅途中的片刻。
            </p>
            <div className="hero-actions">
              <a href="#experience">
                工作与经历 <Arrow diagonal />
              </a>
              <a href="#articles">
                阅读文章 <Arrow />
              </a>
            </div>
          </div>
        </div>
        <div className="hero-exhibit">
          <div className="hero-exhibit-top mono">
            <span>01 / FORM STUDY</span>
            <FractalMark depth={2} />
          </div>
          <TeapotStudy />
          <div className="hero-exhibit-note">
            <span>曲面之间，光线成形。</span>
            <span className="mono">BÉZIER / LIGHT / MATERIAL</span>
          </div>
        </div>
      </div>
      <div className="hero-footer">
        <a className="current-strip" href="#experience">
          <span className="mono">
            <span className="status-dot" /> CURRENTLY
          </span>
          <span className="current-strip-company">
            Varsapura<span>米哈游 · 图形程序</span>
          </span>
          <Arrow diagonal />
        </a>
        <div className="hero-social">
          <span className="hero-social-label">在别处找到我</span>
          <a href={profile.github} target="_blank" rel="noopener noreferrer">
            GitHub <Arrow diagonal />
          </a>
          <a href={profile.zhihu} target="_blank" rel="noopener noreferrer">
            知乎 <Arrow diagonal />
          </a>
        </div>
      </div>
    </section>
  );
}
