import "server-only";

export type AuthErrorCode = "UNAUTHENTICATED" | "FORBIDDEN";
export type AuthErrorStatus = 401 | 403;

export class AuthError extends Error {
  readonly status: AuthErrorStatus;
  readonly code: AuthErrorCode;

  constructor(status: AuthErrorStatus, code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
