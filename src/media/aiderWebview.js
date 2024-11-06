const vscode = acquireVsCodeApi();

const chatHistory = document.getElementById('chat-history');
const userInputArea = document.getElementById('user-input-area');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const debugToggle = document.getElementById('debug-toggle');
const debugView = document.getElementById('debug-view');
const debugLog = document.getElementById('debug-log');

let lastMessageType = ''; // Track the last message type
let currentMessageDiv; // Track the current message div
let streamMessage;

document.addEventListener('DOMContentLoaded', () => 
{
    // Add scroll event listener to chat history
    const chatHistory = document.getElementById('chat-history');
    chatHistory.addEventListener('scroll', () => {
        isScrolledToBottom = checkIfScrolledToBottom();
    });

    // Initialize markdown-it using the global markdownit function
    const md = window.markdownit(
        {
            html: true,
            linkify: true,
            highlight: function (str, lang) 
            {
                return `<pre class="language-\${lang}"><code>\${str}</code></pre>`;
            }
        });
});

function setHighlightJsTheme()
{
    //    const theme = vscode.getState().theme || 'default'; // Get the current theme from VSCode state
    //    const highlightJsTheme = theme === 'dark' ? 'dark' : 'default'; // Set highlight.js theme based on VSCode theme
    const linkElement = document.createElement('link');
    linkElement.rel = 'stylesheet';
    linkElement.href = `./media/highlight/styles/${highlightJsTheme}.min.css`; // Load from local styles directory
}

function updateMessageBlock(type)
{
    if((lastMessageType === type) && currentMessageDiv)
    { return; }

    lastMessageType = type;
    currentMessageDiv = document.createElement('div');
    currentMessageDiv.className = 'message-container';

    // Create header
    const header = document.createElement('div');
    header.className = 'message-header';

    // Create icon
    const icon = document.createElement('div');
    icon.className = 'message-icon';

    switch(type)
    {
        case 'user':
            //            currentMessageDiv.className = 'user-message-container';
            currentMessageDiv.classList.add('user-messages');
            icon.className += ' user-icon';
            icon.innerHTML = '👤';
            break;
        case 'assistant':
            currentMessageDiv.classList.add('assistant-messages');
            //            currentMessageDiv.className = 'assistant-message-container';
            icon.className += ' assistant-icon';
            icon.innerHTML = '🤖';
            break;
    }

    header.appendChild(icon);
    currentMessageDiv.appendChild(header);

    //    // Add divider
    //    const divider = document.createElement('hr');
    //    divider.className = 'message-divider';
    //    currentMessageDiv.appendChild(divider);

    chatHistory.appendChild(currentMessageDiv);
}

let isScrolledToBottom = true;

// Check if chat history is scrolled to bottom
function checkIfScrolledToBottom() {
    const chatHistory = document.getElementById('chat-history');
    const threshold = 1; // Allow 1px difference due to rounding
    return Math.abs(chatHistory.scrollHeight - chatHistory.clientHeight - chatHistory.scrollTop) <= threshold;
}

// Scroll to bottom if we were already at bottom
function scrollToBottomIfNeeded() {
    if (isScrolledToBottom) {
        const chatHistory = document.getElementById('chat-history');
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}

function addMessageToChat(type, message, html = false)
{
    updateMessageBlock(type);

    isScrolledToBottom = checkIfScrolledToBottom();
    const messageElement = document.createElement('div');

    switch(type)
    {
        case 'user':
            messageElement.className = 'message-user';
            messageElement.textContent = message;
            break;
        case 'assistant':
            messageElement.className = 'message-assistant';
            if(html)
            { messageElement.innerHTML = message; }
            else
            { messageElement.textContent = message; }

            break;
    }

    currentMessageDiv.appendChild(messageElement);

    scrollToBottomIfNeeded();
}

function addAssistantMessageToChat(message, fileName, diff, changeCount) 
{
    addMessageToChat('assistant', message); // Use the same function to add assistant messages
    //    const messageElement = currentMessageDiv.lastChild; // Get the last message element added
    //
    //    const collapsibleFileElement = document.createElement('div');
    //    collapsibleFileElement.className = 'collapsible-file';
    //
    //    const toggleIcon = document.createElement('span');
    //    toggleIcon.className = 'collapsible-icon';
    //    toggleIcon.textContent = '▼';
    //    toggleIcon.style.cursor = 'pointer';
    //
    //    const fileNameElement = document.createElement('p');
    //
    //    // Parse the diff to count additions and subtractions
    //    const additions = (diff.match(/\+/g) || []).length;
    //    const subtractions = (diff.match(/-/g) || []).length;
    //    fileNameElement.textContent = `File: ${fileName} (${changeCount} changes, +${additions}, -${subtractions})`;
    //
    //    const diffElement = document.createElement('pre');
    //    diffElement.className = 'code-diff';
    //    diffElement.innerHTML = `<code>diff\n${diff}\n</code>`; // Updated to wrap in <pre><code>
    //    diffElement.style.display = 'none'; // Start in a collapsed state
    //
    //    toggleIcon.addEventListener('click', () =>
    //    {
    //        const isCollapsed = diffElement.style.display === 'none';
    //        diffElement.style.display = isCollapsed ? 'block' : 'none';
    //        toggleIcon.textContent = isCollapsed ? '▼' : '▶';
    //    });
    //
    //    collapsibleFileElement.appendChild(toggleIcon);
    //    collapsibleFileElement.appendChild(fileNameElement);
    //    messageElement.appendChild(collapsibleFileElement);
    //    messageElement.appendChild(diffElement);
    //
    //    // Highlight the code in the diffElement
    //    hljs.highlightElement(diffElement); // Updated to use highlightElement instead of highlightBlock

    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function addPromptToChat(message)
{
    addLogEntry('Prompting user for response');
    updateMessageBlock('assistant');

    sendButton.disabled = true;

    const messageElement = document.createElement('div');
    const textArea = document.createElement('div');
    const text = document.createElement('p');
    const promptButtons = document.createElement('div');
    const yesButton = document.createElement('button');
    const noButton = document.createElement('button');

    messageElement.className = 'aider-prompt';
    textArea.className = 'prompt-text-area';
    text.className = 'prompt-text';
    text.textContent = message;
    promptButtons.className = 'prompt-buttons';
    yesButton.id = 'yes-button';
    yesButton.className = 'vscode-button';
    yesButton.innerHTML = '<span class="codicon codicon-check">Yes</span>';
    noButton.id = 'no-button';
    noButton.className = 'vscode-button';
    noButton.innerHTML = '<span class="codicon codicon-close">No</span>';

    textArea.appendChild(text);
    textArea.appendChild(promptButtons);
    promptButtons.appendChild(yesButton);
    promptButtons.appendChild(noButton);
    messageElement.appendChild(textArea);

    currentMessageDiv.appendChild(messageElement); // Append to the current message div

    lastMessageType = 'assistant';

    yesButton.addEventListener('click', () =>
    {
        vscode.postMessage({
            command: 'promptUserResponse',
            response: 'yes'
        });
        parentElement = messageElement.parentElement;
        parentElement.removeChild(messageElement);
        sendButton.disabled = false;
    });

    noButton.addEventListener('click', () =>
    {
        vscode.postMessage({
            command: 'promptUserResponse',
            response: 'no'
        });
        parentElement = messageElement.parentElement;
        parentElement.removeChild(messageElement);
        sendButton.disabled = false;
    });
}

function updateStreamMessage(message, final, html = false) 
{
    if(!streamMessage)
    {
        updateMessageBlock('assistant');
        isScrolledToBottom = checkIfScrolledToBottom();

        streamMessage = document.createElement('div');
        streamMessage.className = 'message-assistant-stream';
        currentMessageDiv.appendChild(streamMessage);
    }

    if(html)
    { streamMessage.innerHTML = message; }
    else
    { streamMessage.textContent = message; }

    scrollToBottomIfNeeded();

    if(final)
    {
        streamMessage = null;
    }
}

function updateVersion(version)
{
    const versionText = document.getElementById('version-text');
    if(versionText)
    {
        versionText.textContent = `v${version}`;
    }
}

function updateModel(model)
{
    const modelText = document.getElementById('model-text');
    if(modelText)
    {
        modelText.textContent = `Model: ${model}`;
    }
}

function updateWeakModel(model)
{
    const weakModelText = document.getElementById('weak-model-text');
    if(weakModelText)
    {
        weakModelText.textContent = `Weak: ${model}`;
    }
}

function updateTokenInfo(tokenInfo)
{
    addLogEntry(`Updating token info: ${tokenInfo.sent}/${tokenInfo.received} $${tokenInfo.cost}/$${tokenInfo.cost_session}`);

    if(currentMessageDiv && currentMessageDiv.classList.contains('assistant-messages'))
    {
        const existingInfo = currentMessageDiv.querySelector('.token-info');

        if(existingInfo)
        {
            addLogEntry('Removing existing token info');
            existingInfo.remove();
        }

        addLogEntry('Adding new token info');
        const tokenInfoDiv = document.createElement('div');
        tokenInfoDiv.className = 'token-info';
        tokenInfoDiv.textContent = `sent:${tokenInfo.sent} recv:${tokenInfo.received} cost:$${tokenInfo.cost} of $${tokenInfo.cost_session}`;
        currentMessageDiv.appendChild(tokenInfoDiv);
    }
}

function addLogEntry(entry)
{
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${new Date().toISOString()}] ${entry}`;
    debugLog.appendChild(logEntry);
    debugLog.scrollTop = debugLog.scrollHeight;
}

sendButton.addEventListener('click', () =>
{
    const message = userInput.value.trim();
    if(message)
    {
        //        addMessageToChat('user', message);
        vscode.postMessage({
            command: 'sendCommand',
            type: 'user',
            text: message
        });
        userInput.value = '';
    }
});

let autocompleteBox = null;
let selectedIndex = -1;
let completions = [];

function showAutoComplete(options)
{
    if(autocompleteBox)
    {
        removeAutoComplete();
    }

    if(!options || options.length === 0)
    {
        return;
    }

    completions = options;
    autocompleteBox = document.createElement('div');
    autocompleteBox.className = 'autocomplete-box';

    options.forEach((option, index) =>
    {
        const div = document.createElement('div');
        div.className = 'autocomplete-option';
        div.textContent = option.text;
        div.dataset.startPosition = option.start_position;
        div.addEventListener('click', () =>
        {
            applyCompletion(option.text, parseInt(option.start_position));
        });
        autocompleteBox.appendChild(div);
    });

    userInputArea.appendChild(autocompleteBox);

    // Select first option by default
    selectedIndex = 0;
    updateSelectedOption();
    showCompletionPreview(completions[0]);
}

function removeAutoComplete()
{
    if(autocompleteBox)
    {
        autocompleteBox.remove();
        autocompleteBox = null;
        selectedIndex = -1;
        removeCompletionPreview();
    }
}

function showCompletionPreview(completion)
{
    removeCompletionPreview();
    const currentValue = userInput.value;
    const startPos = completion.start_position;
    const previewText = completion.text;

    const preview = document.createElement('div');
    preview.className = 'completion-preview';
    preview.textContent = currentValue.substring(0, startPos) + previewText;

    userInput.parentElement.appendChild(preview);
}

function removeCompletionPreview()
{
    const existing = document.querySelector('.completion-preview');
    if(existing)
    {
        existing.remove();
    }
}

function updateSelectedOption()
{
    const options = autocompleteBox.querySelectorAll('.autocomplete-option');
    options.forEach((opt, idx) =>
    {
        opt.classList.toggle('selected', idx === selectedIndex);
    });

    if(selectedIndex >= 0 && selectedIndex < completions.length)
    {
        showCompletionPreview(completions[selectedIndex]);
    }
}

function applyCompletion(completion, startPosition)
{
    const currentValue = userInput.value;
    // Handle negative start positions by calculating from end of string
    const actualStartPos = startPosition < 0 ? currentValue.length + startPosition : startPosition;
    const beforeCompletion = currentValue.substring(0, actualStartPos);
    const afterCursor = currentValue.substring(userInput.selectionStart);

    addLogEntry(`Applying completion: ${completion}`);
    addLogEntry(`Start position: ${startPosition} (actual: ${actualStartPos})`);
    addLogEntry(`Current value: ${currentValue}`);
    addLogEntry(`Before completion: ${beforeCompletion}`);
    addLogEntry(`After cursor: ${afterCursor}`);

    userInput.value = beforeCompletion + completion + afterCursor;
    const newCursorPos = beforeCompletion.length + completion.length;
    userInput.selectionStart = newCursorPos;
    userInput.selectionEnd = newCursorPos;
    removeAutoComplete();
}

userInput.addEventListener('keydown', (e) =>
{
    if(autocompleteBox)
    {
        const numColumns = Math.floor(autocompleteBox.offsetWidth / 150); // Approximate number of columns
        switch(e.key)
        {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + numColumns, completions.length - 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - numColumns, 0);
                break;
            case 'ArrowRight':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, completions.length - 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                break;
            case 'Tab':
                if(selectedIndex >= 0)
                {
                    e.preventDefault();
                    const selectedOption = completions[selectedIndex];
                    applyCompletion(selectedOption.text, selectedOption.start_position);
                }
                break;
            case 'Escape':
                removeAutoComplete();
                break;
            default:
                if(!e.ctrlKey && !e.altKey && !e.metaKey)
                {
                    removeAutoComplete();
                }
        }

        if(autocompleteBox)
        {
            updateSelectedOption();
        }
    }
});

userInput.addEventListener('input', () =>
{
    vscode.postMessage({
        command: 'interactiveInput',
        text: userInput.value
    });
});

userInput.addEventListener('keypress', (e) =>
{
    if(e.key === 'Enter' && !e.shiftKey && !autocompleteBox)
    {
        e.preventDefault();
        sendButton.click();
    }
});

debugToggle.addEventListener('click', () =>
{
    debugView.classList.toggle('hidden');
});

// Focus user input when the webview is loaded
document.addEventListener('DOMContentLoaded', () =>
{
    userInput.focus();
});

window.addEventListener('message', event =>
{
    const message = event.data;
    switch(message.command)
    {
        case 'log':
            addLogEntry(message.text);
            break;
        case 'version':
            updateVersion(message.version);
            break;
        case 'model':
            updateModel(message.model);
            break;
        case 'weakModel':
            updateWeakModel(message.model);
            break;
        case 'addMessageUser':
            addMessageToChat('user', message.text);
            break;
        case 'addMessageOutput':
            addMessageToChat('assistant', message.text);
            break;
        case 'addAssistantMessage':
            addAssistantMessageToChat(message.html);
            break;
        case 'updateStreamMessage':
            if(message.text)
            { updateStreamMessage(message.text, message.final); }
            else
            { updateStreamMessage(message.html, message.final, true); }
            break;
        case 'promptUser':
            addPromptToChat(message.text);
            break;
        case 'addResponse':
            addMessageToChat('assistant', message.text);
            break;
        case 'showAutoComplete':
            showAutoComplete(message.completions);
            break;
        case 'updateTokenInfo':
            updateTokenInfo(message.tokenInfo);
            break;
    }
});

// Set the highlight.js theme based on the current VSCode theme
setHighlightJsTheme();

