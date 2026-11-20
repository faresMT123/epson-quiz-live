import { ConnectionBanner } from '../components/ConnectionBanner';
import { usePlayer } from '../lib/usePlayer';
import { CountdownScreen } from './CountdownScreen';
import { JoinScreen } from './JoinScreen';
import { QuizScreen } from './QuizScreen';
import { ResultScreen } from './ResultScreen';
import { WaitingScreen } from './WaitingScreen';

export function PlayerApp({ onAdmin }: { onAdmin: () => void }) {
  const { session, notice, joining, connected, join, answer, finish, leave } = usePlayer();

  return (
    <>
      <ConnectionBanner connected={connected} />
      {!session && (
        <JoinScreen onJoin={join} joining={joining} notice={notice} onAdmin={onAdmin} />
      )}
      {session?.phase === 'waiting' && <WaitingScreen session={session} />}
      {session?.phase === 'countdown' && <CountdownScreen session={session} />}
      {session?.phase === 'quiz' && (
        <QuizScreen session={session} onAnswer={answer} onFinish={finish} />
      )}
      {session?.phase === 'result' && <ResultScreen session={session} onBack={leave} />}
    </>
  );
}
