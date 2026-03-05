import { Config } from './config';

interface RedactPattern {
    pattern:     string;
    replacement: string;
    flags?:      string;
}

export function redact(code: string): string {
    let out = code;

    if (Config.privacy.redactComments()) {
        // Single-line comments
        out = out.replace(/\/\/[^\n]*/g, '// [redacted]');
        out = out.replace(/#[^\n]*/g, '# [redacted]');
        // Multi-line comments
        out = out.replace(/\/\*[\s\S]*?\*\//g, '/* [redacted] */');
        out = out.replace(/"""[\s\S]*?"""/g, '"""[redacted]"""');
        out = out.replace(/'''[\s\S]*?'''/g, "'''[redacted]'''");
    }

    if (Config.privacy.redactStringLiterals()) {
        out = out.replace(/"(?:[^"\\]|\\.)*"/g, '"[redacted]"');
        out = out.replace(/'(?:[^'\\]|\\.)*'/g, "'[redacted]'");
        out = out.replace(/`(?:[^`\\]|\\.)*`/g, '`[redacted]`');
    }

    for (const entry of Config.privacy.redactPatterns()) {
        if (typeof entry === 'string') {
            out = out.split(entry).join('[redacted]');
        } else {
            const p = entry as RedactPattern;
            try {
                const re = new RegExp(p.pattern, p.flags ?? 'g');
                out = out.replace(re, p.replacement ?? '[redacted]');
            } catch {
                // invalid regex — skip
            }
        }
    }

    return out;
}
