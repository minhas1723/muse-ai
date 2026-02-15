import React from "react";
import type { AuthProvider } from "../providers";

interface LoginScreenProps {
  onLogin: (provider: AuthProvider) => void;
  loading: boolean;
  error: string | null;
}

export function LoginScreen({ onLogin, loading, error }: LoginScreenProps) {
  return (
    <div className="h-full flex items-center justify-center p-5">
      <div className="text-center max-w-[300px]">
        <div className="mb-5 animate-float flex items-center justify-center">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="url(#lg1)" opacity="0.9" />
            <path d="M2 17L12 22L22 17" stroke="url(#lg2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="url(#lg2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="lg1" x1="2" y1="2" x2="22" y2="12">
                <stop stopColor="#7c3aed" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
              <linearGradient id="lg2" x1="2" y1="12" x2="22" y2="22">
                <stop stopColor="#7c3aed" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h2 className="text-[22px] font-bold mb-1.5 bg-gradient-to-br from-accent-primary to-accent-secondary bg-clip-text text-transparent">
          Welcome Back
        </h2>
        <p className="text-text-secondary text-[13px] mb-6">
          Choose a provider to sign in and start chatting
        </p>

        {error && (
          <div className="text-[11px] text-red-500 py-1 mb-4 text-center">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Antigravity Card */}
          <button
            onClick={() => onLogin("antigravity")}
            className="group flex items-center gap-3 w-full py-3.5 px-4 text-left bg-gradient-to-br from-purple-600/10 to-violet-600/10 border border-purple-500/20 rounded-xl transition-all hover:border-purple-500/40 hover:shadow-[0_2px_16px_rgba(124,58,237,0.15)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-violet-600 shadow-sm">
              {/* Rocket icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-text-primary group-hover:text-purple-400 transition-colors">
                Antigravity
              </div>
              <div className="text-[11px] text-text-tertiary">
                Claude &amp; Gemini models
              </div>
            </div>
            {loading ? (
              <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary group-hover:text-purple-400 transition-colors">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </button>

          {/* Gemini CLI Card */}
          <button
            onClick={() => onLogin("gemini-cli")}
            className="group flex items-center gap-3 w-full py-3.5 px-4 text-left bg-gradient-to-br from-teal-600/10 to-emerald-600/10 border border-teal-500/20 rounded-xl transition-all hover:border-teal-500/40 hover:shadow-[0_2px_16px_rgba(20,184,166,0.15)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-600 shadow-sm">
              {/* Terminal icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-text-primary group-hover:text-teal-400 transition-colors">
                Gemini CLI
              </div>
              <div className="text-[11px] text-text-tertiary">
                Gemini models only
              </div>
            </div>
            {loading ? (
              <span className="w-4 h-4 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary group-hover:text-teal-400 transition-colors">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-text-tertiary text-[10px] mt-5">
          Both options sign in via your Google account
        </p>
      </div>
    </div>
  );
}
