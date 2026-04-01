export const queryKeys = {
  user: (userId: string) => ['user', userId] as const,
  workout: (userId: string, workoutId: string) => ['workout', userId, workoutId] as const,
  workoutsHub: (userId: string) => ['workoutsHub', userId] as const,
  exercisesPicker: (userId: string, q: string, favoritesOnly: boolean) =>
    ['exercisesPicker', userId, q, favoritesOnly] as const,
};
