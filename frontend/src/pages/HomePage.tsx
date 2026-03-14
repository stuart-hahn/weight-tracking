import DailyLogForm from '../components/DailyLogForm';
import type { CreateEntryRequest } from '../types/api';
import type { OptionalBodyFatSubmit } from '../components/DailyLogForm';

interface HomePageProps {
  userId: string;
  refreshTrigger: number;
  onSubmit: (body: CreateEntryRequest, optionalBodyFat?: OptionalBodyFatSubmit) => Promise<void>;
  onError?: (message: string | null) => void;
}

export default function HomePage({ userId, refreshTrigger, onSubmit, onError }: HomePageProps) {
  return (
    <DailyLogForm
      userId={userId}
      refreshTrigger={refreshTrigger}
      onSubmit={onSubmit}
      variant="home"
      {...(onError !== undefined && { onError })}
    />
  );
}
