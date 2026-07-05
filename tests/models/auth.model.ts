/**
 * Request/response contracts for the authentication endpoints.
 * These interfaces double as the source of truth for schema assertions —
 * broken mode mutates these shapes, so tests assert them strictly.
 */

export interface Credentials {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface ConfirmRequest {
  email: string;
  code: string;
}

/** Healthy-mode response shapes (exact). */
export interface SignupResponse {
  message: string;
}

export interface ConfirmResponse {
  token: string;
  message: string;
}

export interface SigninResponse {
  token: string;
}

export interface MeResponse {
  id: string;
  email: string;
}
