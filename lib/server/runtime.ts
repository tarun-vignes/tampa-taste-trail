import { readSettings } from './config';
import { createApi } from './http';
export const api = createApi(readSettings());
