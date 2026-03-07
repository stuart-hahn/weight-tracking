import DailyLogForm from '../components/DailyLogForm';
import type { CreateEntryRequest } from '../types/api';
import type { OptionalBodyFatSubmit } from '../components/DailyLogForm';

interface LogPageProps {
  userId: string;
  refreshTrigger: number;
  onSubmit: (body: CreateEntryRequest, optionalBodyFat?: OptionalBodyFatSubmit) => Promise<void>;
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
