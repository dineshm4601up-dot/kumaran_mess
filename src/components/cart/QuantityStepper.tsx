export function QuantityStepper({
  quantity,
  onIncrease,
  onDecrease,
  label,
}: {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  label: string;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-border">
      <button
        type="button"
        onClick={onDecrease}
        aria-label={`Decrease quantity of ${label}`}
        className="flex h-10 w-10 items-center justify-center rounded-full text-base font-medium text-foreground hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-medium text-foreground" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={`Increase quantity of ${label}`}
        className="flex h-10 w-10 items-center justify-center rounded-full text-base font-medium text-foreground hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        +
      </button>
    </div>
  );
}
