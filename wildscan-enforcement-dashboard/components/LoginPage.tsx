import React, { useState } from "react";

type LoginPageProps = {
  expectedEmail: string;
  expectedPassword: string;
  expectedKey: string;
  onLoginSuccess: () => void;
};

const LoginPage: React.FC<LoginPageProps> = ({
  expectedEmail,
  expectedPassword,
  expectedKey,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!expectedEmail || !expectedPassword || !expectedKey) {
      setError("Login is not configured. Please set the env values.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedExpectedEmail = expectedEmail.trim().toLowerCase();
    const normalizedKey = accessKey.trim();
    const normalizedExpectedKey = expectedKey.trim();

    if (
      normalizedEmail === normalizedExpectedEmail &&
      password === expectedPassword &&
      normalizedKey === normalizedExpectedKey
    ) {
      onLoginSuccess();
      return;
    }

    setError("Invalid email, password, or access key.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md border border-emerald-500/20 bg-slate-900/70 backdrop-blur-md shadow-2xl rounded-2xl p-8">
        <div className="text-xs uppercase tracking-[0.35em] text-emerald-400 font-mono">
          Wildscan Secure Access
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-slate-100">Enforcement Login</h1>
        <p className="mt-2 text-sm text-slate-400">
          Use the fixed credentials and access key to continue.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/70"
              placeholder="xxxx@gmail.com"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-slate-400">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 pr-16 text-sm text-slate-100 outline-none focus:border-emerald-500/70"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs uppercase tracking-widest text-emerald-400 hover:text-emerald-300"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-slate-400">Access Key</label>
            <input
              type="text"
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/70"
              placeholder="WILD-ACCESS-XXXX"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
