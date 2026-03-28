import { Dispatch, FormEvent, SetStateAction, useState } from 'react';
import { RegisterPayload, TwoFactorChallengePayload } from '../../types/chat';

interface AuthViewProps {
  error: string;
  isAuthModeLogin: boolean;
  authBusy: boolean;
  loginEmail: string;
  loginPassword: string;
  pendingTwoFactorLogin: TwoFactorChallengePayload | null;
  pendingTwoFactorDebugCode: string | null;
  registerData: RegisterPayload;
  setIsAuthModeLogin: Dispatch<SetStateAction<boolean>>;
  setLoginEmail: Dispatch<SetStateAction<string>>;
  setLoginPassword: Dispatch<SetStateAction<string>>;
  setRegisterData: Dispatch<SetStateAction<RegisterPayload>>;
  handleLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  verifyLoginTwoFactor: (code: string) => Promise<void>;
  cancelTwoFactorLogin: () => void;
  handleRegister: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

const AuthView = ({
  error,
  isAuthModeLogin,
  authBusy,
  loginEmail,
  loginPassword,
  pendingTwoFactorLogin,
  pendingTwoFactorDebugCode,
  registerData,
  setIsAuthModeLogin,
  setLoginEmail,
  setLoginPassword,
  setRegisterData,
  handleLogin,
  verifyLoginTwoFactor,
  cancelTwoFactorLogin,
  handleRegister,
}: AuthViewProps) => {
  const [twoFactorCode, setTwoFactorCode] = useState('');

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_8%_0%,rgba(15,118,110,0.16),transparent_48%),radial-gradient(circle_at_88%_100%,rgba(240,140,54,0.16),transparent_52%),#f7f2ea] p-4 text-slate-800 sm:p-8">
      <section className="w-full max-w-xl rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 shadow-[0_24px_56px_rgba(15,23,42,0.12)] sm:p-8">
        <h1 className="font-['Space_Grotesk'] text-3xl font-bold tracking-tight">Permission-Based Chat</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Sign in with your account to access private conversations, groups, and admin controls.
        </p>
        {error ? (
          <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        {isAuthModeLogin && pendingTwoFactorLogin ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verifyLoginTwoFactor(twoFactorCode);
            }}
            className="mt-6 grid gap-3"
          >
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Enter a 6-digit code from your authenticator app, or use a recovery code.
            </p>
            {pendingTwoFactorDebugCode ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Debug code: <strong>{pendingTwoFactorDebugCode}</strong>
              </p>
            ) : null}
            <label htmlFor="two-factor-code" className="text-sm font-medium text-slate-600">
              Verification code
            </label>
            <input
              id="two-factor-code"
              type="text"
              inputMode="text"
              maxLength={9}
              value={twoFactorCode}
              onChange={(event) =>
                setTwoFactorCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 9))
              }
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              required
            />
            <p className="text-xs text-slate-500">Accepted: 6-digit OTP or recovery code like ABCD-1234.</p>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="submit"
                disabled={authBusy || twoFactorCode.trim().length < 6}
                className="rounded-xl bg-emerald-700 px-4 py-2.5 font-['Space_Grotesk'] text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authBusy ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTwoFactorCode('');
                  cancelTwoFactorLogin();
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Back to login
              </button>
            </div>
          </form>
        ) : isAuthModeLogin ? (
          <form onSubmit={(event) => void handleLogin(event)} className="mt-6 grid gap-3">
            <label htmlFor="login-email" className="text-sm font-medium text-slate-600">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              required
            />

            <label htmlFor="login-password" className="text-sm font-medium text-slate-600">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              required
            />

            <button
              type="submit"
              disabled={authBusy}
              className="mt-2 rounded-xl bg-emerald-700 px-4 py-2.5 font-['Space_Grotesk'] text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authBusy ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={(event) => void handleRegister(event)} className="mt-6 grid gap-3">
            <label htmlFor="register-name" className="text-sm font-medium text-slate-600">
              Name
            </label>
            <input
              id="register-name"
              type="text"
              value={registerData.name}
              onChange={(event) =>
                setRegisterData((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              required
            />

            <label htmlFor="register-reg" className="text-sm font-medium text-slate-600">
              Registration Number
            </label>
            <input
              id="register-reg"
              type="text"
              value={registerData.registrationNumber}
              onChange={(event) =>
                setRegisterData((prev) => ({
                  ...prev,
                  registrationNumber: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              required
            />

            <label htmlFor="register-email" className="text-sm font-medium text-slate-600">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              value={registerData.email}
              onChange={(event) =>
                setRegisterData((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              required
            />

            <label htmlFor="register-password" className="text-sm font-medium text-slate-600">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              value={registerData.password}
              onChange={(event) =>
                setRegisterData((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              required
              minLength={8}
            />

            <button
              type="submit"
              disabled={authBusy}
              className="mt-2 rounded-xl bg-emerald-700 px-4 py-2.5 font-['Space_Grotesk'] text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authBusy ? 'Creating account...' : 'Register'}
            </button>
          </form>
        )}

        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={() => {
            setTwoFactorCode('');
            cancelTwoFactorLogin();
            setIsAuthModeLogin((prev) => !prev);
          }}
        >
          {isAuthModeLogin ? 'Need an account? Register' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  );
};

export default AuthView;
