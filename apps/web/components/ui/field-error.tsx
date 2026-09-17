type FieldErrorProps = Readonly<{
  id?: string;
  children?: React.ReactNode;
}>;

export function FieldError({ id, children }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p id={id} className="text-sm text-danger" role="alert">
      {children}
    </p>
  );
}
