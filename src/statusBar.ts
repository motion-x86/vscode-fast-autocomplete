import * as vscode from 'vscode';
import { Config } from './config';

type StatusState = 'idle' | 'requesting' | 'visible' | 'error';

export class StatusBar {
    private static item: vscode.StatusBarItem;

    static initialize(context: vscode.ExtensionContext): void {
        StatusBar.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100,
        );
        StatusBar.item.command = 'fastAutocomplete.trigger';
        StatusBar.setState('idle');
        StatusBar.item.show();
        context.subscriptions.push(StatusBar.item);
    }

    static setState(state: StatusState, detail?: string): void {
        const provider = Config.provider().toUpperCase();
        switch (state) {
            case 'idle':
                StatusBar.item.text    = `$(sparkle) FA`;
                StatusBar.item.tooltip = `Fast Autocomplete [${provider}] — Click or Ctrl+Space to trigger`;
                StatusBar.item.color   = undefined;
                break;
            case 'requesting':
                StatusBar.item.text    = `$(loading~spin) FA`;
                StatusBar.item.tooltip = `Fast Autocomplete — Requesting…`;
                StatusBar.item.color   = new vscode.ThemeColor('statusBarItem.prominentForeground');
                break;
            case 'visible':
                StatusBar.item.text    = `$(check) FA`;
                StatusBar.item.tooltip = `Fast Autocomplete — Tab to accept · Escape to dismiss`;
                StatusBar.item.color   = new vscode.ThemeColor('statusBarItem.prominentForeground');
                break;
            case 'error':
                StatusBar.item.text    = `$(error) FA`;
                StatusBar.item.tooltip = `Fast Autocomplete — Error: ${detail ?? 'unknown'}`;
                StatusBar.item.color   = new vscode.ThemeColor('statusBarItem.errorForeground');
                break;
        }
    }
}
