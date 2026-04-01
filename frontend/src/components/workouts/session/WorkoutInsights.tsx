interface WorkoutInsightsProps {
  last: string;
  suggestion: string;
  variant?: string;
  humanizeVariant: (v: string) => string;
  /** When true, omit the “Last time” line (shown elsewhere, e.g. session header). */
  hideLast?: boolean;
}

export default function WorkoutInsights({
  last,
  suggestion,
  variant,
  humanizeVariant,
  hideLast = false,
}: WorkoutInsightsProps) {
  return (
    <div className="progress-text workout-session__insight">
      {!hideLast && (
        <p className="workout-session__insight-last">
          <strong>Last time:</strong> {last}
        </p>
      )}
      {(suggestion || (variant != null && variant !== '')) && (
        <details className="workout-session__insight-details">
          <summary className="workout-session__insight-more">More</summary>
          {variant != null && variant !== '' && (
            <p className="workout-session__insight-extra">
              <strong>Progression:</strong> {humanizeVariant(variant)}
            </p>
          )}
          {suggestion ? (
            <p className="workout-session__insight-extra">
              <strong>Suggestion:</strong> {suggestion}
            </p>
          ) : null}
        </details>
      )}
    </div>
  );
}

