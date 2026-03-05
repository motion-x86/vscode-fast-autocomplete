import * as vscode from 'vscode';
import { Config } from './config';
import { Keychain } from './keychain';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewId = 'fastAutocomplete.sidebar';

    private _view?: vscode.WebviewView;

    constructor(private readonly _context: vscode.ExtensionContext) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._buildHtml();

        webviewView.webview.onDidReceiveMessage(async (msg: { command: string; provider?: string; apiKey?: string }) => {
            switch (msg.command) {
                case 'setApiKey':
                    if (msg.provider && msg.apiKey) {
                        await Keychain.setKey(msg.provider, msg.apiKey);
                        vscode.window.showInformationMessage(
                            `Fast Autocomplete: API key saved for ${msg.provider}.`
                        );
                        this.refresh();
                    }
                    break;
                case 'selectProvider':
                    if (msg.provider) {
                        await vscode.workspace.getConfiguration('fastAutocomplete')
                            .update('provider', msg.provider, vscode.ConfigurationTarget.Global);
                        this.refresh();
                    }
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand(
                        'workbench.action.openSettings',
                        'fastAutocomplete'
                    );
                    break;
            }
        });
    }

    refresh(): void {
        if (this._view) {
            this._view.webview.html = this._buildHtml();
        }
    }

    private _buildHtml(): string {
        const provider  = Config.provider();
        const model     = Config.model();
        const streaming = Config.streaming();

        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 12px;
    margin: 0;
  }
  h3 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; }
  label { display: block; margin: 8px 0 4px; font-size: 12px; }
  select, input[type="password"], input[type="text"] {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 4px 6px;
    border-radius: 2px;
    font-size: 12px;
  }
  button {
    margin-top: 8px;
    width: 100%;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  .section { margin-bottom: 20px; }
  .hint { font-size: 11px; opacity: 0.6; margin-top: 4px; }
  .badge {
    display: inline-block;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 10px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    margin-left: 6px;
  }
</style>
</head>
<body>
<div class="section">
  <h3>Provider</h3>
  <label for="provider">Active provider</label>
  <select id="provider" onchange="selectProvider(this.value)">
    <option value="claude"  ${provider === 'claude'  ? 'selected' : ''}>Claude (Anthropic)</option>
    <option value="openai"  ${provider === 'openai'  ? 'selected' : ''}>OpenAI</option>
  </select>
  <p class="hint">Model: ${model} · Streaming: ${streaming ? 'on' : 'off'}</p>
</div>

<div class="section">
  <h3>API Keys</h3>
  <label for="apiKey">API key for <strong>${provider}</strong></label>
  <input type="password" id="apiKey" placeholder="Paste your API key…" />
  <button onclick="saveApiKey()">Save Key</button>
  <p class="hint">Stored securely in VS Code's secret storage.</p>
</div>

<div class="section">
  <button onclick="openSettings()">⚙ Open Settings</button>
</div>

<script>
const vscode = acquireVsCodeApi();

function selectProvider(value) {
  vscode.postMessage({ command: 'selectProvider', provider: value });
}

function saveApiKey() {
  const provider = document.getElementById('provider').value;
  const apiKey   = document.getElementById('apiKey').value.trim();
  if (!apiKey) return;
  vscode.postMessage({ command: 'setApiKey', provider, apiKey });
  document.getElementById('apiKey').value = '';
}

function openSettings() {
  vscode.postMessage({ command: 'openSettings' });
}
</script>
</body>
</html>`;
    }
}
