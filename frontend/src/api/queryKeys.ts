export const queryKeys = {
  user: (userId: string) => ['user', userId] as const,
  workout: (userId: string, workoutId: string) => ['workout', userId, workoutId] as const,
  workoutsHub: (userId: string) => ['workoutsHub', userId] as const,
  exercisesPicker: (userId: string, q: string, favoritesOnly: boolean) =>
    ['exercisesPicker', userId, q, favoritesOnly] as const,
  exercise: (userId: string, exerciseId: string) => ['exercise', userId, exerciseId] as const,
  exerciseHistory: (userId: string, exerciseId: string) => ['exerciseHistory', userId, exerciseId] as const,
  exerciseSubstitutions: (userId: string, exerciseId: string) =>
    ['exerciseSubstitutions', userId, exerciseId] as const,
};
