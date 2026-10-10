// Errors carry a stable code. The client maps codes to the design's copy.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly headers: Record<string, string> = {},
  ) {
    super(message ?? code);
  }
}

export const notFound = () => new HttpError(404, 'not_found');
export const forbidden = () => new HttpError(403, 'forbidden');
export const unauthorised = () => new HttpError(401, 'unauthorised');
export const badRequest = (code = 'invalid_input') => new HttpError(400, code);
