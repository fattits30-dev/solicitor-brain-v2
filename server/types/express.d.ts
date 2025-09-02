import { Session } from 'express-session';

declare global {
  namespace Express {
    interface Request {
      session?: Session & {
        userId?: string;
        mfaVerified?: boolean;
      };
      sessionID?: string;
      user?: {
        id: string;
        username: string;
        role: string;
        email?: string;
      };
    }
  }
}

export {};
