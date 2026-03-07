import EntryHistory from '../components/EntryHistory';

interface ProgressPageProps {
  userId: string;
  refreshTrigger: number;
}

export default function ProgressPage({ userId, refreshTrigger }: ProgressPageProps) {
  return <EntryHistory userId={userId} refreshTrigger={refreshTrigger} />;
}
