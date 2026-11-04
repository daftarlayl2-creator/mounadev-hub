"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const logger_1 = require("../utils/logger");
function errorHandler(err, req, res, _next) {
    logger_1.logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
    res.status(500).json({
        error: 'internal_error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        code: 500,
    });
}
function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'not_found',
        message: `Route ${req.method} ${req.path} not found`,
        code: 404,
    });
}
//# sourceMappingURL=errorHandler.js.map