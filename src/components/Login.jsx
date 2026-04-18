import React, { useState } from 'react';
import { MessageSquare, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';

const API = 'https://blinkv2.saisathyajain.workers.dev';

const Login = ({ onLogin }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login'
      ? { email, password }
      : { email, password, full_name: fullName };

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      localStorage.setItem('blink_token', data.token);
      localStorage.setItem('blink_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setError('Could not connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem 0.75rem 3rem',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    backgroundColor: '#f1f5f9',
    fontSize: '0.9375rem',
    boxSizing: 'border-box',
  };

  const iconStyle = {
    position: 'absolute', left: '1rem', top: '50%',
    transform: 'translateY(-50%)', color: 'var(--text-muted)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    marginBottom: '0.5rem',
  };

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex',
      flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', backgroundColor: '#f8fafc',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{
          width: '64px', height: '64px', backgroundColor: 'var(--primary)',
          borderRadius: '16px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white', margin: '0 auto 1rem',
        }}>
          <MessageSquare size={32} fill="white" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)' }}>Blink</h1>
      </div>

      <div style={{
        width: '100%', maxWidth: '440px', backgroundColor: 'white',
        padding: '2.5rem', borderRadius: '20px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginBottom: '2rem' }}>
          {mode === 'login' ? 'Sign in to your workspace' : 'Join your team workspace'}
        </p>

        {error && (
          <div style={{
            padding: '0.75rem 1rem', marginBottom: '1.25rem',
            backgroundColor: '#fef2f2', borderRadius: '10px',
            color: '#b91c1c', fontSize: '0.875rem', fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <div style={iconStyle}><User size={18} /></div>
                <input
                  type="text"
                  placeholder="Your full name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <div style={iconStyle}><Mail size={18} /></div>
              <input
                type="email"
                placeholder="name@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <div style={iconStyle}><Lock size={18} /></div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '1rem', top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {mode === 'register' && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                Minimum 6 characters
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.875rem',
              backgroundColor: loading ? '#94a3b8' : 'var(--primary)',
              color: 'white', borderRadius: '12px', fontWeight: 600,
              fontSize: '1rem', marginBottom: '1.25rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none',
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            style={{
              color: 'var(--primary)', fontWeight: 600, background: 'none',
              border: 'none', cursor: 'pointer', fontSize: '0.875rem',
            }}
          >
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
