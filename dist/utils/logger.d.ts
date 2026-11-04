export declare function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: Record<string, any>): void;
export declare const logger: {
    info: (msg: string, meta?: Record<string, any>) => void;
    warn: (msg: string, meta?: Record<string, any>) => void;
    error: (msg: string, meta?: Record<string, any>) => void;
    debug: (msg: string, meta?: Record<string, any>) => void;
};
