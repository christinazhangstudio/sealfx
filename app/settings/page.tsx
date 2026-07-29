"use client";

import { useState, useEffect } from "react";
import { trackedFetch as fetch } from "@/lib/api-tracker";

interface EbayConfig {
    appId: string;
    devId: string;
    certIdHint: string;
    redirectUri: string;
    isSandbox: boolean;
}

interface Settings {
    email: string;
    createdAt: string;
    ebayDeveloperConfig: EbayConfig;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

export default function SettingsPage() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Password form
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pwStatus, setPwStatus] = useState<{ msg: string; ok: boolean } | null>(null);
    const [pwSaving, setPwSaving] = useState(false);

    // eBay keyset form
    const [ebay, setEbay] = useState<EbayConfig | null>(null);
    const [certId, setCertId] = useState("");
    const [ebayStatus, setEbayStatus] = useState<{ msg: string; ok: boolean } | null>(null);
    const [ebaySaving, setEbaySaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${apiBaseUrl}/settings`);
                if (!res.ok) throw new Error(`Couldn't load settings (${res.status})`);
                const data: Settings = await res.json();
                setSettings(data);
                setEbay(data.ebayDeveloperConfig);
            } catch (err) {
                setLoadError(err instanceof Error ? err.message : "Couldn't load settings");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwStatus(null);

        if (newPassword.length < 8) {
            setPwStatus({ msg: "New password must be at least 8 characters.", ok: false });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwStatus({ msg: "The new passwords don't match.", ok: false });
            return;
        }

        setPwSaving(true);
        try {
            const res = await fetch(`${apiBaseUrl}/settings/password`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            if (!res.ok) throw new Error((await res.text()) || "Couldn't change password");
            setPwStatus({ msg: "Password updated.", ok: true });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            setPwStatus({ msg: err instanceof Error ? err.message : "Couldn't change password", ok: false });
        } finally {
            setPwSaving(false);
        }
    };

    const saveEbay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ebay) return;
        setEbayStatus(null);
        setEbaySaving(true);
        try {
            const res = await fetch(`${apiBaseUrl}/settings/ebay-config`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appId: ebay.appId,
                    devId: ebay.devId,
                    certId, // blank leaves the stored value untouched
                    redirectUri: ebay.redirectUri,
                    isSandbox: ebay.isSandbox,
                }),
            });
            if (!res.ok) throw new Error((await res.text()) || "Couldn't save eBay settings");
            setEbayStatus({
                msg: certId
                    ? "eBay settings saved. Re-authorize your sellers if they stop working."
                    : "eBay settings saved.",
                ok: true,
            });
            setCertId("");
        } catch (err) {
            setEbayStatus({ msg: err instanceof Error ? err.message : "Couldn't save eBay settings", ok: false });
        } finally {
            setEbaySaving(false);
        }
    };

    if (!mounted) return null;

    const field =
        "w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-primary placeholder:text-secondary/40";
    const label = "block text-sm font-semibold text-primary mb-2";
    const card = "bg-surface p-8 rounded-3xl shadow-lg border border-border/50 space-y-6";

    return (
        <div className="min-h-screen p-4 sm:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-primary">Settings</h1>
                    <p className="text-secondary text-lg mt-2">Your account and eBay connection.</p>
                </div>

                {loading ? (
                    <p className="text-secondary">Loading settings…</p>
                ) : loadError ? (
                    <p className="text-error-text font-medium">{loadError}</p>
                ) : (
                    <>
                        <section className={card}>
                            <div>
                                <h2 className="text-xl font-bold text-primary">Account</h2>
                                <p className="text-secondary text-sm mt-1">
                                    Signed in as <span className="text-primary font-medium">{settings?.email}</span>
                                </p>
                            </div>
                        </section>

                        <section className={card}>
                            <h2 className="text-xl font-bold text-primary">Change password</h2>
                            <form onSubmit={changePassword} className="space-y-4">
                                <div>
                                    <label className={label} htmlFor="currentPassword">Current password</label>
                                    <input
                                        id="currentPassword"
                                        type="password"
                                        autoComplete="current-password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className={field}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={label} htmlFor="newPassword">New password</label>
                                    <input
                                        id="newPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className={field}
                                        placeholder="At least 8 characters"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={label} htmlFor="confirmPassword">Confirm new password</label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className={field}
                                        required
                                    />
                                </div>
                                {pwStatus && (
                                    <p className={`text-sm font-medium ${pwStatus.ok ? "text-success-text" : "text-error-text"}`}>
                                        {pwStatus.msg}
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    disabled={pwSaving}
                                    className="px-6 py-3 rounded-xl font-bold text-white bg-btn-apply hover:bg-btn-apply-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {pwSaving ? "Saving…" : "Update password"}
                                </button>
                            </form>
                        </section>

                        <section className={card}>
                            <div>
                                <h2 className="text-xl font-bold text-primary">eBay developer keys</h2>
                                <p className="text-secondary text-sm mt-1">
                                    The keyset Sealift uses to talk to eBay on your behalf. Update it here if you rotate
                                    your Cert ID or mistyped something when you signed up.
                                </p>
                            </div>

                            {ebay?.isSandbox && (
                                <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
                                    Sandbox mode is on — every figure in Sealift is eBay test data, not your real store.
                                </div>
                            )}

                            {ebay && (
                                <form onSubmit={saveEbay} className="space-y-4">
                                    <div>
                                        <label className={label} htmlFor="appId">App ID (Client ID)</label>
                                        <input id="appId" type="text" value={ebay.appId}
                                            onChange={(e) => setEbay({ ...ebay, appId: e.target.value })}
                                            className={field} spellCheck={false} required />
                                    </div>
                                    <div>
                                        <label className={label} htmlFor="devId">Dev ID</label>
                                        <input id="devId" type="text" value={ebay.devId}
                                            onChange={(e) => setEbay({ ...ebay, devId: e.target.value })}
                                            className={field} spellCheck={false} required />
                                    </div>
                                    <div>
                                        <label className={label} htmlFor="certId">Cert ID (Client Secret)</label>
                                        <input id="certId" type="password" value={certId}
                                            onChange={(e) => setCertId(e.target.value)}
                                            className={field} spellCheck={false}
                                            placeholder={ebay.certIdHint ? `Currently ${ebay.certIdHint} — leave blank to keep it` : "Enter your Cert ID"} />
                                        <p className="text-xs text-secondary mt-2">
                                            For your security this is never shown. Leave it blank unless you're replacing it.
                                        </p>
                                    </div>
                                    <div>
                                        <label className={label} htmlFor="redirectUri">RuName (Redirect URL name)</label>
                                        <input id="redirectUri" type="text" value={ebay.redirectUri}
                                            onChange={(e) => setEbay({ ...ebay, redirectUri: e.target.value })}
                                            className={field} spellCheck={false} required />
                                    </div>
                                    <label className="flex items-center gap-3 text-sm text-primary">
                                        <input type="checkbox" checked={ebay.isSandbox}
                                            onChange={(e) => setEbay({ ...ebay, isSandbox: e.target.checked })}
                                            className="w-4 h-4 accent-current" />
                                        Use eBay Sandbox (test data)
                                    </label>
                                    {ebayStatus && (
                                        <p className={`text-sm font-medium ${ebayStatus.ok ? "text-success-text" : "text-error-text"}`}>
                                            {ebayStatus.msg}
                                        </p>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={ebaySaving}
                                        className="px-6 py-3 rounded-xl font-bold text-white bg-btn-apply hover:bg-btn-apply-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {ebaySaving ? "Saving…" : "Save eBay settings"}
                                    </button>
                                </form>
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
