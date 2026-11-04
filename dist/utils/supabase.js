"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabase = getSupabase;
// src/utils/supabase.ts
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../config");
const logger_1 = require("./logger");
let supabaseInstance = null;
function getSupabase() {
    if (!supabaseInstance) {
        supabaseInstance = (0, supabase_js_1.createClient)(config_1.config.supabase.url, config_1.config.supabase.serviceKey, {
            auth: { persistSession: false },
        });
        logger_1.logger.info('Supabase client initialized', { url: config_1.config.supabase.url });
    }
    return supabaseInstance;
}
//# sourceMappingURL=supabase.js.map