import { ContextPayload } from '../contextBuilder';
import { Config } from '../config';

export class ProviderError     extends Error { constructor(msg: string) { super(msg); this.name = 'ProviderError'; } }
export class AuthError         extends ProviderError { constructor(msg: string) { super(msg); this.name = 'AuthError'; } }
export class RateLimitError    extends ProviderError { constructor(msg: string) { super(msg); this.name = 'RateLimitError'; } }
export class ProviderTimeout   extends ProviderError { constructor(msg: string) { super(msg); this.name = 'ProviderTimeout'; } }

export interface StreamChunk { text: string; done: boolean; }

export abstract class BaseProvider {
    constructor(protected readonly apiKey: string) {}

    abstract complete(ctx: ContextPayload, maxTokens: number, alternate?: boolean): Promise<string>;
    abstract completeStream(ctx: ContextPayload, maxTokens: number, alternate?: boolean): AsyncGenerator<string>;

    protected buildMessages(ctx: ContextPayload, alternate: boolean): { system: string; user: string } {
        const system = Config.systemPrompt();

        const instruction = alternate
            ? Config.alternateInstruction()
            : Config.completionInstruction();

        const fileNameClause = ctx.fileName
            ? ` The file is named ${ctx.fileName}.`
            : '';

        const resolved = instruction
            .replace('{language}', ctx.language)
            .replace('{file_name}', ctx.fileName)
            .replace('{file_name_clause}', fileNameClause);

        const user = [
            `<prefix>${ctx.prefix}</prefix>`,
            ctx.suffix ? `<suffix>${ctx.suffix}</suffix>` : '',
            resolved,
        ].filter(Boolean).join('\n');

        return { system, user };
    }

    protected noRetentionHeaders(): Record<string, string> {
        return Config.privacy.noRetention()
            ? { 'X-No-Retention': 'true', 'anthropic-no-training': '1' }
            : {};
    }

    protected withTimeout<T>(promise: Promise<T>): Promise<T> {
        const ms = Config.requestTimeoutSeconds() * 1000;
        return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new ProviderTimeout('Request timed out.')), ms)
            ),
        ]);
    }
}
