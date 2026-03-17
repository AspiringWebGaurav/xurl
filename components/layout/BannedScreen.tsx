"use client";

import { useEffect, useState } from "react";
import { ShieldX, AlertTriangle, Clock, Mail, ArrowLeft, RotateCcw, Info } from "lucide-react";
import Link from "next/link";

interface BannedScreenProps {
    variant: "banned" | "unknown_locked";
    reason?: string | null;
    expiresAt?: number | null;
}

function formatExpiry(ts: number): string {
    const ms = ts - Date.now();
    if (ms <= 0) return "shortly";
    const h = Math.floor(ms / 36e5);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${Math.ceil((ms % 36e5) / 6e4)}m`;
    return `${Math.ceil(ms / 6e4)}m`;
}

function LiveClock({ expiresAt }: { expiresAt: number }) {
    const [val, setVal] = useState(formatExpiry(expiresAt));
    useEffect(() => {
        const id = setInterval(() => setVal(formatExpiry(expiresAt)), 30_000);
        return () => clearInterval(id);
    }, [expiresAt]);
    return <>{val}</>;
}

export function BannedScreen({ variant, reason, expiresAt }: BannedScreenProps) {
    const isBanned = variant === "banned";
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setReady(true), 60);
        return () => clearTimeout(t);
    }, []);

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                /* strict 100vh, no scroll */
                .bs {
                    font-family: 'Geist', system-ui, -apple-system, sans-serif;
                    -webkit-font-smoothing: antialiased;
                    height: 100vh;
                    max-height: 100vh;
                    overflow: hidden;
                    background: #fafafa;
                    display: flex;
                    flex-direction: column;
                    color: #0a0a0a;
                }

                .bs-main {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 0 24px;
                    text-align: center;
                    overflow: hidden;
                }

                /* stagger fade-up */
                .bs-fi {
                    opacity: 0;
                    transform: translateY(12px);
                    transition: opacity .5s cubic-bezier(.16,1,.3,1),
                                transform .5s cubic-bezier(.16,1,.3,1);
                }
                .bs-on .bs-fi { opacity: 1; transform: none; }
                .bs-on .bs-fi:nth-child(1) { transition-delay: .04s; }
                .bs-on .bs-fi:nth-child(2) { transition-delay: .11s; }
                .bs-on .bs-fi:nth-child(3) { transition-delay: .18s; }
                .bs-on .bs-fi:nth-child(4) { transition-delay: .25s; }
                .bs-on .bs-fi:nth-child(5) { transition-delay: .32s; }
                .bs-on .bs-fi:nth-child(6) { transition-delay: .39s; }
                .bs-on .bs-fi:nth-child(7) { transition-delay: .46s; }

                /* icon */
                .bs-icon {
                    width: 48px; height: 48px;
                    border-radius: 13px;
                    border: 1.5px dashed #e5e5e5;
                    display: flex; align-items: center; justify-content: center;
                    background: #fff;
                    margin: 0 auto 18px;
                    color: #0a0a0a;
                    opacity: 0; transform: scale(.88);
                    transition: opacity .5s cubic-bezier(.34,1.56,.64,1) .02s,
                                transform .5s cubic-bezier(.34,1.56,.64,1) .02s,
                                border-color .2s;
                }
                .bs-icon:hover { border-color: #d4d4d4; transform: scale(1.05) !important; }
                .bs-on .bs-icon { opacity: 1; transform: scale(1); }

                .bs-code {
                    font-family: 'Geist Mono', monospace;
                    font-size: 10.5px; font-weight: 500;
                    letter-spacing: .1em; color: #a3a3a3;
                    text-transform: uppercase; margin-bottom: 12px;
                }

                /* ── NEON RUNNING BORDER BADGE ── */
                @property --bs-angle {
                    syntax: '<angle>';
                    initial-value: 0deg;
                    inherits: false;
                }
                @keyframes bs-spin { to { --bs-angle: 360deg; } }

                .bs-badge-wrap {
                    position: relative;
                    display: inline-flex;
                    margin-bottom: 22px;
                    border-radius: 999px;
                    padding: 1.5px;
                }
                .bs-badge-wrap::before {
                    content: '';
                    position: absolute;
                    inset: -1px;
                    border-radius: 999px;
                    padding: 1.5px;
                    background: conic-gradient(
                        from var(--bs-angle, 0deg),
                        transparent 0deg,
                        transparent 265deg,
                        #dc2626 285deg,
                        #ef4444 305deg,
                        #dc2626 325deg,
                        transparent 360deg
                    );
                    -webkit-mask:
                        linear-gradient(#fff 0 0) content-box,
                        linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    animation: bs-spin 2.4s linear infinite;
                }
                .bs-badge-wrap.bs-warn::before {
                    background: conic-gradient(
                        from var(--bs-angle, 0deg),
                        transparent 0deg,
                        transparent 265deg,
                        #c2410c 285deg,
                        #f97316 305deg,
                        #c2410c 325deg,
                        transparent 360deg
                    );
                }

                .bs-badge-inner {
                    position: relative;
                    z-index: 1;
                    display: inline-flex;
                    align-items: center;
                    padding: 5px 14px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 500;
                    letter-spacing: .02em;
                    background: #fff5f5;
                    color: #dc2626;
                    white-space: nowrap;
                }
                .bs-badge-wrap.bs-warn .bs-badge-inner {
                    background: #fffbf5;
                    color: #c2410c;
                }

                .bs-h1 {
                    font-size: clamp(1.65rem, 4vw, 2.15rem);
                    font-weight: 600; letter-spacing: -.03em; line-height: 1.1;
                    color: #0a0a0a; margin-bottom: 12px; max-width: 420px;
                }
                .bs-p {
                    font-size: 14.5px; color: #737373; line-height: 1.65;
                    max-width: 360px; margin-bottom: 26px;
                }

                .bs-reason {
                    width: 100%; max-width: 400px; background: #fff;
                    border: 1px solid #e5e5e5; border-radius: 12px;
                    padding: 14px 18px; text-align: left; margin-bottom: 14px;
                    transition: border-color .2s, box-shadow .2s; cursor: default;
                }
                .bs-reason:hover { border-color: #d4d4d4; box-shadow: 0 2px 8px rgba(0,0,0,.05); }
                .bs-reason-lbl {
                    font-size: 10.5px; font-weight: 500; color: #a3a3a3;
                    letter-spacing: .06em; text-transform: uppercase;
                    margin-bottom: 5px; display: flex; align-items: center; gap: 5px;
                }
                .bs-reason-val { font-size: 13.5px; color: #0a0a0a; line-height: 1.6; }

                .bs-expiry {
                    display: inline-flex; align-items: center; gap: 7px;
                    font-size: 12.5px; color: #737373; padding: 7px 13px;
                    border-radius: 8px; border: 1px solid #e5e5e5; background: #fff;
                    margin-bottom: 24px; transition: border-color .2s;
                }
                .bs-expiry:hover { border-color: #d4d4d4; }
                .bs-expiry-val {
                    font-weight: 500; color: #0a0a0a;
                    font-family: 'Geist Mono', monospace; font-size: 11.5px;
                }

                .bs-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
                .bs-btn-p {
                    display: inline-flex; align-items: center; gap: 6px;
                    font-size: 13px; font-weight: 500; color: #fff; padding: 8px 17px;
                    border-radius: 8px; background: #0a0a0a; border: 1px solid #0a0a0a;
                    cursor: pointer; font-family: inherit; text-decoration: none;
                    transition: background .15s, box-shadow .15s, transform .15s;
                }
                .bs-btn-p:hover { background: #171717; box-shadow: 0 2px 8px rgba(0,0,0,.18); transform: translateY(-1px); }
                .bs-btn-p:active { transform: none; }
                .bs-btn-s {
                    display: inline-flex; align-items: center; gap: 6px;
                    font-size: 13px; font-weight: 500; color: #0a0a0a; padding: 8px 17px;
                    border-radius: 8px; background: #fff; border: 1px solid #e5e5e5;
                    cursor: pointer; font-family: inherit; text-decoration: none;
                    transition: background .15s, border-color .15s, transform .15s;
                }
                .bs-btn-s:hover { background: #f5f5f5; border-color: #d4d4d4; transform: translateY(-1px); }
                .bs-btn-s:active { transform: none; }

                .bs-div {
                    width: 100%; max-width: 400px; height: 1px;
                    background: linear-gradient(90deg, transparent, #e5e5e5 30%, #e5e5e5 70%, transparent);
                    margin: 28px 0 20px;
                }
                .bs-help { font-size: 12px; color: #a3a3a3; }
                .bs-help a {
                    color: #525252; font-weight: 500; text-decoration: underline;
                    text-underline-offset: 3px; transition: color .15s;
                }
                .bs-help a:hover { color: #0a0a0a; }

                .bs-footer {
                    padding: 16px 24px; border-top: 1px solid #e5e5e5;
                    display: flex; align-items: center; justify-content: space-between;
                    background: #fff; flex-wrap: wrap; gap: 10px;
                    flex-shrink: 0;
                }
                .bs-footer-logo { display: flex; align-items: center; gap: 7px; text-decoration: none; color: #0a0a0a; }
                .bs-footer-box {
                    width: 20px; height: 20px; background: #0a0a0a;
                    border-radius: 5px; display: flex; align-items: center;
                    justify-content: center; color: #fff;
                }
                .bs-footer-name { font-size: 12.5px; font-weight: 600; letter-spacing: -.01em; }
                .bs-footer-links { display: flex; gap: 14px; }
                .bs-footer-link { font-size: 11.5px; color: #a3a3a3; text-decoration: none; transition: color .15s; }
                .bs-footer-link:hover { color: #0a0a0a; }
            `}</style>

            <div className={`bs${ready ? " bs-on" : ""}`}>
                <main className="bs-main">

                    <div className="bs-icon">
                        {isBanned
                            ? <ShieldX size={20} strokeWidth={1.75} />
                            : <AlertTriangle size={20} strokeWidth={1.75} />
                        }
                    </div>

                    <p className="bs-code bs-fi">
                        {isBanned ? "Error 403 · Access Suspended" : "Error 503 · Verification Failed"}
                    </p>

                    {/* Neon running border badge — no dot */}
                    <div className="bs-fi">
                        <div className={`bs-badge-wrap${isBanned ? "" : " bs-warn"}`}>
                            <div className="bs-badge-inner">
                                {isBanned ? "Suspended" : "Unverified"}
                            </div>
                        </div>
                    </div>

                    <h1 className="bs-h1 bs-fi">
                        {isBanned ? "Your access has been suspended" : "Unable to verify your access"}
                    </h1>

                    <p className="bs-p bs-fi">
                        {isBanned
                            ? "This account has been suspended by the platform owner. Review the reason below or contact support to appeal this decision."
                            : "We couldn't verify your access right now. This is usually temporary — try refreshing the page or come back shortly."
                        }
                    </p>

                    {isBanned && reason && (
                        <div className="bs-fi" style={{ width: "100%", maxWidth: 400 }}>
                            <div className="bs-reason">
                                <div className="bs-reason-lbl">
                                    <Info size={9} strokeWidth={2.5} /> Reason
                                </div>
                                <p className="bs-reason-val">{reason}</p>
                            </div>
                        </div>
                    )}

                    {isBanned && expiresAt && (
                        <div className="bs-expiry bs-fi">
                            <Clock size={12} strokeWidth={2} />
                            Access may restore in&nbsp;
                            <span className="bs-expiry-val"><LiveClock expiresAt={expiresAt} /></span>
                        </div>
                    )}

                    <div className="bs-actions bs-fi">
                        {isBanned ? (
                            <>
                                <a href="mailto:support@xurl.eu.cc" className="bs-btn-p">
                                    <Mail size={12} strokeWidth={2} /> Contact support
                                </a>
                                <Link href="/" className="bs-btn-s">
                                    <ArrowLeft size={12} strokeWidth={2} /> Go home
                                </Link>
                            </>
                        ) : (
                            <>
                                <button className="bs-btn-p" onClick={() => window.location.reload()}>
                                    <RotateCcw size={12} strokeWidth={2} /> Try again
                                </button>
                                <Link href="/" className="bs-btn-s">
                                    <ArrowLeft size={12} strokeWidth={2} /> Go home
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="bs-div bs-fi" />

                    <p className="bs-help bs-fi">
                        Read our{" "}
                        <Link href="/acceptable-use">acceptable use policy</Link>
                        {" · "}
                        <Link href="/terms">terms of service</Link>
                    </p>

                </main>

                <footer className="bs-footer">
                    <Link href="/" className="bs-footer-logo">
                        <div className="bs-footer-box">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </div>
                        <span className="bs-footer-name">URL</span>
                    </Link>
                    <div className="bs-footer-links">
                        <Link href="/terms" className="bs-footer-link">Terms</Link>
                        <Link href="/privacy" className="bs-footer-link">Privacy</Link>
                        <Link href="/acceptable-use" className="bs-footer-link">Acceptable Use</Link>
                    </div>
                </footer>
            </div>
        </>
    );
}