import * as vscode from 'vscode';
import { Config } from './config';
import { redact } from './privacy';

export interface ContextPayload {
    prefix:    string;
    suffix:    string;
    language:  string;
    fileName:  string;
}

export function buildContext(
    document: vscode.TextDocument,
    position: vscode.Position,
): ContextPayload {
    const linesBefore = Config.contextLinesBefore();
    const linesAfter  = Config.contextLinesAfter();

    const prefixStart = Math.max(0, position.line - linesBefore);
    const suffixEnd   = Math.min(document.lineCount - 1, position.line + linesAfter);

    const prefixRange = new vscode.Range(prefixStart, 0, position.line, position.character);
    const suffixRange = new vscode.Range(position, new vscode.Position(suffixEnd, document.lineAt(suffixEnd).text.length));

    const prefix = redact(document.getText(prefixRange));
    const suffix = redact(document.getText(suffixRange));

    // VS Code language IDs use kebab-case — convert to human-readable
    const language = languageLabel(document.languageId);
    const fileName = document.fileName.split('/').pop() ?? document.fileName;

    return { prefix, suffix, language, fileName };
}

function languageLabel(languageId: string): string {
    const map: Record<string, string> = {
        typescript:       'TypeScript',
        javascript:       'JavaScript',
        python:           'Python',
        rust:             'Rust',
        go:               'Go',
        java:             'Java',
        cpp:              'C++',
        c:                'C',
        csharp:           'C#',
        ruby:             'Ruby',
        php:              'PHP',
        swift:            'Swift',
        kotlin:           'Kotlin',
        html:             'HTML',
        css:              'CSS',
        scss:             'SCSS',
        json:             'JSON',
        yaml:             'YAML',
        markdown:         'Markdown',
        shellscript:      'Shell',
        'objective-c':    'Objective-C',
    };
    return map[languageId] ?? languageId;
}
