import DailyLogForm from '../components/DailyLogForm';
import type { CreateEntryRequest } from '../types/api';

interface LogPageProps {
  userId: string;
  refreshTrigger: number;
  onSubmit: (body: CreateEntryRequest) => Promise<void>;
}

export default function LogPage({ userId, refreshTrigger, onSubmit }: LogPageProps) {
  return (
    <DailyLogForm
      userId={userId}
      refreshTrigger={refreshTrigger}
      onSubmit={onSubmit}
    />
  );
}
