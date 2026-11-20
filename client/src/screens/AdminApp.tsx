import { Loader2 } from 'lucide-react';
import { useAdmin } from '../lib/useAdmin';
import { AdminDashboard } from './AdminDashboard';
import { AdminLogin } from './AdminLogin';

export function AdminApp({ onExit }: { onExit: () => void }) {
  const admin = useAdmin();

  if (!admin.token) {
    return (
      <AdminLogin
        onLogin={admin.login}
        error={admin.error}
        busy={admin.busy}
        onExit={onExit}
      />
    );
  }

  if (!admin.snapshot) {
    return (
      <main className="screen">
        <div className="stack center">
          <Loader2 size={30} className="spin" />
          <p className="muted">Connexion à la console organisateur…</p>
        </div>
      </main>
    );
  }

  return <AdminDashboard admin={admin} snapshot={admin.snapshot} onExit={onExit} />;
}
