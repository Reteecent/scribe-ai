
import { getAIResponse } from './api.js';
import { saveChat, loadChats, getChatMessages, updateChatTitle, deleteChat } from './storage.js';
import { addDownloadButton } from './ui.js';
import { showToast } from './toast.js';

let currentStream = null;
let isGenerating = false;
let currentChatId = generateChatId();
let messageCounter = 0;

function getContextualHistory(currentPrompt, currentChatId, maxMessages = 3) {
    try {
        const allChats = JSON.parse(localStorage.getItem('scribeai-chats')) || [];
        const otherChats = allChats.filter(chat => chat.id !== currentChatId);
        
        // Find relevant messages based on keyword matching
        const relevantMessages = [];
        const promptWords = currentPrompt.toLowerCase().split(/\s+/).filter(word => word.length > 3);
        
        for (const chat of otherChats) {
            for (const message of chat.messages) {
                const messageWords = (message.prompt + ' ' + message.response).toLowerCase();
                const relevanceScore = promptWords.filter(word => messageWords.includes(word)).length;
                
                if (relevanceScore > 0) {
                    relevantMessages.push({
                        ...message,
                        relevanceScore,
                        chatId: chat.id
                    });
                }
            }
        }
        
        // Sort by relevance and recency, take top messages
        return relevantMessages
            .sort((a, b) => {
                if (a.relevanceScore !== b.relevanceScore) {
                    return b.relevanceScore - a.relevanceScore;
                }
                return new Date(b.ts) - new Date(a.ts);
            })
            .slice(0, maxMessages);
            
    } catch (error) {
        console.error('Error getting contextual history:', error);
        return [];
    }
}

function generateChatId() {
    return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
}

function initializeMarkdown() {
    if (window.marked) {
        window.marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: (code, lang) => {
                if (window.hljs) {
                    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                    return hljs.highlight(code, { language }).value;
                }
                return code;
            }
        });
    }
}

export async function handleSubmit(event) {
    event?.preventDefault();
    
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
    addUserMessage(text, userMessageId);
    
    await generateAIResponse(text, `msg-${messageCounter++}`);
}

export async function generateAIResponse(prompt, aiMessageId) {
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;

    let aiContainer;
    let fullResponse = '';

    try {
        isGenerating = true;
        aiContainer = createAIMessageContainer(aiMessageId);
        chatContainer.appendChild(aiContainer);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        const contentContainer = document.createElement('div');
        contentContainer.className = 'ai-message-content markdown-body';
        aiContainer.querySelector('.ai-message').appendChild(contentContainer);
        contentContainer.style.display = 'none';
        
        // Get current chat messages
        const currentMessages = getChatMessages(currentChatId);
        
        // Get contextual history from other chats for better responses
        const contextualHistory = getContextualHistory(prompt, currentChatId, 3);
        
        const conversation = [
            // Add relevant context from previous chats
            ...contextualHistory.flatMap(msg => [
                { role: 'user', content: msg.prompt },
                { role: 'assistant', content: msg.response }
            ]),
            // Add current chat messages
            ...currentMessages.flatMap(msg => [
                { role: 'user', content: msg.prompt },
                { role: 'assistant', content: msg.response }
            ]),
            // Add current prompt
            { role: 'user', content: prompt }
        ];
        
        currentStream = await getAIResponse(conversation, (chunk) => {
            fullResponse = chunk;
            renderMarkdown(contentContainer, fullResponse);
            
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
        });

        // Final render with all content
        renderMarkdown(contentContainer, fullResponse);
        
        // Add centered download button after response
        setTimeout(() => {
            if (fullResponse.trim() !== '') {
                const buttonContainer = document.createElement('div');
                buttonContainer.style.width = '100%';
                buttonContainer.style.display = 'flex';
                buttonContainer.style.justifyContent = 'center';
                buttonContainer.style.marginTop = '1.5rem';
                
                addDownloadButton(fullResponse, buttonContainer);
                contentContainer.appendChild(buttonContainer);
            }
        }, 100);
        
        saveChat(prompt, fullResponse, currentChatId);
        loadChatHistory(loadChats());
        
    } catch (error) {
        console.error('Error generating response:', error);
        
        // Remove loading indicator on error
        const loadingIndicator = aiContainer?.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        // Remove the entire AI container if no content was generated
        if (!fullResponse.trim() && aiContainer) {
            aiContainer.remove();
        }
        
        if (error.message !== 'Generation cancelled') {
            showToast('Failed to generate response', 'error');
        }
    } finally {
        isGenerating = false;
        currentStream = null;
        toggleGenerateButton(false);
    }
}

function renderMarkdown(container, content) {
    initializeMarkdown();
    container.innerHTML = '';
    
    try {
        if (window.marked && window.DOMPurify) {
            const rawHTML = window.marked.parse(content);
            let sanitizedHTML = window.DOMPurify.sanitize(rawHTML, {
                ADD_TAGS: ['footer', 'div'],
                ADD_ATTR: ['class', 'style']
            });
            
            // Enhanced footer preservation and formatting
            sanitizedHTML = sanitizedHTML.replace(
                /<footer[^>]*>\s*<div class="document-footer"[^>]*>/gi,
                '<div class="document-footer">'
            ).replace(/<\/div>\s*<\/footer>/gi, '</div>');
            
            // Ensure footer HTML is properly structured
            sanitizedHTML = sanitizedHTML.replace(
                /<div class="document-footer"[^>]*>(.*?)<\/div>/gi,
                '<div class="document-footer" style="font-size: 0.85rem !important; color: #666666 !important; margin-top: 2rem !important; padding-top: 1rem !important; border-top: 1px solid #e1e1e1 !important; text-align: center !important; display: block !important; visibility: visible !important; opacity: 1 !important;">$1</div>'
            );
            
            container.innerHTML = sanitizedHTML;
            
            // Ensure all text is black and headings are bold
            container.querySelectorAll('*').forEach(el => {
                el.style.color = '#000000';
                if (el.tagName.match(/^H[1-6]$/)) {
                    el.style.fontWeight = 'bold';
                }
            });
            
            // Enhanced footer visibility enforcement
            container.querySelectorAll('.document-footer').forEach(footer => {
                // Apply comprehensive styling to ensure visibility
                footer.style.cssText = `
                    font-size: 0.85rem !important;
                    color: #666666 !important;
                    margin-top: 2rem !important;
                    padding-top: 1rem !important;
                    border-top: 1px solid #e1e1e1 !important;
                    text-align: center !important;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    clear: both !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                    position: relative !important;
                    z-index: 1 !important;
                `;
                
                footer.querySelectorAll('strong').forEach(strong => {
                    strong.style.cssText = `
                        font-weight: 600 !important;
                        color: #333333 !important;
                    `;
                });
            });
            
            if (window.hljs) {
                container.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
        } else {
            container.textContent = content;
        }
    } catch (e) {
        console.error('Markdown parsing error:', e);
        container.textContent = content;
    }
}

export function addUserMessage(text, id) {
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;

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

export function startNewChat() {
    currentChatId = generateChatId();
    messageCounter = 0;

    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.innerHTML = '';
        chatContainer.style.display = 'none';
    }

    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) welcomeScreen.style.display = 'flex';

    document.querySelectorAll('.history-list li').forEach(li => li.classList.remove('active'));
    document.querySelector('.scroll-to-bottom-btn')?.classList.remove('visible');
}

export function loadChatHistory(chats) {
    const historyList = document.querySelector('.history-list');
    if (!historyList) return;

    historyList.innerHTML = chats.length ? '' : '<li class="empty">No chat history</li>';

    chats.sort((a, b) => new Date(b.ts) - new Date(a.ts)).forEach((chat, index) => {
        const li = document.createElement('li');
        li.textContent = chat.title;
        li.dataset.chatId = chat.id;
        li.dataset.index = index;

        if (chat.id === currentChatId) li.classList.add('active');

        li.addEventListener('click', () => {
            document.querySelectorAll('.history-list li').forEach(item => item.classList.remove('active'));
            li.classList.add('active');

            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.classList.remove('open');

            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                chatContainer.innerHTML = '';
                chatContainer.style.display = 'block';
            }

            document.querySelector('.welcome-screen').style.display = 'none';

            currentChatId = chat.id;
            messageCounter = 0;

            chat.messages.forEach(msg => {
                const userMsgId = `msg-${messageCounter++}`;
                addUserMessage(msg.prompt, userMsgId);
                addAIMessage(msg.response, false, `msg-${messageCounter++}`);
            });
        });

        historyList.appendChild(li);
    });
}

function addAIMessage(text, showLoader = false, id) {
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;

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
        renderMarkdown(content, text);
        
        // Add centered download button for existing messages
        setTimeout(() => {
            if (text.trim() !== '') {
                const buttonContainer = document.createElement('div');
                buttonContainer.style.width = '100%';
                buttonContainer.style.display = 'flex';
                buttonContainer.style.justifyContent = 'center';
                buttonContainer.style.marginTop = '1.5rem';
                
                addDownloadButton(text, buttonContainer);
                content.appendChild(buttonContainer);
            }
        }, 100);
    }

    bubble.appendChild(content);
    container.appendChild(bubble);
    chatContainer.appendChild(container);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    updateScrollButtonVisibility();

    return content;
}

export function cancelGeneration() {
    if (currentStream?.abort) {
        currentStream.abort();
    }

    isGenerating = false;
    currentStream = null;
    toggleGenerateButton(false);

    document.querySelectorAll('.loading-indicator').forEach(indicator => indicator.remove());
}

function toggleGenerateButton(isGenerating) {
    const generateBtn = document.querySelector('.generate-btn');
    const promptInput = document.querySelector('.prompt-input');
    
    if (!generateBtn || !promptInput) return;

    generateBtn.disabled = promptInput.value.trim() === '' || isGenerating;
    
    const sendIcon = generateBtn.querySelector('.send-icon');
    const stopIcon = generateBtn.querySelector('.stop-icon');
    
    if (isGenerating) {
        if (sendIcon) sendIcon.style.display = 'none';
        if (stopIcon) stopIcon.style.display = 'block';
    } else {
        if (sendIcon) sendIcon.style.display = 'block';
        if (stopIcon) stopIcon.style.display = 'none';
    }
}

function updateScrollButtonVisibility() {
    const chatContainer = document.querySelector('.chat-container');
    const scrollButton = document.querySelector('.scroll-to-bottom-btn');

    if (!chatContainer || !scrollButton) return;

    if (!chatContainer.children.length) {
        scrollButton.classList.remove('visible');
        return;
    }

    const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 100;
    scrollButton.classList.toggle('visible', !isAtBottom);
}

window.updateScrollButtonVisibility = updateScrollButtonVisibility;
