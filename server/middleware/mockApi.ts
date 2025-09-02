import { NextFunction, Request, Response } from 'express';

export default function mockApi(req: Request, res: Response, next: NextFunction) {
  if (process.env.ENABLE_MOCK_API !== 'true') return next();

  next();
}
