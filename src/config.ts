import * as vscode from 'vscode';
import {
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_COMPLETION_INSTRUCTION,
    DEFAULT_ALTERNATE_INSTRUCTION,
} from './constants';

const SECTION = 'fastAutocomplete';

function get<T>(key: string, fallback: T): T {
    return vscode.workspace.getConfiguration(SECTION).get<T>(key, fallback);
}

export const Config = {
    provider:               () => get<string>('provider', 'claude'),
    model:                  () => get<string>('model', 'claude-sonnet-4-20250514'),
    maxCompletionTokens:    () => get<number>('maxCompletionTokens', 128),
    contextLinesBefore:     () => get<number>('contextLinesBefore', 50),
    contextLinesAfter:      () => get<number>('contextLinesAfter', 10),
    streaming:              () => get<boolean>('streaming', false),
    requestTimeoutSeconds:  () => get<number>('requestTimeoutSeconds', 10),
    maxRetries:             () => get<number>('maxRetries', 2),
    debug:                  () => get<boolean>('debug', false),

    systemPrompt: () => {
        const v = get<string>('systemPrompt', '');
        return v.trim() || DEFAULT_SYSTEM_PROMPT;
    },
    completionInstruction: () => {
        const v = get<string>('completionInstruction', '');
        return v.trim() || DEFAULT_COMPLETION_INSTRUCTION;
    },
    alternateInstruction: () => {
        const v = get<string>('alternateInstruction', '');
        return v.trim() || DEFAULT_ALTERNATE_INSTRUCTION;
    },

    privacy: {
        redactComments:       () => get<boolean>('privacy.redactComments', false),
        redactStringLiterals: () => get<boolean>('privacy.redactStringLiterals', false),
        noRetention:          () => get<boolean>('privacy.noRetention', false),
        redactPatterns:       () => get<unknown[]>('privacy.redactPatterns', []),
    },
};
