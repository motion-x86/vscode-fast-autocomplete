import * as vscode from 'vscode';
import { Keychain } from './keychain';
import { StatusBar } from './statusBar';
import { SidebarProvider } from './sidebarProvider';
import { FastAutocompleteInlineProvider, initCompletionHandler, trigger, accept, dismiss, hasPending, isStreaming } from './completionHandler';
import { Config } from './config';

export function activate(context: vscode.ExtensionContext): void {

    // Core services
    Keychain.initialize(context.secrets);
    StatusBar.initialize(context);
    initCompletionHandler(context);

    // Keep fastAutocomplete.streaming context key in sync so spacebar when-clause works
    const updateStreamingContext = () =>
        vscode.commands.executeCommand('setContext', 'fastAutocomplete.streaming', isStreaming());

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(() => updateStreamingContext()),
    );

    // Inline completion provider
    context.subscriptions.push(
        vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**' },
            new FastAutocompleteInlineProvider(),
        )
    );

    // Sidebar
    const sidebar = new SidebarProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, sidebar)
    );

    // Commands
    context.subscriptions.push(

        vscode.commands.registerCommand('fastAutocomplete.trigger', () => trigger()),

        vscode.commands.registerCommand('fastAutocomplete.accept', () => accept()),

        vscode.commands.registerCommand('fastAutocomplete.dismiss', () => dismiss()),

        vscode.commands.registerCommand('fastAutocomplete.next', () => trigger(true)),

        vscode.commands.registerCommand('fastAutocomplete.setApiKey.claude', async () => {
            const key = await vscode.window.showInputBox({
                title: 'Fast Autocomplete: Set Claude API Key',
                prompt: 'Enter your Anthropic API key',
                password: true,
                ignoreFocusOut: true,
                validateInput: v => v.trim() ? null : 'API key cannot be empty',
            });
            if (key) {
                await Keychain.setKey('claude', key.trim());
                vscode.window.showInformationMessage('Fast Autocomplete: Claude API key saved.');
                sidebar.refresh();
            }
        }),

        vscode.commands.registerCommand('fastAutocomplete.setApiKey.openai', async () => {
            const key = await vscode.window.showInputBox({
                title: 'Fast Autocomplete: Set OpenAI API Key',
                prompt: 'Enter your OpenAI API key',
                password: true,
                ignoreFocusOut: true,
                validateInput: v => v.trim() ? null : 'API key cannot be empty',
            });
            if (key) {
                await Keychain.setKey('openai', key.trim());
                vscode.window.showInformationMessage('Fast Autocomplete: OpenAI API key saved.');
                sidebar.refresh();
            }
        }),

        vscode.commands.registerCommand('fastAutocomplete.selectProvider', async () => {
            const choice = await vscode.window.showQuickPick(
                [
                    { label: 'Claude (Anthropic)', value: 'claude' },
                    { label: 'OpenAI',             value: 'openai' },
                ],
                { title: 'Fast Autocomplete: Select Provider' }
            );
            if (choice) {
                await vscode.workspace.getConfiguration('fastAutocomplete')
                    .update('provider', choice.value, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(
                    `Fast Autocomplete: Provider set to ${choice.label}.`
                );
                sidebar.refresh();
            }
        }),

        vscode.commands.registerCommand('fastAutocomplete.toggleStreaming', async () => {
            const current = Config.streaming();
            await vscode.workspace.getConfiguration('fastAutocomplete')
                .update('streaming', !current, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(
                `Fast Autocomplete: Streaming ${!current ? 'enabled' : 'disabled'}.`
            );
        }),

        vscode.commands.registerCommand('fastAutocomplete.resetPrompts', async () => {
            const cfg = vscode.workspace.getConfiguration('fastAutocomplete');
            await cfg.update('systemPrompt',           '', vscode.ConfigurationTarget.Global);
            await cfg.update('completionInstruction',  '', vscode.ConfigurationTarget.Global);
            await cfg.update('alternateInstruction',   '', vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Fast Autocomplete: Prompts reset to defaults.');
        }),

    );

    // Keybinding: Tab to accept, Escape to dismiss — only when ghost text is pending
    context.subscriptions.push(
        vscode.commands.registerCommand('fastAutocomplete._acceptIfPending', () => {
            if (hasPending()) {
                accept();
            } else {
                vscode.commands.executeCommand('tab');
            }
        }),
        vscode.commands.registerCommand('fastAutocomplete._dismissIfPending', () => {
            if (hasPending()) {
                dismiss();
            } else {
                vscode.commands.executeCommand('escape');
            }
        }),
    );

    if (Config.debug()) {
        console.log('[fast-autocomplete] Extension activated.');
    }
}

export function deactivate(): void {
    dismiss();
}