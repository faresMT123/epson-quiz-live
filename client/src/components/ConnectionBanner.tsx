import { WifiOff } from 'lucide-react';

export function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="connection-banner" role="status">
      <WifiOff size={16} />
      <span>Connexion perdue — reconnexion en cours…</span>
    </div>
  );
}
