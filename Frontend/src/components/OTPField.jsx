import { useState, useRef, useEffect } from 'react';

/**
 * OTPField
 * Props:
 *   type        – 'email' | 'phone'
 *   value       – current input value (email address or phone number)
 *   onChange    – (val) => void  — called when the base input changes
 *   onVerified  – () => void     — called when OTP is confirmed
 *   verified    – bool           — controlled verified state from parent
 *   children    – optional slot for the base input (email/phone field)
 */
export default function OTPField({ type = 'email', value, onVerified, verified = false, children }) {
  // 'idle' | 'sending' | 'otp' | 'verifying' | 'verified' | 'error'
  const [stage, setStage] = useState(verified ? 'verified' : 'idle');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (verified) {
      setStage('verified');
    } else {
      setStage('idle');
      setOtp(['', '', '', '', '', '']);
      setError('');
    }
  }, [verified]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    timerRef.current = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [resendTimer]);

  const apiBase = import.meta.env.VITE_API_URL;
  const sendEndpoint = type === 'email' ? '/api/otp/send-email' : '/api/otp/send-phone';
  const verifyEndpoint = type === 'email' ? '/api/otp/verify-email' : '/api/otp/verify-phone';
  const bodyKey = type === 'email' ? 'email' : 'phone';

  async function handleSend() {
    if (!value?.trim()) {
      setError(type === 'email' ? 'Enter your email first' : 'Enter your phone number first');
      return;
    }
    setError('');
    setStage('sending');
    try {
      const res = await fetch(`${apiBase}${sendEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Failed to send OTP');
      setOtp(['', '', '', '', '', '']);
      setStage('otp');
      setResendTimer(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message);
      setStage('idle');
    }
  }

  async function handleVerify(otpString) {
    setStage('verifying');
    setError('');
    try {
      const res = await fetch(`${apiBase}${verifyEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: value.trim(), otp: otpString }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Verification failed');
      setStage('verified');
      onVerified?.();
    } catch (err) {
      setError(err.message);
      setOtp(['', '', '', '', '', '']);
      setStage('otp');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }

  function handleOtpChange(idx, val) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
    const full = next.join('');
    if (full.length === 6) handleVerify(full);
  }

  function handleOtpKeyDown(idx, e) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  function handleCancel() {
    setStage('idle');
    setOtp(['', '', '', '', '', '']);
    setError('');
  }

  return (
    <div className="space-y-2">
      {/* Base input slot */}
      <div className="relative">
        {children}
        {/* Verify / status button inside the input */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {stage === 'idle' && (
            <button type="button" onClick={handleSend}
              className="text-primary font-bold text-xs hover:scale-105 transition-transform">
              Verify
            </button>
          )}
          {stage === 'sending' && (
            <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
          {(stage === 'otp' || stage === 'verifying') && (
            <button type="button" onClick={handleCancel}
              className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none">×</button>
          )}
          {stage === 'verified' && (
            <span className="text-emerald-500 font-bold text-xs flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
              Verified
            </span>
          )}
        </div>
      </div>

      {/* OTP input boxes */}
      {(stage === 'otp' || stage === 'verifying') && (
        <div className="space-y-2">
          <p className="text-xs text-on-surface-variant ml-1">
            Enter the 6-digit code sent to <span className="font-bold text-primary">{value}</span>
          </p>
          <div className="flex gap-2">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={el => inputRefs.current[idx] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(idx, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(idx, e)}
                disabled={stage === 'verifying'}
                className={`w-10 h-12 text-center text-lg font-bold rounded-xl border-2 focus:outline-none transition-all
                  ${stage === 'verifying' ? 'opacity-50 cursor-not-allowed' : ''}
                  ${digit ? 'border-primary bg-primary/5 text-primary' : 'border-blue-100/50 bg-blue-50/50'}
                  focus:border-primary focus:ring-2 focus:ring-primary/20`}
              />
            ))}
            {stage === 'verifying' && (
              <div className="flex items-center ml-1">
                <svg className="w-5 h-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 ml-1">
            {resendTimer > 0
              ? <span className="text-xs text-outline">Resend in {resendTimer}s</span>
              : <button type="button" onClick={handleSend}
                  className="text-xs text-primary font-semibold hover:underline">Resend code</button>
            }
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 font-semibold ml-1 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
