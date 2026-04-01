import type { ReactNode } from 'react';

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'sm',
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<SegmentedControlOption<T>>;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={className ? `segmented-control ${className}` : 'segmented-control'} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={[
              'segmented-control__btn',
              'btn',
              size === 'sm' ? 'btn--sm' : '',
              active ? 'btn--primary' : 'btn--secondary',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

