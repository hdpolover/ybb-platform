/**
 * Base Domain Exception
 * 
 * All domain-specific exceptions should extend this class.
 */

export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, identifier: string) {
    super(`${entityName} with id ${identifier} not found`);
  }
}

export class InvalidOperationException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

export class ValidationException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedException extends DomainException {
  constructor(message: string = 'Unauthorized access') {
    super(message);
  }
}

export class DuplicateEntityException extends DomainException {
  constructor(entityName: string, field: string, value: string) {
    super(`${entityName} with ${field} '${value}' already exists`);
  }
}
