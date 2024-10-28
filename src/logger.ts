import * as vscode from 'vscode';

export class Logger {
    private static panel: vscode.WebviewPanel | null = null;
    private static logEntries: string[] = [];

    static setPanel(panel: vscode.WebviewPanel) {
        Logger.panel = panel;
    }

    static log(message: string) {
        console.log(message);
        Logger.logEntries.push(message);
        if (Logger.panel) {
            Logger.panel.webview.postMessage({
                command: 'log',
                text: message
            });
        }
    }

    static getStoredLogs(): string[] {
        return Logger.logEntries;
    }
}