import React, { useEffect, useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { CustomCommission, Order, SiteSettings, UserProfile, WishlistItem } from '../types';
import { apiFetch, setSessionToken } from '../utils/api';

interface AuthSuccessPayload {
  user: UserProfile;
  token: string;
  orders: Order[];
  commissions: CustomCommission[];
  wishlist?: WishlistItem[];
}

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'signup';
  authPromptNote?: string | null;
  settings: SiteSettings;
  onClose: () => void;
  onAuthSuccess: (payload: AuthSuccessPayload) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          prompt: () => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  authPromptNote = null,
  settings,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const googleClientId =
    settings.googleClientId?.trim() ||
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ||
    '';

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setShowPassword(false);
  }, [initialMode, isOpen]);

  // Load Google Identity Services script only when modal is open, Gmail OAuth is enabled, and client ID exists
  useEffect(() => {
    if (!isOpen || !settings.allowGmailOAuth || !googleClientId) return;
    if (document.getElementById('google-gsi-script')) return;

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [isOpen, settings.allowGmailOAuth, googleClientId]);

  if (!isOpen) return null;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = await apiFetch<AuthSuccessPayload>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSessionToken(payload.token);
      onAuthSuccess(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = await apiFetch<AuthSuccessPayload>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      setSessionToken(payload.token);
      onAuthSuccess(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGmailOAuth = () => {
    setError(null);
    if (!googleClientId) {
      setError(
        'Gmail OAuth is enabled, but no Google OAuth Client ID is configured yet. An administrator can add one under Admin Dashboard -> Settings -> Authentication.'
      );
      return;
    }

    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      setError('Google Sign-In library is still loading. Please try again in a moment.');
      return;
    }

    setIsSubmitting(true);
    const tokenClient = oauth2.initTokenClient({
      client_id: googleClientId,
      scope: 'openid email profile',
      callback: async (response) => {
        if (response.error || !response.access_token) {
          setError('Google sign-in was cancelled or failed.');
          setIsSubmitting(false);
          return;
        }
        try {
          const payload = await apiFetch<AuthSuccessPayload>('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ accessToken: response.access_token }),
          });
          setSessionToken(payload.token);
          onAuthSuccess(payload);
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Google sign-in failed.');
        } finally {
          setIsSubmitting(false);
        }
      },
    });
    tokenClient.requestAccessToken();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#111C16]/65 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-8 border border-white/70">
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-white/60 bg-white/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#2D5A46] block">
              {settings.siteName}
            </span>
            <h2 className="font-display text-lg font-bold text-[#18231C]">
              {mode === 'login' ? 'Member & Client Sign In' : 'Create Client Account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login modal"
            className="p-1.5 text-[#526058] hover:text-[#18231C] rounded-lg hover:bg-white/70 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 font-sans-ui text-xs">
          {/* Contextual Prompt (e.g. Wishlist Authentication Prompt) */}
          {authPromptNote && (
            <div className="p-3.5 rounded-xl bg-[#1B382B]/8 border border-[#1B382B]/20 text-[#18231C] flex items-start gap-2.5 text-xs">
              <Sparkles className="w-4 h-4 text-[#C29B38] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{authPromptNote}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Gmail / Google OAuth Button (if enabled in settings) */}
          {settings.allowGmailOAuth && (
            <div className="space-y-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleGmailOAuth}
                className="w-full py-2.5 px-4 bg-white hover:bg-[#FAF9F6] border border-[#D8D1C4] rounded-xl text-xs font-semibold text-[#18231C] flex items-center justify-center gap-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>Continue with Gmail / Google</span>
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-[#E8E2D6]" />
                <span className="shrink mx-3 text-[10px] uppercase tracking-widest text-[#7D8B82]">
                  or with email
                </span>
                <div className="flex-grow border-t border-[#E8E2D6]" />
              </div>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="font-semibold text-[#18231C] block">
                  Email Address or Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#7D8B82] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jesse@pounamuatelier.co.nz or jesse"
                    className="w-full pl-9 pr-3 py-2.5 bg-white/85 border border-[#E8E2D6] rounded-xl focus:outline-none focus:border-[#1B382B]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#18231C] block">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#7D8B82] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2.5 bg-white/85 border border-[#E8E2D6] rounded-xl focus:outline-none focus:border-[#1B382B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#7D8B82] hover:text-[#18231C] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
              >
                <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4 text-[#7FA892]" />
              </button>

              {/* Not a member yet -> Sign Up Link */}
              <div className="pt-2 text-center text-xs text-[#526058]">
                Not a customer or member yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('signup');
                  }}
                  className="font-bold text-[#1B382B] hover:underline cursor-pointer"
                >
                  Sign up here
                </button>
              </div>
            </form>
          ) : !settings.allowEmailRegistration ? (
            <div className="p-4 rounded-2xl bg-white/80 border border-[#E8E2D6] text-center space-y-3">
              <ShieldCheck className="w-7 h-7 text-[#C29B38] mx-auto" />
              <div className="font-display font-bold text-sm text-[#18231C]">
                Email Registration Disabled
              </div>
              <p className="text-[#526058] leading-relaxed">
                New email registrations are currently paused in studio settings.
                {settings.allowGmailOAuth
                  ? ' You can still continue using Gmail / Google OAuth above, or sign in with an existing account.'
                  : ' Please contact the studio for account access.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('login');
                }}
                className="px-4 py-2 bg-[#1B382B] text-white rounded-xl font-semibold cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSignup} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">First Name</label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-[#7D8B82] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="w-full pl-8 pr-3 py-2 bg-white/85 border border-[#E8E2D6] rounded-xl focus:outline-none focus:border-[#1B382B]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-3 py-2 bg-white/85 border border-[#E8E2D6] rounded-xl focus:outline-none focus:border-[#1B382B]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#18231C] block">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#7D8B82] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-white/85 border border-[#E8E2D6] rounded-xl focus:outline-none focus:border-[#1B382B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full px-3 py-2 bg-white/85 border border-[#E8E2D6] rounded-xl focus:outline-none focus:border-[#1B382B]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#18231C] block">Confirm Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3 py-2 bg-white/85 border border-[#E8E2D6] rounded-xl focus:outline-none focus:border-[#1B382B]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-[#1B382B] to-[#2D5A46] hover:from-[#12241B] hover:to-[#1B382B] text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
              >
                <span>{isSubmitting ? 'Creating account...' : 'Create Customer Account'}</span>
                <ArrowRight className="w-4 h-4 text-[#7FA892]" />
              </button>

              <div className="pt-2 text-center text-xs text-[#526058]">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('login');
                  }}
                  className="font-bold text-[#1B382B] hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
