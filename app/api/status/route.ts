import { api } from '../../../lib/server/runtime';
export const dynamic = 'force-dynamic';
export function GET() {
  return api.status();
}
