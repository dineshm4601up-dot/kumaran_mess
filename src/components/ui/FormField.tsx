import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const controlClasses = cn(
  "w-full rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5 text-sm",
  "text-foreground placeholder:text-muted-foreground",
  "focus:outline-2 focus:outline-offset-1 focus:outline-primary",
  "disabled:opacity-60 disabled:cursor-not-allowed",
  "aria-[invalid=true]:border-danger",
);

type FieldWrapperProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
};

function FieldWrapper({ label, htmlFor, error, hint, required, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, id, required, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <FieldWrapper label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(controlClasses, className)}
          required={required}
          {...props}
        />
      </FieldWrapper>
    );
  },
);
InputField.displayName = "InputField";

export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, error, hint, id, required, className, rows = 4, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <FieldWrapper label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={Boolean(error)}
          className={cn(controlClasses, "resize-none", className)}
          required={required}
          {...props}
        />
      </FieldWrapper>
    );
  },
);
TextAreaField.displayName = "TextAreaField";

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, hint, id, required, className, children, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <FieldWrapper label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
        <select
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(controlClasses, className)}
          required={required}
          {...props}
        >
          {children}
        </select>
      </FieldWrapper>
    );
  },
);
SelectField.displayName = "SelectField";
