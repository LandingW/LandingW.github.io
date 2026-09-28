import { profile } from "@/lib/resume";
import Link from "next/link";
import { Arrow } from "./Icons";
import SplineStudy from "./SplineStudy";
import ContactDetails from "./ContactDetails";

export default function Footer() {
  return (
    <footer id="contact" className="site-footer">
      <div className="footer-top">
        <span className="mono">04 / KEEP IN TOUCH</span>
        <span>有趣的想法，值得一次交流。</span>
      </div>
      <div className="footer-contact">
        <div>
          <h2>
            LET’S
            <br />
            BUILD<span>.</span>
          </h2>
          <a href={`mailto:${profile.email}`} className="contact-email">
            {profile.email}
            <Arrow diagonal />
          </a>
          <ContactDetails qq={profile.qq} wechat={profile.wechat} />
        </div>
        <SplineStudy />
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Land1ngW</span>
        <span className="footer-note">FORM. LIGHT. CODE.</span>
        <div>
          <a href="/feed.xml">
            RSS <Arrow diagonal />
          </a>
          <a href={profile.github} target="_blank" rel="noopener noreferrer">
            GitHub <Arrow diagonal />
          </a>
          <Link href="/#home">回到顶部 ↑</Link>
        </div>
      </div>
    </footer>
  );
}
