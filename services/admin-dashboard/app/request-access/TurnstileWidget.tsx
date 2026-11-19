// services/admin-dashboard/app/request-access/TurnstileWidget.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing")));
    script.onerror = () => {
      scriptPromise = null; // let a remount retry
      script.remove();
      reject(new Error("Turnstile script blocked"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type TurnstileWidgetHandle = { reset: () => void };

type Props = {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire: () => void;
  /** Script blocked or the widget errored: the form stops waiting for a token. */
  onError: () => void;
};

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, Props>(function TurnstileWidget(
  { siteKey, onToken, onExpire, onError },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Callbacks live in a ref so a parent re-render never re-renders the widget.
  const handlers = useRef({ onToken, onExpire, onError });
  handlers.current = { onToken, onExpire, onError };

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current !== null) window.turnstile?.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    let active = true;
    loadTurnstile()
      .then((api) => {
        if (!active || !container.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: siteKey,
          callback: (token) => handlers.current.onToken(token),
          "expired-callback": () => handlers.current.onExpire(),
          "error-callback": () => handlers.current.onError(),
        });
      })
      .catch(() => active && handlers.current.onError());
    return () => {
      active = false;
      if (widgetId.current !== null) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  return <div ref={container} data-testid="turnstile-container" className="flex justify-center" />;
});

export default TurnstileWidget;
