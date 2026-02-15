import React, { useState, useEffect } from "react";
import type { AuthStatus } from "../types";
import type { AuthProvider } from "../providers";
import { getProvider } from "../providers";

interface ManualAuthScreenProps {
  provider: AuthProvider;
  onComplete: (status: AuthStatus) => void;
  onCancel: () => void;
}

export function ManualAuthScreen({
  provider,
  onComplete,
  onCancel,
}: ManualAuthScreenProps) {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = getProvider(provider);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "getAuthUrl", provider }).then((res) => {
      if (res?.url) setAuthUrl(res.url);
    });
  }, [provider]);

  const handleOpenAuth = () => {
    if (authUrl) {
      window.open(authUrl, "_blank");
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: "exchangeCode",
        code: code.trim(),
        provider,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onComplete(result);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-5">
      <div className="text-center max-w-[340px]">
        <h2 className="text-[22px] font-bold mb-1.5 bg-gradient-to-br from-accent-primary to-accent-secondary bg-clip-text text-transparent">
          Manual Sign In
        </h2>
        <p className="text-text-secondary text-[13px] mb-1">
          Signing in via <span className="font-semibold text-text-primary">{config.label}</span>
        </p>
        <p className="text-text-tertiary text-[11px] mb-5">
          The auto-login tab was closed. Complete sign-in manually below.
        </p>

        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border border-border rounded-xl text-text-primary">
            <div className="pl-1 pr-1 font-bold text-[13px]">
              Step 1: Open Google Login
            </div>
            <button
              onClick={handleOpenAuth}
              className="ml-auto px-3 py-1.5 text-[11px] font-semibold text-white bg-gradient-to-br from-accent-primary to-accent-secondary rounded-lg shadow-sm disabled:opacity-50 transition-all hover:shadow-md"
              disabled={!authUrl}
            >
              Open ↗
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-3 text-left">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
                Step 2: Paste the URL or Code
              </label>
              <p className="text-[11px] text-text-tertiary my-0.5 leading-tight">
                After signing in, copy the <strong className="text-text-primary font-semibold">entire URL</strong> from your
                browser's address bar
              </p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={`${config.redirectUri}?code=...`}
                className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-text-primary font-mono text-[11px] outline-none transition-colors focus:border-accent-primary focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)]"
                autoFocus
              />
            </div>

            {error && <p className="text-[11px] text-red-500 py-0.5">{error}</p>}

            <button
              onClick={handleSubmit}
              className="w-full px-4 py-2.5 text-[13px] font-semibold text-white bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl shadow-sm transition-all hover:shadow-md hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !code.trim()}
            >
              {loading ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Sign In"}
            </button>

            <button 
              onClick={onCancel} 
              className="w-full px-3 py-1.5 text-[12px] text-text-secondary bg-transparent hover:bg-bg-hover hover:text-text-primary rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
