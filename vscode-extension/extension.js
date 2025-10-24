const vscode = require('vscode');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const API_BASE_URL = 'http://localhost:8000';

class DeveloperAssistantProvider {
    constructor(context) {
        this.context = context;
        this.panel = null;
        this.sessionId = Date.now().toString();
    }

    async openChat() {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (this.panel) {
            this.panel.reveal(columnToShowIn);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'developerAssistant',
                'Developer Assistant',
                columnToShowIn || vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
                    ]
                }
            );

            this.panel.webview.html = this.getWebviewContent(this.panel.webview);

            this.panel.webview.onDidReceiveMessage(
                async message => {
                    await this.handleWebviewMessage(message);
                },
                undefined,
                this.context.subscriptions
            );

            this.panel.onDidDispose(
                () => {
                    this.panel = null;
                },
                undefined,
                this.context.subscriptions
            );
        }
    }

    async handleWebviewMessage(message) {
        switch (message.command) {
            case 'ask':
                await this.handleAskQuestion(message.question, message.code);
                break;
            case 'debug':
                await this.handleDebugCode(message.code, message.error);
                break;
            case 'explain':
                await this.handleExplainCode(message.code);
                break;
            case 'optimize':
                await this.handleOptimizeCode(message.code);
                break;
            case 'generateTests':
                await this.handleGenerateTests(message.code);
                break;
        }
    }

    async handleAskQuestion(question, codeContext) {
        try {
            const editor = vscode.window.activeTextEditor;
            const language = editor ? editor.document.languageId : 'plaintext';

            const response = await axios.post(`${API_BASE_URL}/api/ask`, {
                question: question,
                code_context: codeContext,
                language: language,
                session_id: this.sessionId
            });

            this.panel.webview.postMessage({
                command: 'response',
                data: response.data
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'error',
                error: error.message
            });
        }
    }

    async handleDebugCode(code, errorMessage) {
        try {
            const editor = vscode.window.activeTextEditor;
            const language = editor ? editor.document.languageId : 'plaintext';

            const response = await axios.post(`${API_BASE_URL}/api/debug`, {
                code_snippet: code,
                error_message: errorMessage,
                language: language
            });

            this.panel.webview.postMessage({
                command: 'response',
                data: response.data
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'error',
                error: error.message
            });
        }
    }

    async handleExplainCode(code) {
        try {
            const editor = vscode.window.activeTextEditor;
            const language = editor ? editor.document.languageId : 'plaintext';

            const response = await axios.post(`${API_BASE_URL}/api/explain`, {
                code: code,
                language: language
            });

            this.panel.webview.postMessage({
                command: 'response',
                data: response.data
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'error',
                error: error.message
            });
        }
    }

    async handleOptimizeCode(code) {
        try {
            const editor = vscode.window.activeTextEditor;
            const language = editor ? editor.document.languageId : 'plaintext';

            const response = await axios.post(`${API_BASE_URL}/api/optimize`, {
                code: code,
                language: language
            });

            this.panel.webview.postMessage({
                command: 'response',
                data: response.data
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'error',
                error: error.message
            });
        }
    }

    async handleGenerateTests(code) {
        try {
            const editor = vscode.window.activeTextEditor;
            const language = editor ? editor.document.languageId : 'plaintext';

            const response = await axios.post(`${API_BASE_URL}/api/generate-tests`, {
                code: code,
                language: language
            });

            this.panel.webview.postMessage({
                command: 'response',
                data: response.data
            });
        } catch (error) {
            this.panel.webview.postMessage({
                command: 'error',
                error: error.message
            });
        }
    }

    getWebviewContent(webview) {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'styles.css'))
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'main.js'))
        );

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Developer Assistant</title>
        </head>
        <body>
            <div id="app">
                <div class="header">
                    <h2>🤖 Developer Assistant</h2>
                    <div class="header-buttons">
                        <button id="clearBtn" class="btn-secondary">Clear Chat</button>
                    </div>
                </div>

                <div id="chatContainer" class="chat-container"></div>

                <div class="input-container">
                    <div class="quick-actions">
                        <button class="quick-btn" data-action="explain">📖 Explain</button>
                        <button class="quick-btn" data-action="debug">🐛 Debug</button>
                        <button class="quick-btn" data-action="optimize">⚡ Optimize</button>
                        <button class="quick-btn" data-action="test">🧪 Generate Tests</button>
                    </div>
                    
                    <textarea 
                        id="codeContext" 
                        class="code-context" 
                        placeholder="Paste code context here (optional)..."
                        rows="3"
                    ></textarea>
                    
                    <div class="input-row">
                        <input 
                            type="text" 
                            id="questionInput" 
                            class="question-input" 
                            placeholder="Ask a coding question..."
                        />
                        <button id="sendBtn" class="btn-primary">Send</button>
                    </div>
                </div>
            </div>

            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}

function activate(context) {
    console.log('Developer Assistant is now active!');

    const provider = new DeveloperAssistantProvider(context);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('developerAssistant.openChat', () => {
            provider.openChat();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('developerAssistant.askQuestion', async () => {
            const question = await vscode.window.showInputBox({
                prompt: 'Ask a coding question',
                placeHolder: 'e.g., How to implement a binary search tree?'
            });

            if (question) {
                provider.openChat();
                setTimeout(() => {
                    provider.handleAskQuestion(question, '');
                }, 500);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('developerAssistant.debugCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor!');
                return;
            }

            const selection = editor.selection;
            const code = editor.document.getText(selection);

            if (!code) {
                vscode.window.showWarningMessage('Please select code to debug!');
                return;
            }

            const errorMessage = await vscode.window.showInputBox({
                prompt: 'Describe the error',
                placeHolder: 'e.g., TypeError: undefined is not a function'
            });

            if (errorMessage) {
                provider.openChat();
                setTimeout(() => {
                    provider.handleDebugCode(code, errorMessage);
                }, 500);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('developerAssistant.explainCode', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor!');
                return;
            }

            const selection = editor.selection;
            const code = editor.document.getText(selection);

            if (!code) {
                vscode.window.showWarningMessage('Please select code to explain!');
                return;
            }

            provider.openChat();
            setTimeout(() => {
                provider.handleExplainCode(code);
            }, 500);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('developerAssistant.optimizeCode', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor!');
                return;
            }

            const selection = editor.selection;
            const code = editor.document.getText(selection);

            if (!code) {
                vscode.window.showWarningMessage('Please select code to optimize!');
                return;
            }

            provider.openChat();
            setTimeout(() => {
                provider.handleOptimizeCode(code);
            }, 500);
        })
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};