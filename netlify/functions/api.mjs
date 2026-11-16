// The whole API as one Netlify Function. See server/src/serverless.js.
import { getStore } from '@netlify/blobs';
import { createHandler } from '../../server/src/serverless.js';

let handler;

export default async (request, context) => {
  handler ??= createHandler(getStore({ name: 'teachconnect', consistency: 'strong' }));
  return handler(request, context.ip);
};

export const config = { path: '/api/*' };
