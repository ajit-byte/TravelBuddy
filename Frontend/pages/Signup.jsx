import { useState, useContext, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useWebSettings } from '../context/WebSettingsContext';
import Navbar from '../components/Navbar';
import OTPField from '../components/OTPField';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [emailVerifiedViaGoogle, setEmailVerifiedViaGoogle] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [fromLoginRedirect, setFromLoginRedirect] = useState(false);
  const { signup } = useContext(AuthContext);
  const { t } = useWebSettings();
  const [searchParams] = useSearchParams();

  const countryCodes = [
    { code: '+1', name: 'USA/Canada' },
    { code: '+44', name: 'UK' },
    { code: '+91', name: 'India' },
    { code: '+977', name: 'Nepal' },
    { code: '+61', name: 'Australia' },
    { code: '+81', name: 'Japan' },
    { code: '+49', name: 'Germany' },
    { code: '+33', name: 'France' },
  ];

  // If coming back from Google OAuth with a verified email, pre-fill it
  useEffect(() => {
    const verifiedEmailParam = searchParams.get('verified_email');
    const nameParam = searchParams.get('name');
    const fromLogin = searchParams.get('from_login');

    if (verifiedEmailParam) {
      setEmail(verifiedEmailParam);
      setVerifiedEmail(verifiedEmailParam);
      setEmailVerified(true);
      setEmailVerifiedViaGoogle(true);
    }
    if (nameParam && !username) {
      // Pre-fill username from Google display name (sanitised)
      setUsername(nameParam.replace(/\s+/g, '').toLowerCase().slice(0, 20));
    }
    if (fromLogin === '1') {
      setFromLoginRedirect(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailVerified) {
      alert('Please verify your email address before creating your account.');
      return;
    }
    if (email !== verifiedEmail) {
      alert('Email has changed. Please verify again.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    setLoading(true);
    const fullPhone = phone ? `${countryCode}${phone}` : '';
    await signup(username.trim(), email, password, fullPhone);
    setLoading(false);
  };

  return (
    <div className="bg-background font-body text-on-surface min-h-screen flex items-center justify-center overflow-x-hidden selection:bg-secondary-container">
      <div className="fixed inset-0 z-0">
        <img
          alt="Solo traveler at sunset"
          className="w-full h-full object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJZ1hm1JFjn8AJmGXA0AQGpEWVjZJVGhlXFrl6d3UjaxBI62o6e40HcHHEFjBc2Si7qiFqrH46ijSq4CPg8vS72k2Y_uh_J0tg0VRHy6Gg5RxUvhrZcGw9tNmPLbcbhyh7UiKifgLOLHOHo3dDl7txpYLArnT8XjwLKyNxLr2yihBpDiyjTrXiFgrD5eQmNdshpUA6wgq8ZH-hQkwiTO4ucI3jDM2NCKXMIpREoAH1c34NYRfgznOu2vS5c8ASeWgovy3DXgS5I0-A"
          width="1920"
          height="1080"
          loading="eager"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/20 to-transparent"></div>
      </div>
      
      <div className="absolute top-0 w-full z-20">
        <Navbar showAuth={false} transparent={true} />
      </div>

      <main className="relative z-10 w-full max-w-7xl px-6 py-20 lg:grid lg:grid-cols-2 lg:gap-16 items-center flex-1">
        <div className="hidden lg:block space-y-8 pt-12 lg:-ml-20">
          <h1 className="font-headline text-8xl font-extrabold tracking-tighter text-white leading-[0.9]">
            {t('Your journey')} <br />
            <span className="text-secondary-container">{t('begins at the horizon.')}</span>
          </h1>
          <p className="text-xl text-white/90 max-w-md font-body leading-relaxed">
            Join a community of solo travelers exploring the world with confidence. Verified safety, curated paths, and meaningful connections.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              <img
                className="w-10 h-10 rounded-full border-2 border-white object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCD_4pVJk3IWVhP4g5_8r7Klsza9e9fUofKOddUWGzIezSCKCD5R_ycZ1dmcYrGp1xl4tSnBiAgvbbtbFHVuTMLw08X2ck1hxajJ4kJHGimScFPDQK1MFXlMNAx_GWUP8FkFWjFgH-W-RaCuxZJtkL6WNhYv_eaNpntFflG-5ERu4PIE8D7AcN0g2CASe89_MBjv8A7l1knjud6StiTa0cThIztE4ipSq5VnX2zClYxkNNItxzjXr08w4fk1-L3_lg4Xt0mSxCHbpiJ"
                alt="Avatar 1"
                width="40"
                height="40"
                loading="eager"
              />
              <img
                className="w-10 h-10 rounded-full border-2 border-white object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuALaNz6dBjpPK6bQzkFciyaDp9QEWg4xcdBeDBDsf3qrN5txJ9lVxKVO0W21PcywyakNmK-DOJX25tKkyFHyOXy-QpbrGuwtLcqQDVDtNBI6RfskWu0AaTkaVAXJNvgdwicnh9jnEqFtVaADkK6J_IOAtGtIYZ2lJ-vUrjDIQwp3IhHV7BISFLL4PIYCYah90tDMBkqogj1Lwpp46b5X4hu4rZ4IyCefgG-fzscrLLE-klXnGUyvBXk9-cY9k9LmuoX4_BNM-sVXrMe"
                alt="Avatar 2"
                width="40"
                height="40"
                loading="eager"
              />
              <img
                className="w-10 h-10 rounded-full border-2 border-white object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDlGqduyei_eRrA3paoJfMqxUpL3ueS7DWIv5SAyeJU86m8kVXDleBSyddiqxR96kstLcQUoiypqNXW7HFC4c-xoayof6AHDgfbv5uqC0OVzaUYrkD0vFGo8_Zr2cp3unnnIs5AZc0oBlfZGktcND78if_yotEmP3eHCC_NGK3sN6lOWlB9NG8mBk7OYYcaEdrQOajchNErovKhnPAkJrxgv9DWbNqhoIobMH-285IedMSWHT9GPFrRAzN__cbxnWQX8koYIDc_Upuy"
                alt="Avatar 3"
                width="40"
                height="40"
                loading="eager"
              />
            </div>
            <span className="text-white/80 text-sm font-medium tracking-wide">Joined by 12,000+ solo explorers</span>
          </div>
        </div>

        <div className="glass-panel w-full max-w-xl mx-auto lg:mr-0 lg:ml-auto lg:-mr-24 rounded-[2rem] p-8 md:p-12 shadow-2xl lg:-mt-12">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="font-headline text-3xl font-extrabold text-on-surface mb-2">{t('Create Account')}</h2>
            <p className="text-on-surface-variant font-body">{t('Sign up to start your next adventure.')}</p>
          </div>

          {/* Banner shown when redirected from login with no account found */}
          {fromLoginRedirect && (
            <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <span className="material-symbols-outlined text-amber-500 mt-0.5 shrink-0">info</span>
              <div>
                <p className="text-sm font-bold text-amber-800">No account found for this Google address</p>
                <p className="text-xs text-amber-700 mt-0.5">Your Gmail is already verified below. Just fill in the remaining details to create your account.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant ml-1" htmlFor="name">{t('Username')}</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">person</span>
                <input
                  id="name"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="cooltraveler"
                  required
                  className="w-full bg-blue-50/50 border border-blue-100/50 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/30 transition-all font-body placeholder:text-outline-variant outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 text-left">
              <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant ml-1" htmlFor="email">{t('Email Address')}</label>
              {emailVerifiedViaGoogle ? (
                /* ── Google-verified: show locked field with badge ── */
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">mail</span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    readOnly
                    className="w-full bg-emerald-50/60 border border-emerald-400 rounded-2xl py-4 pl-12 pr-36 font-body text-on-surface outline-none cursor-not-allowed"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                    <svg className="w-3 h-3" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="white"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/></svg>
                    Verified via Google
                  </div>
                </div>
              ) : (
                /* ── Normal OTP verification ── */
                <OTPField
                  type="email"
                  value={email}
                  onVerified={() => { setEmailVerified(true); setVerifiedEmail(email); }}
                  verified={emailVerified}
                >
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">mail</span>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        const newEmail = e.target.value;
                        setEmail(newEmail);
                        if (newEmail !== verifiedEmail) setEmailVerified(false);
                      }}
                      placeholder="you@example.com"
                      required
                      className={`w-full bg-blue-50/50 border rounded-2xl py-4 pl-12 pr-24 focus:ring-2 focus:ring-primary/30 transition-all font-body placeholder:text-outline-variant outline-none ${emailVerified ? 'border-emerald-400 bg-emerald-50/30' : 'border-blue-100/50'}`}
                    />
                  </div>
                </OTPField>
              )}
            </div>

            <div className="space-y-2 text-left">
              <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant ml-1">
                {t('Phone Number')} <span className="text-outline normal-case tracking-normal">(optional)</span>
              </label>
              <div className="flex gap-3">
                <div className="relative w-[110px] shrink-0">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full appearance-none bg-blue-50/50 border border-blue-100/50 rounded-2xl py-4 pl-4 pr-10 focus:ring-2 focus:ring-primary/30 transition-all font-body text-on-surface outline-none cursor-pointer text-sm"
                  >
                    {countryCodes.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">expand_more</span>
                </div>
                <div className="relative flex-1 group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">call</span>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full bg-blue-50/50 border border-blue-100/50 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/30 transition-all font-body placeholder:text-outline-variant outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-5">
              <div className="space-y-2 text-left flex-1">
                <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant ml-1" htmlFor="password">{t('Password')}</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full bg-blue-50/50 border border-blue-100/50 rounded-2xl py-4 pl-12 pr-12 focus:ring-2 focus:ring-primary/30 transition-all font-body placeholder:text-outline-variant outline-none"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-left flex-1">
                <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant ml-1" htmlFor="confirmPassword">{t('Confirm Password')}</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">enhanced_encryption</span>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={`w-full bg-blue-50/50 border border-blue-100/50 rounded-2xl py-4 pl-12 pr-12 focus:ring-2 transition-all font-body placeholder:text-outline-variant outline-none ${confirmPassword && password !== confirmPassword ? 'ring-2 ring-error/50' : 'focus:ring-primary/30'}`}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined">{showConfirmPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                    <p className="text-[10px] text-error font-bold mt-1 ml-2">Passwords do not match</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !emailVerified || !username || !email || !password || !confirmPassword || password !== confirmPassword}
              className="w-full bg-gradient-to-br from-tertiary-fixed to-on-tertiary-container text-on-tertiary-fixed font-headline font-bold py-4 rounded-full shadow-lg shadow-tertiary-fixed/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : !emailVerified ? 'Verify Email First' : 'Create Account'}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/30"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest font-label">
              <span className="bg-surface-container px-4 text-outline rounded">
                {emailVerifiedViaGoogle ? 'Email already verified' : 'Or verify email instantly'}
              </span>
            </div>
          </div>

          {!emailVerifiedViaGoogle && (
            <div className="w-full">
              <button
                type="button"
                onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google?mode=verify`}
                className="flex items-center justify-center gap-3 bg-white border-2 border-blue-100 rounded-2xl py-3.5 px-6 font-body font-semibold text-on-surface hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm w-full group"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Verify Gmail Address</span>
                <span className="ml-auto text-[10px] font-bold text-blue-500 bg-blue-50 group-hover:bg-white px-2 py-0.5 rounded-full border border-blue-200 uppercase tracking-wide">Skips OTP</span>
              </button>
              <p className="text-center text-[11px] text-outline mt-2">Only verifies your Gmail — you still set your own password</p>
            </div>
          )}

          <div className="mt-10 text-center">
            <p className="text-on-surface-variant font-body">
              {t('Already have an account?')}
              <Link to="/login" className="text-primary font-bold hover:underline ml-1">{t('Login here')}</Link>
            </p>
          </div>
        </div>
      </main>

      <div className="fixed bottom-6 right-6 z-20">
        <div className="bg-secondary-fixed text-on-secondary-fixed flex items-center gap-3 px-6 py-3 rounded-full shadow-lg border border-white/20 glass-panel">
          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
          <div className="flex flex-col text-left">
            <span className="text-[10px] uppercase tracking-widest font-label font-bold leading-tight">Secured & Verified</span>
            <span className="text-xs font-body font-medium">Safe Solo Travels 2024</span>
          </div>
        </div>
      </div>
    </div>
  );
}