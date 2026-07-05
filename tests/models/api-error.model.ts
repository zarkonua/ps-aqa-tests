/**
 * The app returns two distinct error shapes depending on the layer:
 *  - Custom auth controller (business/validation errors): `{ error: string }`
 *  - Security firewall / JWT (lexik): `{ code: number, message: string }`
 */

export interface ControllerError {
  error: string;
}

export interface JwtError {
  code: number;
  message: string;
}

export type ApiError = ControllerError | JwtError;
