(function initializeFinancesLogger(window, document) {
    const LEVELS = ['debug', 'info', 'warn', 'error'];
    const LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };
    const LEVEL_STORAGE_KEY = 'finances_log_level';
    const SENSITIVE_KEY_PATTERN = /password|passwd|token|secret|authorization|cookie|email|amount|balance|transaction|description|(^|_)desc|account|bank|image|photo|base64/i;
    const environment = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)
        ? 'development'
        : 'production';

    function readLevel() {
        try {
            const storedLevel = window.localStorage.getItem(LEVEL_STORAGE_KEY);
            if (LEVELS.includes(storedLevel)) return storedLevel;
        } catch {
            // Logging should continue if browser storage is unavailable.
        }
        return environment === 'development' ? 'debug' : 'warn';
    }

    function redactString(value) {
        return value
            .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
            .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
            .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]');
    }

    function sanitize(value, key, seen, depth) {
        if (key && SENSITIVE_KEY_PATTERN.test(key)) return '[REDACTED]';
        if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string') return redactString(value.slice(0, 1000));
        if (typeof value === 'bigint') return value.toString();
        if (typeof value !== 'object') return String(value);
        if (depth >= 5) return '[MaxDepth]';
        if (seen.has(value)) return '[Circular]';

        seen.add(value);
        if (value instanceof Error) {
            return {
                name: value.name,
                message: redactString(String(value.message || '').slice(0, 1000)),
                code: value.code ? String(value.code) : undefined
            };
        }
        if (Array.isArray(value)) {
            return value.slice(0, 50).map(item => sanitize(item, '', seen, depth + 1));
        }

        const result = {};
        Object.keys(value).slice(0, 50).forEach(property => {
            result[property] = sanitize(value[property], property, seen, depth + 1);
        });
        return result;
    }

    function createSessionId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const sessionId = createSessionId();
    let activeLevel = readLevel();

    function write(level, event, details, error) {
        if (!LEVELS.includes(level) || LEVEL_PRIORITY[level] < LEVEL_PRIORITY[activeLevel]) return;

        const safeDetails = sanitize(details || {}, '', new WeakSet(), 0);
        const entry = {
            ...safeDetails,
            timestamp: new Date().toISOString(),
            level,
            event: String(event || 'unspecified_event'),
            app: 'fin-flow',
            environment,
            page: window.location.pathname,
            sessionId,
            uid: window.auth && window.auth.currentUser ? window.auth.currentUser.uid : null
        };

        if (error !== undefined && error !== null) {
            const safeError = sanitize(error, 'error', new WeakSet(), 0);
            entry.error = safeError && typeof safeError === 'object'
                ? safeError
                : { message: String(safeError) };
        }

        const output = window.console[level] || window.console.log;
        output.call(window.console, JSON.stringify(entry));
    }

    const logger = {
        debug(event, details) {
            write('debug', event, details);
        },
        info(event, details) {
            write('info', event, details);
        },
        warn(event, details) {
            write('warn', event, details);
        },
        error(event, error, details) {
            write('error', event, details, error);
        },
        getLevel() {
            return activeLevel;
        },
        setLevel(level) {
            if (!LEVELS.includes(level)) {
                throw new TypeError(`Invalid log level: ${level}`);
            }
            activeLevel = level;
            try {
                window.localStorage.setItem(LEVEL_STORAGE_KEY, level);
            } catch {
                // The selected level remains active for this page session.
            }
        },
        resetLevel() {
            try {
                window.localStorage.removeItem(LEVEL_STORAGE_KEY);
            } catch {
                // The default level remains active for this page session.
            }
            activeLevel = environment === 'development' ? 'debug' : 'warn';
        }
    };

    window.financesLogger = logger;

    window.addEventListener('error', event => {
        logger.error('uncaught_exception', event.error || new Error(event.message), {
            source: event.filename,
            line: event.lineno,
            column: event.colno
        });
    });

    window.addEventListener('unhandledrejection', event => {
        logger.error('unhandled_promise_rejection', event.reason);
    });
})(window, document);
