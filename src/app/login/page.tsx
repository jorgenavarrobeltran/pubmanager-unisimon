'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setLoading(false);
      if (authError.message.includes('Invalid login')) {
        setError('Correo o contraseña incorrectos');
      } else if (authError.message.includes('Email not confirmed')) {
        setError('Tu cuenta no ha sido confirmada. Revisa tu correo.');
      } else {
        setError(authError.message);
      }
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2a4a 40%, #09843B 100%)',
      padding: '20px',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 20% 80%, rgba(9,132,59,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(9,132,59,0.1) 0%, transparent 50%)',
      }} />

      <div style={{
        width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '18px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #09843B, #0aa64d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', fontWeight: 800, color: 'white', letterSpacing: '-1px',
            boxShadow: '0 8px 32px rgba(9,132,59,0.4)',
          }}>
            PM
          </div>
          <h1 style={{
            fontSize: '28px', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.5px',
          }}>
            PubManager
          </h1>
          <p style={{
            fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '4px',
            fontWeight: 500,
          }}>
            Universidad Simón Bolívar — Gestión Editorial
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '36px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <h2 style={{
            fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '4px',
          }}>
            Iniciar Sesión
          </h2>
          <p style={{
            fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '28px',
          }}>
            Ingresa tus credenciales para acceder
          </p>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', borderRadius: '10px',
              background: 'rgba(229,57,53,0.15)', border: '1px solid rgba(229,57,53,0.3)',
              marginBottom: '20px',
            }}>
              <AlertCircle size={16} color="#EF5350" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#EF5350', fontWeight: 500 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Correo Electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 14px 12px 42px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '12px', color: 'white', fontSize: '14px',
                    outline: 'none', transition: 'all 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(9,132,59,0.6)'; e.target.style.background = 'rgba(255,255,255,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.08)'; }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '12px 42px 12px 42px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '12px', color: 'white', fontSize: '14px',
                    outline: 'none', transition: 'all 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(9,132,59,0.6)'; e.target.style.background = 'rgba(255,255,255,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.08)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: '100%', padding: '14px',
                background: loading ? 'rgba(9,132,59,0.5)' : 'linear-gradient(135deg, #09843B, #0aa64d)',
                color: 'white', border: 'none', borderRadius: '12px',
                fontSize: '15px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(9,132,59,0.3)',
                transition: 'all 0.2s',
                opacity: !email || !password ? 0.6 : 1,
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{
                    width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white', borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  Ingresando...
                </span>
              ) : 'Ingresar'}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: 'center', marginTop: '24px',
          fontSize: '11px', color: 'rgba(255,255,255,0.3)',
        }}>
          © {new Date().getFullYear()} Universidad Simón Bolívar — Departamento de Publicaciones
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input::placeholder {
          color: rgba(255,255,255,0.25);
        }
      `}</style>
    </div>
  );
}
