import * as vscode from 'vscode';
import * as path from 'path';

import { AiderInterface } from './aiderInterface';
import { AiderWebview } from './aiderWebview';
import { Logger } from './logger';

interface ChatMessage
{
    type: 'output'|'assistant'|'prompt'|'user';
    message: string;
    fileName?: string;
    diff?: string;
    defaultValue?: string;
    subject?: string;
    response?: string;
}

type FileFlags={
    write: boolean;
    read: boolean;
};

class AiderFileDecorationProvider implements vscode.FileDecorationProvider
{
    private enabled: boolean=true;

    private addedFiles: Set<string>=new Set();
    private addedReadFiles: Set<string>=new Set();

    private fileFlags: Map<string, FileFlags>=new Map();

    private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri|undefined>=new vscode.EventEmitter<vscode.Uri|undefined>();
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri|undefined>=this._onDidChangeFileDecorations.event;

    public setFiles(workingDirectory: string, addedFiles: Set<string>, addedReadFiles: Set<string>=new Set())
    {
        // Update existing flags and add new ones
        addedFiles.forEach(file =>
        {
            const fullPath=path.join(workingDirectory, file);
            const isReadOnly=addedReadFiles.has(fullPath);

            if(this.fileFlags.has(fullPath))
            {
                const existingFlags=this.fileFlags.get(fullPath)!;
                if(existingFlags.write!==!isReadOnly||existingFlags.read!==true)
                {
                    this.fileFlags.set(fullPath, { write: !isReadOnly, read: true });
//                    vscode.commands.executeCommand('setContext', `aider-code.isAdded.${this.getContextKey(uri)}`, true);
//                    vscode.commands.executeCommand('setContext', `aider-code.isAdded.${fullPath}`, true);
//                    vscode.commands.executeCommand('setContext', `aider-code.isAddedReadOnly.${fullPath}`, isReadOnly);
                }
            } 
            else
            {
                this.fileFlags.set(fullPath, { write: !isReadOnly, read: true });
//                vscode.commands.executeCommand('setContext', `aider-code.isAdded.${fullPath}`, true);
//                vscode.commands.executeCommand('setContext', `aider-code.isAddedReadOnly.${fullPath}`, isReadOnly);
            }
        });

        // Remove entries that are no longer in addedFiles or addedReadFiles
        this.fileFlags.forEach((_, key) =>
        {
            const relativePath=path.relative(workingDirectory, key);
            if(!addedFiles.has(relativePath))
            {
                const fullPath=path.join(workingDirectory, key);

//                vscode.commands.executeCommand('setContext', `aider-code.isAdded.${fullPath}`, false);
//                vscode.commands.executeCommand('setContext', `aider-code.isAddedReadOnly.${fullPath}`, false);
                this.fileFlags.delete(key);
            }
        });
        this._onDidChangeFileDecorations.fire(undefined);
    }

    public isAdded(uri: vscode.Uri): boolean
    {
        console.log(`isAdded: ${uri.fsPath}`);

        const fileFlags=this.fileFlags.get(uri.fsPath);

        if(fileFlags)
        {
            return fileFlags.write;
        }
        return false;
    }

//    public isAddedReadOnly(uri: vscode.Uri): boolean
//    {
//        console.log(`isAddedReadOnly: ${uri.fsPath}`);
//
//        const fileFlags=this.fileFlags.get(uri.fsPath);
//
//        if(fileFlags)
//        {
//            return !fileFlags.write&&fileFlags.read;
//        }
//        return false;
//    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration|undefined
    {
        if(!this.enabled)
        {
            return undefined;
        }

        const fileFlags=this.fileFlags.get(uri.fsPath);

        if(fileFlags)
        {
            if(!fileFlags.write)
            {
                return {
                    badge: '👁️',
                    color: new vscode.ThemeColor('charts.green'),
                    propagate: false,
                    tooltip: 'Aider (added readonly)'
                };
            }
            else
            {
                return {
                    badge: '🤖',
                    color: new vscode.ThemeColor('charts.green'),
                    propagate: false,
                    tooltip: 'Aider (added)'
                };
            }
        }
        return undefined;
    }

    toggleDecoration(): void
    {
        this.enabled=!this.enabled;
        this._onDidChangeFileDecorations.fire(undefined);
    }
}


export class AiderExtension
{
    private version: any;
    private model: string='';
    private model_weak: string='';

    private aiderInterface: AiderInterface;
    private webview!: AiderWebview;
    private fileDecorationProvider: AiderFileDecorationProvider;

    private chatHistory: ChatMessage[]=[];
    private answeredPrompts: Set<string>=new Set();

    private workingDirectory: string='';

    constructor(context: vscode.ExtensionContext, workingDirectory: string)
    {
        console.log('AiderExtension constructor');

        this.workingDirectory=workingDirectory;
        this.aiderInterface=new AiderInterface(this, workingDirectory);

        const webviewDisposable=vscode.commands.registerCommand('aider-code.openChat', () =>
        {
            this.webview=new AiderWebview(this, context);

            this.restoreWebview();
        });
        context.subscriptions.push(webviewDisposable);

        this.fileDecorationProvider=new AiderFileDecorationProvider();

        context.subscriptions.push(
            vscode.window.registerFileDecorationProvider(this.fileDecorationProvider)
        );
        let toggleDisposable=vscode.commands.registerCommand('aider-code.toggleFileDecorator', () =>
        {
            this.fileDecorationProvider.toggleDecoration();
        });
        context.subscriptions.push(toggleDisposable);

        context.subscriptions.push(
            vscode.commands.registerCommand('aider-code.isAdded', (uri: vscode.Uri) => {
                console.log(`aider-code.isAdded: ${uri.fsPath}`);
                return this.fileDecorationProvider.isAdded(uri);
            })
        );
//         context.subscriptions.push(
//            vscode.commands.registerCommand('_aider-code.isAddedReadOnly', (uri: vscode.Uri) => {
//                return this.fileDecorationProvider.isAddedReadOnly(uri);
//            })
//        );

        let addFile=vscode.commands.registerCommand('aider-code.explorer-context-menu.add', (uri: vscode.Uri) =>
        {
            this.aiderInterface.sendCommand('/add', uri.fsPath);
        });

        let addReadOnlyFile=vscode.commands.registerCommand('aider-code.explorer-context-menu.addReadOnly', (uri: vscode.Uri) =>
        {
            this.aiderInterface.sendCommand('/readonly', uri.fsPath);
        });

        let removeFile=vscode.commands.registerCommand('aider-code.explorer-context-menu.remove', (uri: vscode.Uri) =>
        {
            this.aiderInterface.sendCommand('/drop', uri.fsPath);
        });

        context.subscriptions.push(addFile);
        context.subscriptions.push(addReadOnlyFile);
        context.subscriptions.push(removeFile);
    }

    public setVersion(version: string)
    {
        Logger.log(`setVersion: ${version}`);

        this.version=version;
        this.webview?.updateVersion(version);
    }

    public setModel(model: string)
    {
        Logger.log(`setModel: ${model}`);

        this.model=model;
        this.webview?.updateModel(model);
    }

    public setWeakModel(model: string)
    {
        Logger.log(`setWeakModel: ${model}`);

        this.model_weak=model;
        this.webview?.updateWeakModel(model);
    }

    public addMessage(message: string)
    {
        Logger.log(`addMessage: ${message}`);

        this.chatHistory.push({ type: 'output', message: message });
        this.webview?.addMessageOutput(message);
    }

    public addAssistantMessage(message: string)
    {
        Logger.log(`addAssistantMessage: ${message}`);

        this.chatHistory.push({ type: 'assistant', message: message });
        this.webview?.addMessageAssistant(message);
    }

    public addAssistantStream(message: string, final: boolean)
    {
        Logger.log(`addAssistantStream: ${message} (final: ${final})`);

        if(final)
        {
            this.chatHistory.push({ type: 'assistant', message: message });
        }
        this.webview?.updateStreamMessage(message, final);
    }

    public addUserMessage(message: string)
    {
        Logger.log(`addMessageUser: ${message}`);

        this.chatHistory.push({ type: 'user', message: message });
        this.webview?.addMessageUser(message);
        this.aiderInterface.sendCommand('user', message);
    }

    public addInteractiveInput(text: string): void
    {
        this.aiderInterface.sendCommand("interactive", text);
    }

    public addTokenInfo(tokenInfo: any)
    {
        Logger.log(`addTokenInfo: ${JSON.stringify(tokenInfo)}`);

        this.webview?.updateTokenInfo(tokenInfo);
    }

    public addPrompt(prompt: any)
    {
        Logger.log(`addPrompt: ${prompt.subject}: ${prompt.message}`);
        const promptKey=`${prompt.message}-${prompt.subject}`;

        if(!this.answeredPrompts.has(promptKey))
        {
            this.chatHistory.push({
                type: 'prompt',
                message: prompt.message,
                defaultValue: prompt.defaultValue,
                subject: prompt.subject
            });
            this.webview?.promptUser(prompt.message, prompt.defaultValue, prompt.subject);
        }
    }

    public addPromptResponse(response: any)
    {
        Logger.log(`promptUserResponse: ${response}`);

        for(let i=this.chatHistory.length-1; i>=0; i--)
        {
            if(this.chatHistory[i].type==='prompt')
            {
                this.chatHistory[i].response=response;
                this.webview?.addMessageOutput(`${this.chatHistory[i].message} ${response}`);
                const promptKey=`${this.chatHistory[i].message}-${this.chatHistory[i].subject}`;
                this.answeredPrompts.add(promptKey);
                break;
            }
        }
        this.aiderInterface.sendCommand("prompt_response", response);
    }

    public addAutoCompleteOptions(options: any)
    {
        Logger.log(`addAutoCompleteOptions: ${JSON.stringify(options)}`);

        this.webview?.showAutoComplete(options);
    }

    public updateFileList(files: any)
    {
        Logger.log(`updateFileList: ${JSON.stringify(files)}`);

        const addedFiles=new Set<string>(files.added);
        const addedReadonlyFiles=new Set<string>(files.added_readonly);

        this.fileDecorationProvider.setFiles(this.workingDirectory, addedFiles, addedReadonlyFiles);
    }

    public restoreWebview()
    {
        if(!this.webview)
        {
            return;
        }

        this.chatHistory.forEach(msg =>
        {
            if(msg.type==='user')
            {
                this.webview.addMessageUser(msg.message);
            }
            else if(msg.type==='output')
            {
                this.webview.addMessageOutput(msg.message);
            }
            else if(msg.type==='assistant')
            {
                this.webview.addMessageAssistant(msg.message);
            }
            // Skip prompts that were already answered
        });
    }

}