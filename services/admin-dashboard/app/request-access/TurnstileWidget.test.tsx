// services/admin-dashboard/app/request-access/TurnstileWidget.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import TurnstileWidget from "./TurnstileWidget";

function installTurnstile() {
  const api = { render: vi.fn().mockReturnValue("w1"), reset: vi.fn(), remove: vi.fn() };
  window.turnstile = api;
  return api;
}

describe("TurnstileWidget", () => {
  afterEach(() => {
    delete window.turnstile;
  });

  it("renders explicitly with the site key, forwards the token and removes the widget on unmount", async () => {
    const api = installTurnstile();
    const onToken = vi.fn();
    const { unmount } = render(<TurnstileWidget siteKey="k" onToken={onToken} onExpire={vi.fn()} onError={vi.fn()} />);

    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    const options = api.render.mock.calls[0][1];
    expect(options.sitekey).toBe("k");
    expect(options.theme).toBe("light");
    options.callback("tok");
    expect(onToken).toHaveBeenCalledWith("tok");

    unmount();
    expect(api.remove).toHaveBeenCalledWith("w1");
  });

  it("reports an error when the script cannot load", async () => {
    const onError = vi.fn();
    render(<TurnstileWidget siteKey="k" onToken={vi.fn()} onExpire={vi.fn()} onError={onError} />);
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]');
    expect(script?.src).toContain("render=explicit");
    script?.onerror?.(new Event("error"));
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
