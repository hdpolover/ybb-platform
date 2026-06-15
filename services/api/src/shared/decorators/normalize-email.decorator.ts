import { Transform } from 'class-transformer';

export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  );
}
