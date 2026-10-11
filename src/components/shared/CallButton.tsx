import { buildTelLink } from "@/lib/phone-link";
import { Button, type ButtonProps } from "@/components/ui/Button";

// A plain `tel:` link styled as a Button — no client-side state needed,
// so this never needs "use client" itself. Used by the admin order
// detail page, the admin orders table/cards ("Call Ravi" — requirement
// 4), and the admin customer detail page. The customer-facing header's
// "Call Kumaran Mess" button is deliberately its own markup instead of
// this component (see Header.tsx) since it matches that header's
// existing compact icon-button style rather than the admin UI's Button
// component — but both ultimately go through buildTelLink(), so the
// phone-number-to-tel:-link logic itself is never duplicated.
export function CallButton({
  phone,
  label,
  size = "sm",
  variant = "outline",
  className,
}: {
  phone: string | null | undefined;
  label: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const href = buildTelLink(phone);

  if (!href) {
    return (
      <span className="text-xs text-muted-foreground" title="No phone number on file">
        No phone number
      </span>
    );
  }

  return (
    <a href={href} aria-label={label} title={label} className={className}>
      <Button type="button" size={size} variant={variant}>
        📞 {label}
      </Button>
    </a>
  );
}
