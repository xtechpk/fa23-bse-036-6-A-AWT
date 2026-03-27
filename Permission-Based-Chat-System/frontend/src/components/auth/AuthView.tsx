import { Dispatch, FormEvent, SetStateAction } from 'react';
import { RegisterPayload } from '../../types/chat';

interface AuthViewProps {
  error: string;
  isAuthModeLogin: boolean;
  authBusy: boolean;
  loginEmail: string;
  loginPassword: string;
  registerData: RegisterPayload;
  setIsAuthModeLogin: Dispatch<SetStateAction<boolean>>;
  setLoginEmail: Dispatch<SetStateAction<string>>;
  setLoginPassword: Dispatch<SetStateAction<string>>;
  setRegisterData: Dispatch<SetStateAction<RegisterPayload>>;
  handleLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleRegister: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

const AuthView = ({
  error,
  isAuthModeLogin,
  authBusy,
  loginEmail,
  loginPassword,
  registerData,
  setIsAuthModeLogin,
  setLoginEmail,
  setLoginPassword,
  setRegisterData,
  handleLogin,
  handleRegister,
}: AuthViewProps) => {
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

        {isAuthModeLogin ? (
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
          onClick={() => setIsAuthModeLogin((prev) => !prev)}
        >
          {isAuthModeLogin ? 'Need an account? Register' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  );
};

export default AuthView;
