import * as vscode from 'vscode';

const KEY_PREFIX = 'fastAutocomplete.apiKey';

export class Keychain {
    private static secrets: vscode.SecretStorage;

    static initialize(secrets: vscode.SecretStorage): void {
        Keychain.secrets = secrets;
    }

    static async getKey(provider: string): Promise<string | undefined> {
        return Keychain.secrets.get(`${KEY_PREFIX}.${provider}`);
    }

    static async setKey(provider: string, apiKey: string): Promise<void> {
        await Keychain.secrets.store(`${KEY_PREFIX}.${provider}`, apiKey);
    }

    static async deleteKey(provider: string): Promise<void> {
        await Keychain.secrets.delete(`${KEY_PREFIX}.${provider}`);
    }
}
