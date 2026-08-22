import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";

type RestrictedAuthState = "password_change_required" | "mfa_enrollment_required" | "mfa_verification_required";

export function LocalSecurityCompletion({ authState }: { authState: RestrictedAuthState }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<{ qrCodeDataUrl: string; manualKey: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const utils = trpc.useUtils();
  const changePassword = trpc.auth.changeBootstrapPassword.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); } });
  const beginEnrollment = trpc.auth.beginMfaEnrollment.useMutation({ onSuccess: data => setEnrollment(data) });
  const confirmEnrollment = trpc.auth.confirmMfaEnrollment.useMutation({ onSuccess: data => setRecoveryCodes(data.recoveryCodes) });
  const verifyMfa = trpc.auth.verifyMfa.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); window.location.assign("/"); } });
  const error = changePassword.error?.message || beginEnrollment.error?.message || confirmEnrollment.error?.message || verifyMfa.error?.message;
  const pending = changePassword.isPending || beginEnrollment.isPending || confirmEnrollment.isPending || verifyMfa.isPending;

  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) return;
    changePassword.mutate({ password });
  };
  const submitEnrollment = (event: React.FormEvent) => { event.preventDefault(); confirmEnrollment.mutate({ code }); };
  const submitVerification = (event: React.FormEvent) => { event.preventDefault(); verifyMfa.mutate({ code }); };
  const title = authState === "password_change_required" ? "Change the temporary password" : authState === "mfa_enrollment_required" ? "Set up multi-factor authentication" : "Verify multi-factor authentication";

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.08fr_0.92fr]">
      <section className="brand-grid relative hidden overflow-hidden bg-[#5A92C9] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <BrandLogo variant="full" className="relative z-10 h-20 w-auto max-w-[310px] rounded-xl bg-white/95 p-3" />
        <div className="relative z-10 max-w-xl pb-10"><p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-white/80">Account security</p><h1 className="text-5xl font-bold leading-[1.02] tracking-[-0.045em]">Protect your Welfare Pride account.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-white/85">Complete this short security step before entering the employee hub.</p></div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10"><div className="w-full max-w-md">
        <BrandLogo variant="full" className="mb-10 h-16 w-auto max-w-[280px] lg:hidden" />
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5A92C9]/10 text-[#5A92C9]"><ShieldCheck className="h-6 w-6" aria-hidden="true" /></div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D58240]">Secure account setup</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-black">{title}</h2>
        {authState === "password_change_required" ? <form className="mt-7 space-y-4 rounded-2xl border border-[#5A92C9]/20 bg-[#5A92C9]/5 p-5" onSubmit={submitPassword}>
          <p className="text-sm leading-6 text-muted-foreground">The bootstrap password cannot be used after this sign-in. Choose a unique password with at least 12 characters, uppercase, lowercase, a number, and a symbol.</p>
          <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} minLength={12} required /></div>
          <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={12} required /></div>
          {password && confirmPassword && password !== confirmPassword ? <p role="alert" className="text-sm text-red-700">Passwords do not match.</p> : null}
          <Button type="submit" className="h-11 w-full bg-[#D58240] font-semibold text-white hover:bg-[#D58240]/90" disabled={pending || password !== confirmPassword}>Save new password</Button>
        </form> : null}
        {authState === "mfa_enrollment_required" && !recoveryCodes ? <div className="mt-7 space-y-4 rounded-2xl border border-[#5A92C9]/20 bg-[#5A92C9]/5 p-5">
          <p className="text-sm leading-6 text-muted-foreground">Use an authenticator application to scan this code. Multi-factor authentication is required for local administrator access.</p>
          {!enrollment ? <Button className="w-full bg-[#5A92C9] text-white hover:bg-[#5A92C9]/90" disabled={pending} onClick={() => beginEnrollment.mutate()}>Generate MFA setup code</Button> : <form className="space-y-4" onSubmit={submitEnrollment}>
            <img src={enrollment.qrCodeDataUrl} alt="Scan this code in an authenticator application" className="mx-auto h-48 w-48 rounded-xl bg-white p-2" />
            <details className="rounded-xl border border-border bg-white p-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Use a manual setup key instead</summary><code className="mt-3 block break-all select-all">{enrollment.manualKey}</code></details>
            <div className="space-y-2"><Label htmlFor="mfa-enroll-code">Six-digit code</Label><Input id="mfa-enroll-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} maxLength={6} required /></div>
            <Button type="submit" className="h-11 w-full bg-[#D58240] font-semibold text-white hover:bg-[#D58240]/90" disabled={pending}>Confirm MFA setup</Button>
          </form>}
        </div> : null}
        {recoveryCodes ? <div className="mt-7 space-y-4 rounded-2xl border border-[#D58240]/30 bg-[#D58240]/5 p-5"><p className="font-semibold text-foreground">Store these recovery codes securely.</p><p className="text-sm text-muted-foreground">Each code can be used once if your authenticator is unavailable. They will not be shown again.</p><div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 font-mono text-xs">{recoveryCodes.map(value => <span key={value}>{value}</span>)}</div><Button className="w-full bg-[#D58240] text-white hover:bg-[#D58240]/90" onClick={() => window.location.assign("/")}>I have stored the recovery codes</Button></div> : null}
        {authState === "mfa_verification_required" ? <form className="mt-7 space-y-4 rounded-2xl border border-[#5A92C9]/20 bg-[#5A92C9]/5 p-5" onSubmit={submitVerification}><p className="text-sm leading-6 text-muted-foreground">Enter the six-digit code from your authenticator application or a one-time recovery code.</p><div className="space-y-2"><Label htmlFor="mfa-verify-code">Authentication code</Label><Input id="mfa-verify-code" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} required /></div><Button type="submit" className="h-11 w-full bg-[#D58240] font-semibold text-white hover:bg-[#D58240]/90" disabled={pending}>Verify and sign in</Button></form> : null}
        {error ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      </div></section>
    </main>
  );
}
