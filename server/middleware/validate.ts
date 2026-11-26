import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { extractZodFieldErrors, formatZodError } from '../../src/validation/schemas.ts';

export interface ValidatedRequest<TBody = unknown, TQuery = unknown> extends Request {
  validatedBody?: TBody;
  validatedQuery?: TQuery;
}

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: ValidatedRequest<z.infer<T>>, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: formatZodError(parsed.error),
        fieldErrors: extractZodFieldErrors(parsed.error),
      });
    }
    req.validatedBody = parsed.data;
    req.body = parsed.data as Record<string, unknown>;
    return next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: ValidatedRequest<unknown, z.infer<T>>, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: formatZodError(parsed.error),
        fieldErrors: extractZodFieldErrors(parsed.error),
      });
    }
    req.validatedQuery = parsed.data;
    return next();
  };
}
