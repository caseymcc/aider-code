import * as vscode from 'vscode';

import {AiderInterface} from './aiderInterface';
import {AiderWebview} from './aiderWebview';
import {Logger} from './logger';

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

export class AiderExtension
{
    private version: any;
    private model: string='';
    private model_weak: string='';

    private aiderInterface: AiderInterface;
    private webview!: AiderWebview;

    private chatHistory: ChatMessage[]=[];
    private answeredPrompts: Set<string>=new Set();

    constructor(context: vscode.ExtensionContext, workingDirectory: string)
    {
        console.log('AiderExtension constructor');

        this.aiderInterface=new AiderInterface(this, workingDirectory);
        
        const webviewDisposable=vscode.commands.registerCommand('aider-code.openAiderChat', () =>
        {
            this.webview=new AiderWebview(this, context);

            this.restoreWebview();
        });
        context.subscriptions.push(webviewDisposable);

//        context.subscriptions.push(
//            vscode.window.registerFileDecorationProvider(provider)
//        );
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

        this.chatHistory.push({type: 'output', message: message});
        this.webview?.addMessageOutput(message);
    }

    public addAssistantMessage(message: string)
    {
        Logger.log(`addAssistantMessage: ${message}`);

        this.chatHistory.push({type: 'assistant', message: message});
        this.webview?.addMessageAssistant(message);
    }

    public addAssistantStream(message: string, final: boolean)
    {
        Logger.log(`addAssistantStream: ${message} (final: ${final})`);

        if(final)
        {
            this.chatHistory.push({type: 'assistant', message: message});
        }
        this.webview?.updateStreamMessage(message, final);
    }

    public addUserMessage(message: string)
    {
        Logger.log(`addMessageUser: ${message}`);

        this.chatHistory.push({type: 'user', message: message});
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