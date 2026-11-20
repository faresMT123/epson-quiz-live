import { useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2, LockKeyhole } from 'lucide-react';
import { EpsonLogo } from '../components/EpsonLogo';

interface AdminLoginProps {
  onLogin: (password: string) => Promise<void>;
  error: string | null;
  busy: boolean;
  onExit: () => void;
}

export function AdminLogin({ onLogin, error, busy, onExit }: AdminLoginProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) return;
    await onLogin(password);
  };

  return (
    <main className="screen">
      <header className="neon-top">
        <EpsonLogo height={38} />
      </header>

      <section className="neon-panel login-card">
        <span className="eyebrow neon-cyan">CONSOLE ORGANISATEUR</span>
        <h1 className="neon-title">CONNEXION</h1>
        <span className="title-underline" />
        <p className="neon-sub">
          Accès réservé à l'organisateur. Le mot de passe est vérifié côté serveur.
        </p>

        <form onSubmit={handleSubmit} className="stack-16">
          <div className="field">
            <label htmlFor="admin-password">MOT DE PASSE</label>
            <div className="input-icon">
              <LockKeyhole size={18} />
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg neon-cta" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={18} className="spin" /> VÉRIFICATION…
              </>
            ) : (
              'SE CONNECTER'
            )}
          </button>
        </form>

        <button type="button" className="link-btn back-link" onClick={onExit}>
          <ArrowLeft size={16} /> Retour à l'espace joueur
        </button>
      </section>
    </main>
  );
}
