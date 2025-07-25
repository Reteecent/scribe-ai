
const CHAT_STORAGE_KEY = 'scribeai-chats';

function extractKeywords(text) {
    if (!text) return [];
    
    // Remove common words and extract meaningful keywords
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.has(word))
        .slice(0, 20); // Limit to 20 keywords
}

export function saveChat(prompt, response, chatId) {
    try {
        let chats = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || [];
        
        let chat = chats.find(c => c.id === chatId);
        if (!chat) {
            chat = {
                id: chatId,
                messages: [],
                ts: new Date().toISOString(),
                title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')
            };
            chats.unshift(chat);
        }
        
        const messageData = { 
            prompt, 
            response, 
            ts: new Date().toISOString(),
            keywords: extractKeywords(prompt + ' ' + response)
        };
        
        chat.messages.push(messageData);
        chat.ts = new Date().toISOString();
        chat.keywords = extractKeywords(chat.messages.map(m => m.prompt + ' ' + m.response).join(' '));
        
        if (chat.messages.length === 1) {
            chat.title = prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '');
        }
        
        if (chats.length > 50) {
            chats = chats.slice(0, 50);
        }
        
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
        return chat;
    } catch (error) {
        console.error('Error saving chat:', error);
        throw error;
    }
}

export function loadChats() {
    try {
        const chats = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || [];
        return chats.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    } catch (error) {
        console.error('Error loading chats:', error);
        return [];
    }
}

export function getChatMessages(chatId) {
    try {
        const chats = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || [];
        const chat = chats.find(c => c.id === chatId);
        return chat?.messages || [];
    } catch (error) {
        console.error('Error getting chat messages:', error);
        return [];
    }
}

export function deleteChat(chatId) {
    try {
        let chats = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || [];
        chats = chats.filter(chat => chat.id !== chatId);
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
        
        if (document.querySelector(`.history-list li.active[data-chat-id="${chatId}"]`)) {
            clearChatUI();
        }
        
        return true;
    } catch (error) {
        console.error('Error deleting chat:', error);
        return false;
    }
}

export function updateChatTitle(chatId, newTitle) {
    try {
        let chats = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || [];
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
            chat.title = newTitle;
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error updating chat title:', error);
        return false;
    }
}

export function clearHistory() {
    try {
        localStorage.removeItem(CHAT_STORAGE_KEY);
        clearChatUI();
        return true;
    } catch (error) {
        console.error('Error clearing history:', error);
        return false;
    }
}

function clearChatUI() {
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
