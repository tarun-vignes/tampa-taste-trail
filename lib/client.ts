export async function requestJson<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(55000);
  const combined = signal ? AbortSignal.any([timeout, signal]) : timeout;
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Taste-Trail': '1' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: combined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      'The planning request timed out or could not reach the server. Please retry; no results were substituted.',
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The server response was unreadable. Please retry.');
  }
  if (!response.ok)
    throw new Error(
      typeof result?.error === 'string'
        ? result.error
        : 'Planning could not be completed.',
    );
  return result as T;
}
