import * as vscode from 'vscode';
import { buildContext } from './contextBuilder';
import { BaseProvider, AuthError, RateLimitError, ProviderTimeout, ProviderError } from './providers/base';
import { ClaudeProvider } from './providers/claude';
import { OpenAIProvider } from './providers/openai';
import { Keychain } from './keychain';
import { Config } from './config';
import { StatusBar } from './statusBar';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface PendingCompletion {
    text:     string;
    position: vscode.Position;
    document: vscode.TextDocument;
}

let _pending:         PendingCompletion | null = null;
let _abortController: AbortController   | null = null;
let _streaming:       boolean                  = false;
let _outputChannel:   vscode.OutputChannel;

// Fires to re-query inline completions without triggering the full suggest
// flow — no flicker during streaming updates
const _onDidChange = new vscode.EventEmitter<void>();

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

async function getProvider(): Promise<BaseProvider | null> {
    const providerName = Config.provider();
    const apiKey = await Keychain.getKey(providerName);
    if (!apiKey) {
        vscode.window.showErrorMessage(
            `Fast Autocomplete: No API key set for ${providerName}. ` +
            `Run "FastAutocomplete: Set API Key (${providerName})" from the command palette.`
        );
        return null;
    }
    return providerName === 'claude'
        ? new ClaudeProvider(apiKey)
        : new OpenAIProvider(apiKey);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initCompletionHandler(context: vscode.ExtensionContext): void {
    _outputChannel = vscode.window.createOutputChannel('Fast Autocomplete');
    context.subscriptions.push(_outputChannel);

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(e => {
            if (!_pending) return;
            const pos = e.selections[0]?.active;
            if (!pos || !pos.isEqual(_pending.position)) {
                dismiss();
            }
        }),
        vscode.workspace.onDidChangeTextDocument(e => {
            if (!_pending) return;
            if (e.document.uri.toString() === _pending.document.uri.toString()) {
                dismiss();
            }
        }),
    );
}

export async function trigger(alternate = false): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    cancel();

    const provider = await getProvider();
    if (!provider) return;

    const position  = editor.selection.active;
    const context   = buildContext(editor.document, position);
    const maxTokens = Config.maxCompletionTokens();

    _abortController = new AbortController();
    const signal     = _abortController.signal;
    StatusBar.setState('requesting');

    // Seed pending so the provider is active before first chunk arrives
    _pending = { text: '', position, document: editor.document };
    await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');

    try {
        if (Config.streaming()) {
            _streaming = true;
            vscode.commands.executeCommand('setContext', 'fastAutocomplete.streaming', true);
            let accumulated = '';

            for await (const chunk of provider.completeStream(context, maxTokens, alternate)) {
                if (signal.aborted) return;
                accumulated += chunk;
                _updatePending(editor.document, position, accumulated);
            }

            _streaming = false;
            vscode.commands.executeCommand('setContext', 'fastAutocomplete.streaming', false);
            if (signal.aborted) return;

            if (accumulated) {
                StatusBar.setState('visible');
            } else {
                dismiss();
            }

        } else {
            const text = await provider.complete(context, maxTokens, alternate);
            if (signal.aborted) return;
            if (text) {
                _updatePending(editor.document, position, text);
                StatusBar.setState('visible');
            } else {
                dismiss();
            }
        }

        if (Config.debug()) {
            _outputChannel.appendLine(
                `[fast-autocomplete] completion: ${JSON.stringify(_pending?.text ?? '')}`
            );
        }

    } catch (err) {
        _streaming = false;
        vscode.commands.executeCommand('setContext', 'fastAutocomplete.streaming', false);
        dismiss();
        handleError(err);
    }
}

export async function accept(): Promise<void> {
    if (!_pending) return;
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Cancel stream and accept whatever arrived so far
    if (_streaming) {
        cancel();
        _streaming = false;
    }

    const { text, position } = _pending;
    if (!text) { dismiss(); return; }

    _pending = null;
    _onDidChange.fire();

    await editor.edit(editBuilder => {
        editBuilder.insert(position, text);
    });

    StatusBar.setState('idle');
}

export function dismiss(): void {
    _streaming = false;
    vscode.commands.executeCommand('setContext', 'fastAutocomplete.streaming', false);
    _pending   = null;
    cancel();
    _onDidChange.fire();
    StatusBar.setState('idle');
}

export function cancel(): void {
    if (_abortController) {
        _abortController.abort();
        _abortController = null;
    }
}

export function hasPending(): boolean {
    return _pending !== null && _pending.text.length > 0;
}

export function isStreaming(): boolean {
    return _streaming;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function _updatePending(
    document: vscode.TextDocument,
    position: vscode.Position,
    text: string,
): void {
    _pending = { text, position, document };
    _onDidChange.fire();
}

// ---------------------------------------------------------------------------
// InlineCompletionItemProvider
// ---------------------------------------------------------------------------

export class FastAutocompleteInlineProvider implements vscode.InlineCompletionItemProvider {

    onDidChangeInlineCompletionItems = _onDidChange.event;

    provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.InlineCompletionList | null {
        if (
            !_pending ||
            !_pending.text ||
            _pending.document.uri.toString() !== document.uri.toString() ||
            !position.isEqual(_pending.position)
        ) {
            return null;
        }

        return {
            items: [
                new vscode.InlineCompletionItem(
                    _pending.text,
                    new vscode.Range(position, position),
                ),
            ],
            suppressSuggestions: true,
        };
    }
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function handleError(err: unknown): void {
    if (err instanceof AuthError) {
        const provider = Config.provider();
        vscode.window.showErrorMessage(
            `Fast Autocomplete: Authentication failed. ` +
            `Run "FastAutocomplete: Set API Key (${provider})" to update your key.`
        );
        StatusBar.setState('error', 'auth failed');
    } else if (err instanceof RateLimitError) {
        vscode.window.showWarningMessage(`Fast Autocomplete: Rate limit hit. Try again shortly.`);
        StatusBar.setState('error', 'rate limit');
    } else if (err instanceof ProviderTimeout) {
        vscode.window.showWarningMessage(`Fast Autocomplete: Request timed out.`);
        StatusBar.setState('error', 'timeout');
    } else if (err instanceof ProviderError) {
        vscode.window.showErrorMessage(`Fast Autocomplete: ${(err as Error).message}`);
        StatusBar.setState('error', (err as Error).message);
    } else {
        vscode.window.showErrorMessage(`Fast Autocomplete: Unexpected error — ${String(err)}`);
        StatusBar.setState('error', String(err));
    }
}