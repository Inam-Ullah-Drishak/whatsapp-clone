import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { errorMessage } from "../lib/api.js";

const RESEND_SECONDS = 60;

export default function Login() {
  const { requestOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState("phone"); // "phone" | "code"
  const [phone, setPhone] = useState("+92");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState("");

  const codeRef = useRef(null);

  // Resend countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const submitPhone = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await requestOtp(phone);
      setDevCode(data.devCode || "");
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await verifyOtp(phone, code);
      // AuthContext sets the user; the router redirects automatically
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError("");
    try {
      const data = await requestOtp(phone);
      setDevCode(data.devCode || "");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <div className="h-28 bg-teal-800" />

      <div className="mx-auto -mt-16 w-full max-w-md px-5 pb-16">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          {step === "phone" ? (
            <>
              <h1 className="text-xl font-medium text-teal-800">
                Enter your phone number
              </h1>
              <p className="mt-2 text-sm text-neutral-500">
                We'll send you a code to verify this number. Include your country
                code.
              </p>

              <form onSubmit={submitPhone} className="mt-7">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+923001234567"
                  autoFocus
                  className="w-full border-b-2 border-emerald-600 pb-2 text-center text-lg tracking-wide outline-none focus:border-emerald-700"
                />

                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={busy || phone.trim().length < 8}
                  className="mt-8 w-full rounded bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  {busy ? "Sending..." : "Next"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-medium text-teal-800">
                Verify {phone}
              </h1>
              <p className="mt-2 text-sm text-neutral-500">
                Enter the 6-digit code we sent you.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setCode("");
                    setError("");
                  }}
                  className="text-emerald-700 underline"
                >
                  Wrong number?
                </button>
              </p>

              {devCode && (
                <p className="mt-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Dev mode code: <strong>{devCode}</strong>
                </p>
              )}

              <form onSubmit={submitCode} className="mt-7">
                <input
                  ref={codeRef}
                  inputMode="numeric"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="------"
                  className="w-full border-b-2 border-emerald-600 pb-2 text-center text-2xl tracking-[0.6em] outline-none focus:border-emerald-700"
                />

                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="mt-8 w-full rounded bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  {busy ? "Verifying..." : "Verify"}
                </button>
              </form>

              <button
                type="button"
                onClick={resend}
                disabled={cooldown > 0}
                className="mt-5 w-full text-sm text-neutral-500 disabled:text-neutral-400"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}