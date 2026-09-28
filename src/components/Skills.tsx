import { skills } from "@/lib/resume";
import SectionHeading from "./SectionHeading";

export default function Skills() {
  return (
    <section id="skills" className="section">
      <SectionHeading number="02" english="STACK & CRAFT" title="技术栈与专注">
        <p>深入一个问题，也连接不同的领域。</p>
      </SectionHeading>
      <div className="focus-grid">
        {skills.map((skill) => (
          <article className="focus-item" key={skill.number}>
            <div className="focus-top mono">
              <span>{skill.number}</span>
              <span>{skill.english}</span>
            </div>
            <h3>{skill.title}</h3>
            <p>{skill.description}</p>
            <ul>
              {skill.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className="education">
        <span className="eyebrow">ALWAYS LEARNING</span>
        <p>
          华南理工大学 <span>软件工程 · 本科</span>
        </p>
        <span className="mono">2024.09 — 至今</span>
      </div>
    </section>
  );
}
