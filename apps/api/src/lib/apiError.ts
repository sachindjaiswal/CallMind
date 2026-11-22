/**
 * Application-level error that carries an HTTP status and a stable machine
 * readable code. Route handlers can throw these and the shared error middleware
 * turns them into the API's JSON error envelope.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
