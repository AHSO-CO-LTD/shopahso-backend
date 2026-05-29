import type { Request } from 'express';
import type { JwtUserPayload } from '../auth/auth.types';

export type RequestWithOptionalUser = Request & {
  user?: JwtUserPayload;
};
