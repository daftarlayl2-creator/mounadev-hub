"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
// Routes
const contacts_1 = __importDefault(require("./routes/contacts"));
const conversations_1 = __importDefault(require("./routes/conversations"));
const messages_1 = __importDefault(require("./routes/messages"));
const templates_1 = __importDefault(require("./routes/templates"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const audit_1 = __importDefault(require("./routes/audit"));
const admin_1 = __importDefault(require("./routes/admin"));
(0, config_1.validateConfig)();
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
        },
    },
}));
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Serve dashboard static files
const path_1 = __importDefault(require("path"));
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), version: '1.0.0' });
});
// API routes
app.use('/api/v1/contacts', contacts_1.default);
app.use('/api/v1/conversations', conversations_1.default);
app.use('/api/v1/messages', messages_1.default);
app.use('/api/v1/templates', templates_1.default);
app.use('/api/v1/webhooks', webhooks_1.default);
app.use('/api/v1/audit', audit_1.default);
app.use('/api/v1/admin', admin_1.default);
// 404 handler
app.use(errorHandler_1.notFoundHandler);
// Error handler
app.use(errorHandler_1.errorHandler);
// Start server
app.listen(config_1.config.port, () => {
    logger_1.logger.info(`Mounadev Communication Hub running on port ${config_1.config.port}`, {
        env: config_1.config.nodeEnv,
        url: `http://localhost:${config_1.config.port}`,
    });
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});
exports.default = app;
//# sourceMappingURL=index.js.map