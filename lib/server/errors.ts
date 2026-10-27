export class ServiceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public diagnostic?: Record<string, unknown>,
  ) {
    super(message);
  }
}
