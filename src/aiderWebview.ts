import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import * as fs from 'fs';
import * as path from 'path';
import {Logger} from './logger';
import { AiderExtension } from './aiderExtension';

interface PanelInfo {
    viewType: string;
    column: vscode.ViewColumn;
}

export class AiderWebview
{
    private panel: vscode.WebviewPanel;
    private app: AiderExtension;
    private debugLogEntries: string[]=[]; // Store debug log entries
    private markdownIt: MarkdownIt=new MarkdownIt();
    private reload: boolean=true;

    constructor(app: AiderExtension, context: vscode.ExtensionContext)
    {
        console.log('AiderWebview constructor');

        this.app=app;
        const panelInfo = this.loadState(context);

        this.panel=vscode.window.createWebviewPanel(
            'aiderWebview',
            'Aider Webview',
            panelInfo.column || vscode.ViewColumn.Two,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'src', 'media')]
            }
        );

        this.panel.webview.html=this.getWebviewContent(context);
        
        // Send stored logs to the webview
        this.sendStoredLogs();
//        this.restoreChatHistory();
        this.restoreDebugLog();

        this.panel.webview.onDidReceiveMessage(
            message =>
            {
                Logger.log(`Chat sent message: ${JSON.stringify(message)}`);
                switch(message.command)
                {
                    case 'sendCommand':
                        this.sendCommandToAider(message.type, message.text);
                        return;
                    case 'promptUserResponse':
                        this.promptUserResponse(message.response);
                        return;
                    case 'interactiveInput':
                        this.app.addInteractiveInput(message.text);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );

        // Restore chat history and debug log when the panel is shown
        this.panel.onDidChangeViewState(e =>
        {
            console.log('AiderWebview state changed');

            if(e.webviewPanel.visible)
            {
                if(this.reload)
                {
//                    this.restoreChatHistory();
                    this.restoreDebugLog();
                    this.reload=false;
                }
            }
        });

        this.panel.onDidDispose(() => {
            this.reload=true;
            this.storeState(context);
        });
    }

    private loadState(context: vscode.ExtensionContext): PanelInfo
    {
        const panelInfo = context.workspaceState.get<PanelInfo>('aiderWebviewPanel');
        return panelInfo || {
            viewType: 'aiderWebview',
            column: vscode.ViewColumn.Two
        };
    }

    private storeState(context: vscode.ExtensionContext): void
    {
        const panelInfo: PanelInfo = {
            viewType: this.panel.viewType,
            column: this.panel.viewColumn || vscode.ViewColumn.Two
        };

        context.workspaceState.update('aiderWebviewPanel', panelInfo);
    }

    private sendStoredLogs()
    {
        const storedLogs=Logger.getStoredLogs();
        storedLogs.forEach(log =>
        {
            this.debugLogEntries.push(log); // Store debug log entries
            this.panel.webview.postMessage({
                command: 'log',
                text: log
            });
        });
    }

//    public restoreChatHistory(): void
//    {
//        // Get chat history from AiderInterface and replay it
//        const history=this.aiderInterface.getChatHistory();
//        history.forEach(msg =>
//        {
//            if(msg.type==='user')
//            {
//                this.addMessageUser(msg.message);
//            }
//            else if(msg.type==='output')
//            {
//                this.addMessageOutput(msg.message);
//            }
//            else if(msg.type==='assistant')
//            {
//                this.addMessageAssistant(msg.message);
//            }
//            // Skip prompts that were already answered
//        });
//    }

    public restoreDebugLog(): void
    {
        this.debugLogEntries.forEach(entry =>
        {
            this.panel.webview.postMessage({
                command: 'log',
                text: entry
            });
        });
    }

    public updateVersion(version: any): void
    {
        this.panel.webview.postMessage({
            command: 'version',
            version: `${version.major}.${version.minor}.${version.patch}`
        });
    }

    public updateModel(model: string): void
    {
        this.panel.webview.postMessage({
            command: 'model',
            model: model
        });
    }

    public updateWeakModel(model: string): void
    {
        this.panel.webview.postMessage({
            command: 'weakModel',
            model: model
        });
    }

    public addMessageUser(text: string): void
    {
        this.panel.webview.postMessage({
            command: 'addMessageUser',
            text: text
        });
    }

    public addMessageOutput(text: string): void
    {
        this.panel.webview.postMessage({
            command: 'addMessageOutput',
            text: text
        });
    }

    public addMessageAssistant(message: string): void
    {
        this.panel.webview.postMessage({
            command: 'addAssistantMessage',
            text: message
        });
    }

    public updateStreamMessage(message: string, final: boolean): void
    {
        const htmlMessage=this.markdownIt.render(message);

        this.panel.webview.postMessage({
            command: 'updateStreamMessage',
            html: htmlMessage,
            final: final
        });
    }

    public respondToQuestion(question: string)
    {
        if(!this.panel) 
        {
            return;
        }

        // Add user message
        this.panel.webview.postMessage({
            command: 'addUserMessage',
            text: question
        });

        // Simulate processing time
        setTimeout(() =>
        {
            // Add response (you'd replace this with actual logic to generate responses)
            const response=`Here's information about "${question}" in CSS...`;
            this.panel.webview.postMessage({
                command: 'addResponse',
                text: response
            });
        }, 1000);
    }

    public promptUser(message: string, defaultValue: string, subject: string): void
    {
        this.panel.webview.postMessage({
            command: 'promptUser',
            text: message,
            defaultValue: defaultValue,
            subject: subject
        });
    }

    private promptUserResponse(response: string): void
    {
        Logger.log(`Received ${response} response from user`);
        this.app.addPromptResponse(response);
    }

    public updateTokenInfo(tokenInfo: any): void {
        this.panel.webview.postMessage({
            command: 'updateTokenInfo',
            tokenInfo: tokenInfo
        });
    }

    public showAutoComplete(completions: string[]): void {
        this.panel.webview.postMessage({
            command: 'showAutoComplete',
            completions: completions
        });
    }

    private getWebviewContent(context: vscode.ExtensionContext): string
    {
        const htmlPath=vscode.Uri.joinPath(context.extensionUri, 'src', 'media', 'aiderWebview.html');
        const cssPath=vscode.Uri.joinPath(context.extensionUri, 'src', 'media', 'styles.css');
        const scriptPath=vscode.Uri.joinPath(context.extensionUri, 'src', 'media', 'aiderWebview.js');
        const markdownPath=vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/markdown-it', 'dist', 'index.js');

        const htmlUri=this.panel.webview.asWebviewUri(htmlPath);
        const cssUri=this.panel.webview.asWebviewUri(cssPath);
        const scriptUri=this.panel.webview.asWebviewUri(scriptPath);
        const markdownUri=this.panel.webview.asWebviewUri(markdownPath);

        let html=fs.readFileSync(htmlPath.fsPath, 'utf8');
        html=html.replace('${cssUri}', cssUri.toString());
        html=html.replace('${scriptUri}', scriptUri.toString());
        html=html.replace('${markdownItUri}', markdownUri.toString());

        return html;
    }

    private async sendCommandToAider(command: string, value: string)
    {
        Logger.log(`Send command to App: ${command}`);

        if(command==='user')
        {
            this.app.addUserMessage(value);
        }
        //        this.aiderInterface.sendCommand(command, value);
        //        try {
        //            const response = await this.aiderInterface.sendCommand(command);
        //            Logger.log(`Received response from Aider: ${response}`);
        //            this.updateChatHistory(response);
        //        } catch (error) {
        //            if (error instanceof Error) {
        //                Logger.log(`Error from Aider: ${error.message}`);
        //            } else {
        //                Logger.log(`Unknown error from Aider`);
        //            }
        //        }
    }
}
