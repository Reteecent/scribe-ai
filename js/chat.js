import { getAIResponse } from './api.js';
import { saveChat, loadChats } from './storage.js';
import { addDownloadButton } from './ui.js';

let currentStream = null;
let isGenerating = false;
let currentChatId = generateChatId();
let messageCounter = 0;
let lastUserMessage = null;

// Helper function to generate unique chat IDs
function generateChatId() {
    return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
}

// Initialize markdown parser safely
function initializeMarkdown() {
    try {
        if (window.marked) {
            window.marked.setOptions({ 
                breaks: true, 
                gfm: true,
                sanitize: false
            });
        }
    } catch (e) {
        console.error('Markdown parser initialization error:', e);
    }
}

export async function handleSubmit(event) {
    if (event) event.preventDefault();

    if (isGenerating) {
        cancelGeneration();
        return;
    }

    const promptTextarea = document.querySelector('.prompt-input');
    const text = promptTextarea.value.trim();
    if (!text) return;

    console.log('Submitting prompt:', text.substring(0, 50) + '...');

    promptTextarea.value = '';
    promptTextarea.style.height = 'auto';
    toggleGenerateButton(true);

    const userMessageId = `msg-${messageCounter++}`;
    lastUserMessage = text;
    addUserMessage(text, userMessageId);

    await generateAIResponse(text, `msg-${messageCounter++}`);
}

export async function regenerateLastResponse() {
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;

    // Find the last AI message
    const messages = chatContainer.children;
    let lastAiMessage = null;

    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].classList.contains('ai-message-container')) {
            lastAiMessage = messages[i];
            break;
        }
    }

    if (!lastAiMessage) return;

    console.log('Regenerating last response');

    // Remove the last AI message
    lastAiMessage.remove();

    // Get the last user message text
    const userMessages = Array.from(chatContainer.children).filter(msg => 
        msg.classList.contains('user-message')
    );

    if (userMessages.length === 0) return;

    const lastUserMessage = userMessages[userMessages.length - 1];
    const prompt = lastUserMessage.textContent;

    // Generate new response
    await generateAIResponse(prompt);
}

export async function regenerateMessageAt(messageIndex) {
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;

    const messages = Array.from(chatContainer.children);
    const targetMessage = messages[messageIndex];

    if (!targetMessage || !targetMessage.classList.contains('ai-message-container')) {
        return;
    }

    console.log('Regenerating message at index:', messageIndex);

    // Remove this AI message and all subsequent messages
    for (let i = messages.length - 1; i >= messageIndex; i--) {
        if (messages[i]) {
            messages[i].remove();
        }
    }

    // Find the corresponding user message that prompted this AI response
    let userMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i] && messages[i].classList.contains('user-message')) {
            userMessageIndex = i;
            break;
        }
    }

    if (userMessageIndex >= 0 && messages[userMessageIndex]) {
        const prompt = messages[userMessageIndex].textContent;
        // Generate new response
        await generateAIResponse(prompt);
    }
}

export async function regenerateSpecificMessage(aiMessageContainer) {
    if (isGenerating) {
        cancelGeneration();
        return;
    }

    if (!aiMessageContainer || !aiMessageContainer.classList.contains('ai-message-container')) {
        console.error('Invalid message container for regeneration');
        return;
    }

    console.log('Regenerating specific message');

    // Find the corresponding user message
    const chatContainer = document.querySelector('.chat-container');
    const messages = Array.from(chatContainer.children);
    const aiIndex = messages.indexOf(aiMessageContainer);

    let userMessage = null;
    for (let i = aiIndex - 1; i >= 0; i--) {
        if (messages[i].classList.contains('user-message')) {
            userMessage = messages[i];
            break;
        }
    }

    if (!userMessage) {
        console.error('Could not find corresponding user message');
        return;
    }

    const userPrompt = userMessage.textContent;

    // Remove the AI message and all messages after it
    for (let i = messages.length - 1; i >= aiIndex; i--) {
        messages[i].remove();
    }

    // Update lastUserMessage to this prompt for potential future regenerations
    lastUserMessage = userPrompt;

    toggleGenerateButton(true);
    await generateAIResponse(userPrompt, `msg-${messageCounter++}`);
}

export async function generateAIResponse(prompt, aiMessageId) {
    const chatContainer = document.querySelector('.chat-container');
    try {
        isGenerating = true;
        console.log('Starting AI response generation...');

        const aiContainer = createAIMessageContainer(aiMessageId);
        chatContainer.appendChild(aiContainer);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        const contentContainer = document.createElement('div');
        contentContainer.className = 'ai-message-content markdown-body';
        aiContainer.querySelector('.ai-message').appendChild(contentContainer);
        contentContainer.style.display = 'none';

        let fullResponse = '';

        currentStream = getAIResponse(prompt, (chunk) => {
            fullResponse += chunk;
            // Real-time update: show the content as it streams
            contentContainer.innerHTML = '';
            const parsedContent = parseMarkdown(fullResponse);
            contentContainer.appendChild(parsedContent);

            if (contentContainer.style.display === 'none') {
                const loadingIndicator = aiContainer.querySelector('.loading-indicator');
                if (loadingIndicator) {
                    loadingIndicator.style.opacity = '0';
                    setTimeout(() => {
                        loadingIndicator.remove();
                        contentContainer.style.display = 'block';
                    }, 300);
                }
            }

            // Auto scroll to bottom
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });

        const response = await currentStream;
        fullResponse = typeof response === 'object' ? response.text : response;

        // Final render
        contentContainer.innerHTML = '';
        contentContainer.appendChild(parseMarkdown(fullResponse));
        
        // Add download button
        setTimeout(() => {
            addDownloadButton(fullResponse, aiContainer);
        }, 100);

        // Ensure content is visible
        if (contentContainer.style.display === 'none') {
            const loadingIndicator = aiContainer.querySelector('.loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.opacity = '0';
                setTimeout(() => {
                    loadingIndicator.remove();
                    contentContainer.style.display = 'block';
                }, 300);
            } else {
                contentContainer.style.display = 'block';
            }
        }

        chatContainer.scrollTop = chatContainer.scrollHeight;
        updateScrollButtonVisibility();

        // Save chat
        saveChat(prompt, fullResponse, currentChatId);
        loadChatHistory(loadChats());

        console.log('AI response generation complete');

    } catch (error) {
        console.error('Generation error:', error);
        if (error.name !== 'AbortError' && error.message !== 'Generation cancelled') {
            showToast('Failed to generate response. Please try again.', 'error');
        }

        // Clean up loading state
        const loadingIndicator = chatContainer.querySelector('.loading-indicator');
        if (loadingIndicator) loadingIndicator.remove();

    } finally {
        isGenerating = false;
        currentStream = null;
        toggleGenerateButton(false);
    }
}

function createAIMessageContainer(id) {
    const container = document.createElement('div');
    container.className = 'ai-message-container';
    if (id) container.id = id;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-message';

    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="spinner"></div>
        <span>Generating...</span>
    `;

    messageDiv.appendChild(loadingIndicator);
    container.appendChild(messageDiv);

    return container;
}

function parseMarkdown(text) {
    const container = document.createElement('div');

    try {
        if (window.marked && window.DOMPurify) {
            const rawHTML = window.marked.parse(text);
            container.innerHTML = window.DOMPurify.sanitize(rawHTML);
        } else {
            // Fallback: basic text formatting
            container.innerHTML = text.replace(/\n/g, '<br>');
        }
    } catch (e) {
        console.error('Markdown parsing error:', e);
        container.textContent = text;
    }

    // Enhance code blocks
    const preElements = container.querySelectorAll('pre');
    preElements.forEach(pre => {
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
    });

    // Apply syntax highlighting if available
    try {
        if (window.hljs) {
            container.querySelectorAll('pre code').forEach((block) => {
                window.hljs.highlightElement(block);
            });
        }
    } catch (e) {
        console.error('Code highlighting error:', e);
    }

    return container;
}

export function addUserMessage(text, id) {
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.style.display = 'block';
    document.querySelector('.welcome-screen').style.display = 'none';

    const bubble = document.createElement('div');
    bubble.className = 'message user-message';
    bubble.textContent = text;
    if (id) bubble.id = id;

    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    updateScrollButtonVisibility();

    console.log('Added user message:', text.substring(0, 30) + '...');
}

export function addAIMessage(text, showLoader = false, id) {
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.style.display = 'block';
    document.querySelector('.welcome-screen').style.display = 'none';

    const container = document.createElement('div');
    container.className = 'ai-message-container';
    if (id) container.id = id;

    const bubble = document.createElement('div');
    bubble.className = 'ai-message';

    const content = document.createElement('div');
    content.className = 'ai-message-content markdown-body';

    if (showLoader) {
        content.innerHTML = `
            <div class="loading-indicator">
                <div class="spinner"></div>
                <span>Generating...</span>
            </div>
        `;
    } else if (text) {
        const responseText = typeof text === 'object' ? text.text : text;
        const processedContainer = parseMarkdown(responseText);
        content.appendChild(processedContainer);

        if (!showLoader) {
            // Add download button after a short delay to ensure content is rendered
            setTimeout(() => {
                addDownloadButton(responseText, container);
            }, 100);
        }
    }

    bubble.appendChild(content);
    container.appendChild(bubble);
    chatContainer.appendChild(container);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    updateScrollButtonVisibility();

    return content;
}

export function startNewChat() {
    currentChatId = generateChatId();
    lastUserMessage = null;
    messageCounter = 0;

    console.log('Starting new chat:', currentChatId);

    document.querySelector('.chat-container').innerHTML = '';
    document.querySelector('.chat-container').style.display = 'none';
    document.querySelector('.welcome-screen').style.display = 'flex';

    // Update sidebar
    document.querySelectorAll('.history-list li').forEach(li => li.classList.remove('active'));
    document.querySelector('.scroll-to-bottom-btn').classList.remove('visible');
}

export function loadChatHistory(chats) {
    const historyList = document.querySelector('.history-list');
    if (!historyList) return;

    historyList.innerHTML = chats.length ? '' : '<li class="empty">No chat history</li>';

    // Sort chats by timestamp (newest first)
    const sortedChats = [...chats].sort((a, b) => {
        const aTime = parseInt(a.id.split('-')[0]);
        const bTime = parseInt(b.id.split('-')[0]);
        return bTime - aTime;
    });

    sortedChats.forEach((chat, index) => {
        const li = document.createElement('li');
        li.textContent = chat.title || chat.messages[0]?.prompt.substring(0, 50) || 'New Chat';
        li.dataset.chatId = chat.id;
        li.dataset.index = index;

        if (chat.id === currentChatId) li.classList.add('active');

        li.addEventListener('click', () => {
            document.querySelectorAll('.history-list li').forEach(item => item.classList.remove('active'));
            li.classList.add('active');

            // Auto-close sidebar when chat is selected (desktop behavior)
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }

            const chatContainer = document.querySelector('.chat-container');
            chatContainer.innerHTML = '';
            chatContainer.style.display = 'block';
            document.querySelector('.welcome-screen').style.display = 'none';

            currentChatId = chat.id;
            lastUserMessage = null;
            messageCounter = 0;

            // Load messages with proper markdown rendering
            chat.messages.forEach(msg => {
                const userMsgId = `msg-${messageCounter++}`;
                addUserMessage(msg.prompt, userMsgId);
                const aiMsgId = `msg-${messageCounter++}`;
                addAIMessage(msg.response, false, aiMsgId);
            });

            console.log('Loaded chat:', chat.id, 'with', chat.messages.length, 'messages');
        });

        historyList.appendChild(li);
    });
}

function updateScrollButtonVisibility() {
    const chatContainer = document.querySelector('.chat-container');
    const scrollButton = document.querySelector('.scroll-to-bottom-btn');

    if (!chatContainer || !chatContainer.children.length) {
        if (scrollButton) scrollButton.classList.remove('visible');
        return;
    }

    const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 100;
    if (scrollButton) scrollButton.classList.toggle('visible', !isAtBottom);
}

function toggleGenerateButton(isGenerating) {
    const generateBtn = document.querySelector('.generate-btn');
    const sendIcon = document.querySelector('.send-icon');
    const stopIcon = document.querySelector('.stop-icon');

    if (!generateBtn) return;

    if (isGenerating) {
        generateBtn.disabled = false;
        if (sendIcon) sendIcon.style.display = 'none';
        if (stopIcon) stopIcon.style.display = 'block';
    } else {
        const promptInput = document.querySelector('.prompt-input');
        const hasText = promptInput && promptInput.value.trim() !== '';
        generateBtn.disabled = !hasText;
        if (sendIcon) sendIcon.style.display = 'block';
        if (stopIcon) stopIcon.style.display = 'none';
    }
}

export function cancelGeneration() {
    console.log('Canceling generation...');

    if (currentStream && typeof currentStream.abort === 'function') {
        currentStream.abort();
    }

    isGenerating = false;
    currentStream = null;
    toggleGenerateButton(false);

    // Clean up any loading indicators
    const loadingIndicators = document.querySelectorAll('.loading-indicator');
    loadingIndicators.forEach(indicator => indicator.remove());
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '⚠' : '⏳'}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    const duration = type === 'info' ? 2000 : 3000;
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

export function updateCurrentMessages(messages) {
    console.log('Current messages updated:', messages);
}

export function getCurrentMessages() {
    // Get current messages from the chat container
    const chatContainer = document.querySelector('.chat-container');
    const messages = [];
    
    if (chatContainer) {
        Array.from(chatContainer.children).forEach(messageElement => {
            const isUser = messageElement.classList.contains('user-message');
            const content = isUser 
                ? messageElement.textContent.trim()
                : getMessageText(messageElement);
            
            messages.push({
                role: isUser ? 'user' : 'assistant',
                content: content
            });
        });
    }
    
    return messages;
}

function getMessageText(messageElement) {
    if (messageElement.classList.contains('ai-message-container')) {
        const contentContainer = messageElement.querySelector('.ai-message-content');
        if (contentContainer) {
            const clone = contentContainer.cloneNode(true);
            const buttons = clone.querySelectorAll('button, .download-pdf-btn');
            buttons.forEach(btn => btn.remove());
            return clone.textContent || clone.innerText || '';
        }
    }
    return messageElement.textContent || messageElement.innerText || '';
}

// Make scroll function available globally
window.updateScrollButtonVisibility = updateScrollButtonVisibility;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeMarkdown();
    console.log('Chat module initialized');
});