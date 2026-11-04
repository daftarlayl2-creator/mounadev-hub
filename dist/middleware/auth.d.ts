import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    agent: {
        id: string;
        name: string;
        role: string;
        permissions: string[];
    };
}
export declare function authenticateAgent(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requirePermission(permission: string): (req: Request, res: Response, next: NextFunction) => void;
