import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const RESEND_SECONDS = 30;

export default function VerifyOtp() {
  const { completeVerification } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { email, from = '/' } = location.state || {};
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(location.state?.devOtp || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Opened directly with no email in router state: nothing to verify
  if (!email) return <Navigate to="/register" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await completeVerification(email, otp.trim());
      toast.success('Email verified. Welcome to SmartCart!');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError('');
    try {
      const r = await api.resendOtp({ email });
      if (r.devOtp) setDevOtp(r.devOtp);
      setCooldown(RESEND_SECONDS);
      toast.info('A new code has been sent');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>Verify your email</h1>
        <p className="muted">
          Enter the 6-digit code we sent to <strong>{email}</strong>.
        </p>

        {devOtp && (
          <div className="alert alert-info">
            Dev mode (no SMTP configured): your code is <strong className="mono">{devOtp}</strong>
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        <input
          className="input otp-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          placeholder="••••••"
          required
          autoFocus
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          aria-label="One-time code"
        />

        <button className="btn btn-primary btn-block" disabled={submitting || otp.length !== 6}>
          {submitting ? 'Verifying…' : 'Verify'}
        </button>

        <p className="muted small center">
          Didn't get it?{' '}
          <button type="button" className="link-btn" disabled={cooldown > 0} onClick={resend}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </p>
        <p className="muted small center">
          <Link to="/register">Use a different email</Link>
        </p>
      </form>
    </div>
  );
}
