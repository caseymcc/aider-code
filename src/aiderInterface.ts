import * as vscode from 'vscode';
import { exec, spawn } from 'child_process';
//import {AiderWebview} from './aiderWebview';
import { AiderExtension } from './aiderExtension';
import { Logger } from './logger';



export class AiderInterface
{
    private outputChannel: vscode.OutputChannel;
    private workingDirectory: string='';
    private app: AiderExtension;
    //    private webview?: AiderWebview;
    private process: any;
//    private chatHistory: ChatMessage[]=[];
    private answeredPrompts: Set<string>=new Set();
    private streamingMessage: boolean=false;

    private command_map: Map<string, (value: any) => void>;

    constructor(app: AiderExtension, workingDirectory: string)
    {
        this.app=app;
        this.workingDirectory=workingDirectory;

        this.outputChannel=vscode.window.createOutputChannel('Aider Interface');
        Logger.log(`Starting in ${this.workingDirectory}...`);

        try
        {
            this.process=spawn('aider', ['--commandio'], {
                cwd: this.workingDirectory,
            });

            if(this.process)
            {
                this.process.stdout.on('data', (data: string) =>
                {
                    this.handleTerminalOutput(data);
                });

                this.process.stderr.on('data', (data: string) =>
                {
                    this.handleTerminalOutput(data);
                });

                this.process.on('error', (error: any) =>
                {
                    Logger.log(`Failed to start the process ${error}`);
                });

                this.process.on('close', (exitCode: any) =>
                {
                    Logger.log(`child process exited with code ${exitCode}`);
                });
            } else
            {
                Logger.log(`Process could not be started.`);
            }
        }
        catch(error)
        {
            Logger.log(`Error starting process: ${error}`);
        }
        Logger.log(`Aider started`);

        this.command_map=new Map<string, (value: any) => void>([
            ["output", this.handleOutput.bind(this)],
            ["assistant", this.handleAssistant.bind(this)],
            ["assistant-stream", this.handleAssistantStream.bind(this)],
            ["version", this.handleVersion.bind(this)],
            ["model", this.handleModel.bind(this)],
            ["weak_model", this.handleWeakModel.bind(this)],
            ["auto_complete", this.handleAutoComplete.bind(this)],
            ["tokens", this.handleTokens.bind(this)],
            ["prompt", this.handlePrompt.bind(this)],
            ["files", this.handleFiles.bind(this)],
        ]);
    }

    private handleOutput(parsedData: any): void
    {
        this.app.addMessage(parsedData.value);
    }

    private handleAssistant(parsedData: any): void
    {
        this.app.addAssistantMessage(parsedData.value);
    }

    private handleAssistantStream(parsedData: any): void
    {
        this.app.addAssistantStream(parsedData.value, parsedData.pos, parsedData.final);
    }

    private handleVersion(parsedData: any): void
    {
        this.app.setVersion(parsedData.value);
    }

    private handleModel(parsedData: any): void
    {
        this.app.setModel(parsedData.value);
    }

    private handleWeakModel(parsedData: any): void
    {
        this.app.setWeakModel(parsedData.value);
    }

    private handleAutoComplete(parsedData: any): void
    {
        this.app.addAutoCompleteOptions(parsedData.value);
    }

    private handleTokens(parsedData: any): void
    {
        this.app.addTokenInfo(parsedData.value);
    }

    private handlePrompt(parsedData: any): void
    {
        this.app.addPrompt({message:parsedData.value, defaultValue:parsedData.default, subject:parsedData.subject});
    }

    private handleFiles(parsedData: any): void
    {
        this.app.updateFileList(parsedData.value);
    }
//    public handleInteractiveInput(text: string): void
//    {
//        this.sendCommand("interactive", text);
//    }

    private handleTerminalOutput(data: any): void
    {
        if(Buffer.isBuffer(data))
        {
            data=data.toString();
        }
        Logger.log(`Received: <${data}>`);

        const lines=data.split(/\r?\n/);

        for(const line of lines)
        {
            Logger.log(`Processing: ${line}`);

            if(line.trim()==='')
            {
                continue;
            }

            try
            {
                const parsedData=JSON.parse(line);
                Logger.log(`Parsed data: ${JSON.stringify(parsedData)}`);

                this.command_map.get(parsedData.cmd)?.(parsedData);
            } catch(error)
            {
                Logger.log(`Error parsing data: ${error}`);
            }
        }
    }

//    public userCommand(message: string): void 
//    {
//        this.chatHistory.push({
//            type: 'user',
//            message: message
//        });
//        this.webview?.addMessageUser(message);
//
//        this.sendCommand("user", message);
//    }

//    private parseResponse(response: string): [string, string, string]
//    {
//        const parts=response.split(/\n+/);
//        const message=parts[0];
//        const fileName=parts[1]||'';
//        const diff=parts.slice(2).join('\n').replace(/```diff\n/g, '').replace(/```/g, '').trim();
//        return [message, fileName, diff];
//    }

//    public promptUserResponse(response: string): void
//    {
//        // Find the last prompt in the chat history and add the response
//        for(let i=this.chatHistory.length-1; i>=0; i--)
//        {
//            if(this.chatHistory[i].type==='prompt')
//            {
//                this.chatHistory[i].response=response;
//                const promptKey=`${this.chatHistory[i].message}-${this.chatHistory[i].subject}`;
//                this.answeredPrompts.add(promptKey);
//                break;
//            }
//        }
//        this.sendCommand("prompt_response", response);
//    }

//    private handleNoGitRepo(): void
//    {
//        vscode.window.showInformationMessage(
//            'No git repo found, create one to track GPT\'s changes (recommended)',
//            'Yes',
//            'No'
//        ).then(selection =>
//        {
//            if(selection==='Yes')
//            {
//                this.sendCommand('prompt_response', 'y');
//            } else if(selection==='No')
//            {
//                this.sendCommand('prompt_response', 'n');
//            }
//        });
//    }

    public sendCommand(command: string, value: string): void
    {
        const jsonCommand=JSON.stringify({
            cmd: command,
            value: value
        });

        Logger.log(`Sent: ${jsonCommand}`);

        this.process.stdin.write(`${jsonCommand}\n`);
    }

//    public getChatHistory()
//    {
//        return this.chatHistory;
//    }

    public closeTerminal(): void
    {
        Logger.log('Process terminated.');
        this.process.kill();
    }
}
