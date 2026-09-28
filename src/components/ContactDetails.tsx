"use client";

import { useEffect, useRef, useState } from "react";

export default function ContactDetails({
  qq,
  wechat,
}: {
  qq: string;
  wechat: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy(label: string, value: string) {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setMessage(`${label}号码已复制`);
      timer.current = setTimeout(() => {
        setCopied(null);
        setMessage("");
      }, 2400);
    } catch {
      setCopied(null);
      setMessage("无法自动复制，请选中号码手动复制。");
    }
  }

  return (
    <div className="contact-details">
      <dl>
        {[
          { label: "QQ", value: qq },
          { label: "微信", value: wechat },
        ].map(({ label, value }) => (
          <div className="contact-handle" key={label}>
            <dt>{label}</dt>
            <dd>
              <span>{value}</span>
              <button
                type="button"
                aria-label={`复制${label}号码`}
                onClick={() => void copy(label, value)}
              >
                {copied === label ? "已复制" : "复制"}
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <p className="contact-copy-status" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
