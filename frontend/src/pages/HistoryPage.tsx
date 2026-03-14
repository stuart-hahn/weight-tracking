import EntryHistory from '../components/EntryHistory';

interface HistoryPageProps {
  userId: string;
  refreshTrigger: number;
  onRefresh?: () => void;
}

export default function HistoryPage({ userId, refreshTrigger, onRefresh }: HistoryPageProps) {
  return (
    <EntryHistory
      userId={userId}
      refreshTrigger={refreshTrigger}
      {...(onRefresh !== undefined && { onEntryUpdated: onRefresh })}
    />
  );
}
