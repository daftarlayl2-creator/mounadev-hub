"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/audit.ts
const express_1 = require("express");
const auditService_1 = require("../services/auditService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateAgent);
router.get('/', (0, auth_1.requirePermission)('read'), async (req, res) => {
    try {
        const result = await auditService_1.auditService.query({
            agent_id: req.query.agent_id,
            action: req.query.action,
            resource_type: req.query.resource_type,
            from_date: req.query.from_date,
            to_date: req.query.to_date,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0,
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'internal_error', message: err.message, code: 500 });
    }
});
exports.default = router;
//# sourceMappingURL=audit.js.map