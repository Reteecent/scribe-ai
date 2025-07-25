import { getAIResponse } from './api.js';
import { saveChat, loadChats, getChatMessages } from './storage.js';
import { addDownloadButton } from './ui.js';

let currentStream = null;
let isGenerating = false;
let currentChatId = generateChatId();
let messageCounter = 0;
let lastUserMessage = null;

function generateChatId() {
    return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
}

function initializeMarkdown() {
    try {
        if (window.marked) {
            window.marked.setOptions({ 
                breaks: true, 
                gfm: true,
                sanitize: false,
                highlight: function(code, lang) {
                    if (window.hljs) {
                        return window.hljs.highlightAuto(code, [lang]).value;
                    }
                    return code;
                }
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
    
    promptTextarea.value = '';
    promptTextarea.style.height = 'auto';
    toggleGenerateButton(true);
    
    const userMessageId = `msg-${messageCounter++}`;
    lastUserMessage = text;
    addUserMessage(text, userMessageId);
    
    await generateAIResponse(text, `msg-${messageCounter++}`);
}

export async function generateAIResponse(prompt, aiMessageId) {
    const chatContainer = document.querySelector('.chat-container');
    try {
        isGenerating = true;
        const aiContainer = createAIMessageContainer(aiMessageId);
        chatContainer.appendChild(aiContainer);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        const contentContainer = document.createElement('div');
        contentContainer.className = 'ai-message-content markdown-body';
        aiContainer.querySelector('.ai-message').appendChild(contentContainer);
        contentContainer.style.display = 'none';
        
        let fullResponse = '';
        
        const conversation = [
            ...getChatMessages(currentChatId).flatMap(msg => [
                { role: 'user', content: msg.prompt },
                { role: 'assistant', content: msg.response }
            ]),
            { role: 'user', content: prompt }
        ];
        
        let lastRenderTime = Date.now();
        currentStream = getAIResponse(conversation, (chunk) => {
            fullResponse += chunk;
            
            const now = Date.now();
            if (now - lastRenderTime > 300) {
                contentContainer.innerHTML = '';
                const parsedContent = parseMarkdown(fullResponse);
                contentContainer.appendChild(parsedContent);
                lastRenderTime = now;
                
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
                
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        });
        
        const response = await currentStream;
        fullResponse = typeof response === 'object' ? response.text : response;
        
        contentContainer.innerHTML = '';
        contentContainer.appendChild(parseMarkdown(fullResponse));
        
        setTimeout(() => {
            addDownloadButton(fullResponse, aiContainer);
        }, 100);
        
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
        
        saveChat(prompt, fullResponse, currentChatId);
        loadChatHistory(loadChats());
        
    } catch (error) {
        if (error.name !== 'AbortError' && error.message !== 'Generation cancelled') {
            showToast('Failed to generate response. Please try again.', 'error');
        }
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
    loadingIndicator.style.minHeight = '100px';
    
    messageDiv.appendChild(loadingIndicator);
    container.appendChild(messageDiv);
    
    return container;
}

function parseMarkdown(text) {
    initializeMarkdown();
    const container = document.createElement('div');

    try {
        if (window.marked && window.DOMPurify) {
            const rawHTML = window.marked.parse(text);
            container.innerHTML = window.DOMPurify.sanitize(rawHTML);
        } else {
            container.innerHTML = text.replace(/\n/g, '<br>');
        }
    } catch (e) {
        console.error('Markdown parsing error:', e);
        container.textContent = text;
    }

    // Apply syntax highlighting if available
    if (window.hljs) {
        container.querySelectorAll('pre code').forEach((block) => {
            window.hljs.highlightElement(block);
        });
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
            <div class="loading-indicator" style="min-height:100px">
                <div class="spinner"></div>
                <span>Generating...</span>
            </div>
        `;
    } else if (text) {
        const responseText = typeof text === 'object' ? text.text : text;
        const processedContainer = parseMarkdown(responseText);
        content.appendChild(processedContainer);

        setTimeout(() => {
            addDownloadButton(responseText, container);
        }, 100);
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

    document.querySelector('.chat-container').innerHTML = '';
    document.querySelector('.chat-container').style.display = 'none';
    document.querySelector('.welcome-screen').style.display = 'flex';

    document.querySelectorAll('.history-list li').forEach(li => li.classList.remove('active'));
    document.querySelector('.scroll-to-bottom-btn').classList.remove('visible');
}

export function loadChatHistory(chats) {
    const historyList = document.querySelector('.history-list');
    if (!historyList) return;

    historyList.innerHTML = chats.length ? '' : '<li class="empty">No chat history</li>';

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

            chat.messages.forEach(msg => {
                const userMsgId = `msg-${messageCounter++}`;
                addUserMessage(msg.prompt, userMsgId);
                const aiMsgId = `msg-${messageCounter++}`;
                addAIMessage(msg.response, false, aiMsgId);
            });
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
    if (currentStream && typeof currentStream.abort === 'function') {
        currentStream.abort();
    }

    isGenerating = false;
    currentStream = null;
    toggleGenerateButton(false);

    const loadingIndicators = document.querySelectorAll('.loading-indicator');
    loadingIndicators.forEach(indicator => indicator.remove());
}

// Toast notifications 

export function showToast(message, type = 'success') {
    // Remove any existing toasts first
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '⚠' : '⏳'}</span>
        <span class="toast-message">${message}</span>
    `;
    
    // Style the toast
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';
    toast.style.zIndex = '10000';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.style.animation = 'slide-in 0.3s ease-out';
    
    // Type-specific styles
    if (type === 'error') {
        toast.style.backgroundColor = '#f44336';
        toast.style.color = 'white';
    } else if (type === 'success') {
        toast.style.backgroundColor = '#4caf50';
        toast.style.color = 'white';
    } else if (type === 'info') {
        toast.style.backgroundColor = '#2196f3';
        toast.style.color = 'white';
    } else {
        toast.style.backgroundColor = '#333';
        toast.style.color = 'white';
    }
    
    document.body.appendChild(toast);
    
    // Auto-remove after delay
    const duration = type === 'info' ? 2000 : 3000;
    
    setTimeout(() => {
        toast.style.animation = 'fade-out 0.3s ease-out';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// Call updateScrollButtonVisibility

window.updateScrollButtonVisibility = updateScrollButtonVisibility;

document.addEventListener('DOMContentLoaded', () => {
    initializeMarkdown();
});