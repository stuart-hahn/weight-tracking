interface InlineFieldErrorProps {
  id: string;
  message?: string | null;
}

export default function InlineFieldError({ id, message }: InlineFieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} className="ui-field-error" role="alert">
      {message}
    </p>
  );
}

