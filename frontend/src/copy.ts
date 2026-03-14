/**
 * App copy – supportive, playful voice. Tune in one place.
 */

export const copy = {
  /* App identity */
  appTitle: 'Body Fat Tracker',
  appSubtitle: 'Track your weight and body fat—and see your progress toward your goal.',

  /* Auth */
  logIn: 'Log in',
  createAccount: 'Create account',
  welcomeBack: 'Welcome back.',
  signupSuccess: "You're all set. Head to Home to add your first weigh-in.",

  /* Home / log */
  logToday: 'Log today',
  logAnotherDate: 'Log another date',
  logAnotherDateHint: 'Adding a weigh-in for',
  changeDateIfNeeded: 'Change the date above if needed.',
  saveEntry: 'Save entry',
  saving: 'Saving…',
  saved: 'Saved',
  savedSuccess: "Logged. You're one step closer.",
  viewProgress: 'View progress',
  todayWeighInWaiting: "Today's weigh-in is waiting — one quick log and you're set.",
  todayEntry: "Today's entry",
  youLogged: "You logged",
  forToday: "for today.",
  offToGoodStart: "You're off to a good start. Log again when you can to see your trend.",
  updateTodaysEntry: "Update today's entry",
  editTodaysEntry: "Edit today's entry",
  missingDayHint: 'Missing a day? Use the button above to add a weigh-in for any date.',
  optionalBodyFatHint: 'Optional: body fat %, waist, hip. Expand below if you track these.',
  optionalBodyFat: 'Optional: body fat %',
  optionalWaistHip: 'Optional: waist / hip',

  /* Progress */
  progress: 'Progress',
  progressAtGlance: 'Progress at a glance',
  current: 'Current',
  goal: 'Goal',
  ofTheWayThere: 'of the way there',
  towardGoal: 'toward goal',
  changeGoal: 'Change goal',
  goalUpdated: "Goal updated. You've got this.",
  viewYourJourney: 'View your journey',
  seeFullProgress: 'View your journey',
  seeYourProgress: 'See your progress',
  howWeCalculate: 'How we calculate',
  howWeCalculateBody:
    "Goal weight comes from your target body fat % and lean mass. The date estimate uses your recent weigh-in trend.",
  targetBodyFatPercent: 'Target body fat (%)',
  paceAhead: 'Ahead of pace',
  paceOnTrack: 'On track',
  paceSlightlyBehind: 'A bit behind',
  paceBehind: 'Behind',
  paceSuggestionBehind: 'A small tweak could get you back on track.',
  stayingAroundCalories: (min: number, max: number) =>
    `Staying around ${min}–${max} kcal/day can keep you on track.`,

  /* History */
  fullProgressSummary: 'Progress summary, pace, and goal estimate',
  entriesCount: (n: number) => `${n} entries`,
  changeGoalInSettings: 'Change goal',
  howWeCalculateFull:
    "Goal weight comes from your target body fat % and lean mass (we estimate lean mass from your height, weight, and sex if you don't set it). The estimated goal date is based on your recent weigh-in trend—more weigh-ins give a more reliable estimate.",
  leanMass: 'Lean mass',
  leanMassEstimated: 'we estimated this from your profile',
  leanMassYouSet: 'you set',
  estimatedBodyFat: 'Estimated body fat',
  estimatedBodyFatNote: '—based on your current weight and lean mass.',
  estimatedBodyFatFromWeight: (pct: number) =>
    `We estimate your body fat at ${pct.toFixed(1)}% from your weight and lean mass.`,
  progressDetails: 'Details',
  addEntry: 'Add entry',
  addWeighIn: 'Add weigh-in',
  emptyHistoryTitle: 'Your journey starts here',
  emptyHistoryText: 'Your first entry will start your journey. Log a weigh-in to see your progress over time.',
  logFirstEntry: 'Log your first entry',
  logFirstWeighIn: 'Log your first weigh-in',
  noEntriesYet: 'No entries yet',
  weighInAdded: 'Weigh-in added.',
  updated: 'Updated.',
  entryRemoved: 'Entry removed.',
  editItInstead: 'Edit it instead',
  alreadyWeighInFor: (date: string) => `You already have a weigh-in for ${date}.`,
  saveWeighIn: 'Save weigh-in',
  editEntry: 'Edit entry',
  deleteEntry: 'Delete',
  deleteEntryTitle: 'Delete entry?',
  deleteEntryConfirm: (date: string) => `Delete this weigh-in for ${date}? This can't be undone.`,
  deleting: 'Deleting…',
  failedToUpdateEntry: 'Failed to update entry',
  failedToDeleteEntry: 'Failed to delete entry',
  failedToSaveWeighIn: 'Failed to save weigh-in',
  skipForNow: 'Skip for now',
  saveAndContinue: 'Save and continue',
  onboardingGoalNote: (current: string, goal: string, pct: number) =>
    `Your goal: ${current} → ${goal} (${pct}% body fat). You can change this in Settings anytime.`,
  enterTodaysWeight: "Enter today's weight to start. You can add calories and other details later.",
  switchUnitsHint: 'You can switch to lb/in in Settings anytime.',
  addFirstWeighInLater: 'You can always add your first weigh-in later from Home.',
  cancel: 'Cancel',

  /* Retention / verification */
  verifyEmailPrompt: 'One quick step: verify your email so we can keep your account secure.',
  verifyEmailResendHint: 'Link not working or expired? You can resend a new one below.',
  verifyEmailSent: 'Sent. Check your inbox (and spam folder).',
  resendFailed: "That didn't go through. Try again in a moment.",
  resendEmail: 'Resend email',

  /* Errors & loading */
  progressLoadError: "We couldn't load your progress. Check your connection and try again.",
  retry: 'Retry',
  failedToSaveEntry: 'Failed to save entry',
  failedToUpdate: 'Failed to update.',
  alreadyLoggedThisDate: "You've already logged this date.",
  editThatEntryInstead: 'Edit that entry instead',
  targetBodyFatInvalid: 'Target body fat % must be between 1 and 99',
  failedToUpdateGoal: 'Failed to update goal',
  pleaseEnterValidWeight: 'Please enter a valid weight.',
  pleaseEnterValidWeightShort: 'Please enter a valid weight',

  /* Settings */
  profileUpdated: 'Your profile is updated.',
  nothingChanged: "You haven't changed anything yet.",
  signOut: 'Sign out',

  /* Onboarding */
  addFirstWeighIn: "Add your first weigh-in",
  youreSet: "You're set",

  /* 404 */
  pageNotFound: 'Page not found',
  pageNotFoundDescription: "The page you're looking for doesn't exist or has been moved.",
  goHome: 'Go home',
} as const;
