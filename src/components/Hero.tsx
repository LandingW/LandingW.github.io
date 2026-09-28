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
        <span>GRAPHICS ENGINEER / ENGINE DEVELOPER</span>
        <span>FORM / LIGHT / CODE</span>
      </div>
      <div className="hero-stage">
        <h1 className="hero-title" aria-label="THINK IN PIXELS.">
          <span aria-hidden="true">{letters("THINK IN")}</span>
          <span className="title-second" aria-hidden="true">
            {letters("PIXELS", 8)}
            <span className="accent">.</span>
          </span>
        </h1>
        <TeapotStudy />
      </div>
      <div className="hero-introduction">
        <div className="hero-signature">
          <FractalMark />
          <span className="mono">
            A LITTLE RECURSION.
            <br />A LOT OF CURIOSITY.
          </span>
        </div>
        <h2>
          于细微处，
          <br />
          构建真实。
        </h2>
        <div className="hero-bio">
          <p>
            我是 <strong>{profile.nameReal}</strong> / {profile.name}。<br />
            一名图形程序，探索实时渲染、GPU 编程
            <br className="desktop-break" />
            与引擎系统的边界。
          </p>
          <div className="hero-social">
            <a href={profile.github} target="_blank" rel="noopener noreferrer">
              GitHub <Arrow diagonal />
            </a>
            <a href={profile.zhihu} target="_blank" rel="noopener noreferrer">
              知乎 <Arrow diagonal />
            </a>
          </div>
        </div>
      </div>
      <a className="current-strip" href="#experience">
        <span className="mono">01 / CURRENTLY</span>
        <span className="current-strip-company">
          Varsapura<span>米哈游 · 图形程序</span>
        </span>
        <span className="current-strip-stack">
          NANITE RASTER / GPU PROGRAMMING
          <br />
          PS5 GRAPHICS / AMD RDNA
        </span>
        <Arrow diagonal />
      </a>
      <div className="hero-bottom">
        <span>独立思考。持续构建。</span>
        <a href="#articles" className="mono">
          SELECTED WRITING / 文字记录 <Arrow />
        </a>
      </div>
    </section>
  );
}
