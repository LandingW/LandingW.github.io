import { experiences } from "@/lib/resume";
import Image from "next/image";
import SectionHeading from "./SectionHeading";

export default function Experience() {
  return (
    <section id="experience" className="section editorial-section">
      <SectionHeading number="01" english="Selected work" title="工作与经历">
        <p>
          从理解光，到构建世界。
          <br />
          在真实的问题中，不断深入。
        </p>
      </SectionHeading>
      <div className="experience-list">
        {experiences.map((item, index) => (
          <article
            key={item.department}
            className={`experience ${item.current ? "experience-current" : ""}`}
            data-reveal
          >
            <div className="experience-time">
              <span className="mono">{item.period}</span>
              {item.current && (
                <span className="current-badge">
                  <span className="status-dot" /> 现在
                </span>
              )}
              <span className="experience-index mono">
                /{String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="experience-body">
              <div className="experience-company">
                <div className="company-logo">
                  <Image
                    src={item.logo.src}
                    width={item.logo.width}
                    height={item.logo.height}
                    alt={`${item.company}标识`}
                  />
                </div>
                <div className="company-heading">
                  <p className="company-name">{item.company}</p>
                  <h3>{item.department}</h3>
                  <p className="experience-role">{item.role}</p>
                </div>
              </div>
              <h4>{item.summary}</h4>
              <p className="experience-description">{item.description}</p>
              <div className="tags">
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              {item.highlights.length > 0 && (
                <details className="work-detail" open={item.current}>
                  <summary>
                    <span>技术职责与实践</span>
                    <span className="work-detail-count">
                      {item.highlights.length} 个方向
                    </span>
                    <span className="work-detail-toggle" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <div className="work-highlights">
                    {item.highlights.map((highlight, index) => (
                      <div
                        key={highlight.title}
                        data-reveal
                        data-reveal-index={index % 2}
                      >
                        <h5>{highlight.title}</h5>
                        <p>{highlight.desc}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {item.current && (
                <p className="disclosure-note">
                  以上为公开技术方向，不涉及项目内部实现与性能数据。
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
