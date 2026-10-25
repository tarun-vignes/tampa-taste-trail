import { api } from '../../../lib/server/runtime';
export const runtime = 'nodejs';
export const maxDuration = 60;
export function POST(request: Request) {
  return api.handle(request, 'parse');
}
