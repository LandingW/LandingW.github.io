import { skills } from "@/lib/resume";
import SectionHeading from "./SectionHeading";

export default function Skills() {
  return (
    <section id="skills" className="section editorial-section">
      <SectionHeading number="02" english="Skills" title="技术栈">
        <p>平时用到的技术，以及正在学的东西。</p>
      </SectionHeading>
      <div className="focus-content">
        <div className="focus-grid">
          {skills.map((skill, index) => (
            <article
              className="focus-item"
              key={skill.number}
              data-reveal
              data-reveal-index={index}
            >
              <div className="focus-intro">
                <div className="focus-top mono">
                  <span>{skill.number}</span>
                  <span>{skill.english}</span>
                </div>
                <h3>{skill.title}</h3>
                <p>{skill.description}</p>
              </div>
              <ul>
                {skill.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="education" data-reveal>
          <span className="eyebrow">教育经历</span>
          <p>
            华南理工大学 <span>软件工程 · 本科</span>
          </p>
          <span className="mono">2024.09 — 至今</span>
        </div>
      </div>
    </section>
  );
}
