import EntryHistory from '../components/EntryHistory';

interface ProgressPageProps {
  userId: string;
  refreshTrigger: number;
  onRefresh?: () => void;
}

export default function ProgressPage({ userId, refreshTrigger, onRefresh }: ProgressPageProps) {
  return (
    <EntryHistory
      userId={userId}
      refreshTrigger={refreshTrigger}
      {...(onRefresh !== undefined && { onEntryUpdated: onRefresh })}
    />
  );
}
