import { ContextPayload } from '../contextBuilder';
import { BaseProvider, AuthError, RateLimitError, ProviderError } from './base';
import { Config } from '../config';

const API_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider extends BaseProvider {

    async complete(ctx: ContextPayload, maxTokens: number, alternate = false): Promise<string> {
        const { system, user } = this.buildMessages(ctx, alternate);

        const response = await this.withTimeout(fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                ...this.noRetentionHeaders(),
            },
            body: JSON.stringify({
                model: Config.model(),
                max_tokens: maxTokens,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user',   content: user },
                ],
            }),
        }));

        await this.assertOk(response);
        const data = await response.json() as { choices: Array<{ message: { content: string } }> };
        return data.choices[0]?.message?.content ?? '';
    }

    async *completeStream(ctx: ContextPayload, maxTokens: number, alternate = false): AsyncGenerator<string> {
        const { system, user } = this.buildMessages(ctx, alternate);

        const response = await this.withTimeout(fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                ...this.noRetentionHeaders(),
            },
            body: JSON.stringify({
                model: Config.model(),
                max_tokens: maxTokens,
                stream: true,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user',   content: user },
                ],
            }),
        }));

        await this.assertOk(response);

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (raw === '[DONE]') return;
                try {
                    const evt = JSON.parse(raw);
                    const delta = evt.choices?.[0]?.delta?.content;
                    if (delta) yield delta as string;
                } catch { /* skip malformed */ }
            }
        }
    }

    private async assertOk(response: Response): Promise<void> {
        if (response.ok) return;
        const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
        const msg = body?.error?.message ?? response.statusText;
        if (response.status === 401) throw new AuthError(msg);
        if (response.status === 429) throw new RateLimitError(msg);
        throw new ProviderError(`HTTP ${response.status}: ${msg}`);
    }
}
