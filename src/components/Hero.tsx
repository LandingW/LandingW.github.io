import { profile } from "@/lib/resume";
import TeapotStudy from "./TeapotStudy";
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
      <div className="hero-topline mono">
        <span>GRAPHICS PROGRAMMER</span>
        <span>PERSONAL WEBSITE</span>
      </div>
      <div className="hero-stage">
        <div className="hero-copy">
          <p className="hero-author">你好，我是</p>
          <h1
            className="hero-title"
            aria-label={`${profile.nameReal} / ${profile.name}`}
          >
            <span aria-hidden="true">{letters(profile.nameReal)}</span>
            <span className="title-second" aria-hidden="true">
              {letters(profile.name, [...profile.nameReal].length)}
              <span className="accent">.</span>
            </span>
          </h1>
          <p className="hero-lead">在米哈游做图形开发。</p>
          <div className="hero-bio">
            <p>
              主要写 UE5 渲染相关的代码，最近在做 Nanite Raster 和 PS5
              图形开发。这里放工作经历、技术笔记，还有旅行时拍的照片。
            </p>
            <div className="hero-actions">
              <a href="#experience">
                工作经历 <Arrow diagonal />
              </a>
              <a href="#articles">
                阅读文章 <Arrow />
              </a>
            </div>
          </div>
        </div>
        <div className="hero-exhibit">
          <div className="hero-exhibit-top mono">
            <span>01 / BÉZIER SURFACE</span>
            <FractalMark depth={2} />
          </div>
          <TeapotStudy />
          <div className="hero-exhibit-note">
            <span>Bézier 曲面与材质预览</span>
            <span className="mono">WEBGL</span>
          </div>
        </div>
      </div>
      <div className="hero-footer">
        <a className="current-strip" href="#experience">
          <span className="mono">
            <span className="status-dot" /> 目前
          </span>
          <span className="current-strip-company">
            Varsapura<span>米哈游 · 图形程序</span>
          </span>
          <Arrow diagonal />
        </a>
        <div className="hero-social">
          <span className="hero-social-label">其他主页</span>
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
