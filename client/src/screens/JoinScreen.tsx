import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { JoinInput, Outcome, PlayerSession } from '@shared';
import { EpsonLogo } from '../components/EpsonLogo';

interface JoinScreenProps {
  onJoin: (input: JoinInput) => Promise<Outcome<PlayerSession>>;
  joining: boolean;
  notice: string | null;
  onAdmin: () => void;
}

export function JoinScreen({ onJoin, joining, notice, onAdmin }: JoinScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim(),
    };
    if (!payload.firstName || !payload.lastName || !payload.company) {
      setLocalError('Les trois champs sont obligatoires.');
      return;
    }
    setLocalError(null);
    await onJoin(payload);
  };

  const error = localError ?? notice;

  return (
    <main className="screen join-screen">
      <header className="neon-top">
        <EpsonLogo height={38} />
      </header>

      <section className="neon-panel join-card">
        <h1 className="neon-title">INSCRIPTION</h1>
        <span className="title-underline" />
        <p className="neon-sub">Dites-nous qui vous êtes avant de jouer.</p>

        <form onSubmit={handleSubmit} className="stack-16" noValidate>
          <div className="field">
            <label htmlFor="lastName">NOM</label>
            <input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              maxLength={40}
              required
              placeholder="Nom"
            />
          </div>
          <div className="field">
            <label htmlFor="firstName">PRÉNOM</label>
            <input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              maxLength={40}
              required
              placeholder="Prénom"
            />
          </div>
          <div className="field">
            <label htmlFor="company">SOCIÉTÉ</label>
            <input
              id="company"
              name="company"
              autoComplete="organization"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              maxLength={60}
              required
              placeholder="Société"
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg neon-cta" disabled={joining}>
            {joining ? (
              <>
                <Loader2 size={18} className="spin" /> CONNEXION…
              </>
            ) : (
              'SUIVANT'
            )}
          </button>
        </form>
      </section>

      <button type="button" className="admin-link" onClick={onAdmin}>
        Espace organisateur
      </button>
    </main>
  );
}
