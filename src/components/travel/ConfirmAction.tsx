"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface Confirmation {
  title: string;
  description: string;
  action: string;
}

export function useConfirmation() {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const confirm = useCallback(
    (next: Confirmation) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setRequest(next);
      }),
    [],
  );
  const resolve = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setRequest(null);
  }, []);
  useEffect(() => () => resolver.current?.(false), []);
  return { request, confirm, resolve };
}

export default function ConfirmAction({
  request,
  onResolve,
}: {
  request: Confirmation | null;
  onResolve: (confirmed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (!request) return;
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus({ preventScroll: true });
    };
  }, [request]);
  if (!request) return null;
  return createPortal(
    <dialog
      ref={dialog}
      className="manager-confirm"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        onResolve(false);
      }}
    >
      <p className="eyebrow">操作确认</p>
      <h2 id={`${id}-title`}>{request.title}</h2>
      <p id={`${id}-description`}>{request.description}</p>
      <div>
        <button onClick={() => onResolve(false)}>取消</button>
        <button className="travel-button" onClick={() => onResolve(true)}>
          {request.action}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
