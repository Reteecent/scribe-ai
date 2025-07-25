export function saveChat(prompt, response, chatId) {
    try {
        let chats = JSON.parse(localStorage.getItem('scribeai-chats') || '[]');
        
        // Find existing chat or create new one
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
        
        // Add messages to current chat
        chat.messages.push({
            prompt,
            response,
            ts: new Date().toISOString()
        });
        
        // Update timestamp
        chat.ts = new Date().toISOString();
        
        // Update title if it's the first message
        if (chat.messages.length === 1) {
            chat.title = prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '');
        }
        
        // Keep only the last 50 chats
        if (chats.length > 50) {
            chats = chats.slice(0, 50);
        }
        
        localStorage.setItem('scribeai-chats', JSON.stringify(chats));
        
        console.log('Chat saved successfully:', chat.id);
    } catch (error) {
        console.error('Error saving chat:', error);
    }
}

export function loadChats() {
    try {
        const chats = JSON.parse(localStorage.getItem('scribeai-chats') || '[]');
        
        // Sort chats by timestamp (newest first)
        return chats.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    } catch (error) {
        console.error('Error loading chats:', error);
        return [];
    }
}

// Get messages for a specific chat
export function getChatMessages(chatId) {
    try {
        const chats = JSON.parse(localStorage.getItem('scribeai-chats') || '[]');
        const chat = chats.find(c => c.id === chatId);
        return chat ? chat.messages : [];
    } catch (error) {
        console.error('Error getting chat messages:', error);
        return [];
    }
}

export function deleteChat(chatId) {
    try {
        let chats = JSON.parse(localStorage.getItem('scribeai-chats') || '[]');
        const deletedChat = chats.find(chat => chat.id === chatId);
        chats = chats.filter(chat => chat.id !== chatId);
        localStorage.setItem('scribeai-chats', JSON.stringify(chats));
        
        console.log('Chat deleted:', chatId);
        
        // Check if deleted chat was currently open and clear if so
        const currentChatElement = document.querySelector('.history-list li.active');
        if (currentChatElement && currentChatElement.dataset.chatId === chatId) {
            clearChatAndShowWelcome();
        }
        
        return deletedChat;
    } catch (error) {
        console.error('Error deleting chat:', error);
    }
}

function clearChatAndShowWelcome() {
    const chatContainer = document.querySelector('.chat-container');
    const welcomeScreen = document.querySelector('.welcome-screen');
    const scrollButton = document.querySelector('.scroll-to-bottom-btn');
    
    if (chatContainer) {
        chatContainer.style.display = 'none';
        chatContainer.innerHTML = '';
    }
    
    if (welcomeScreen) {
        welcomeScreen.style.display = 'flex';
    }
    
    if (scrollButton) {
        scrollButton.classList.remove('visible');
    }
    
    // Remove active state from all history items
    document.querySelectorAll('.history-list li').forEach(li => li.classList.remove('active'));
}

export function updateChatTitle(chatId, newTitle) {
    try {
        let chats = JSON.parse(localStorage.getItem('scribeai-chats') || '[]');
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
            chat.title = newTitle;
            localStorage.setItem('scribeai-chats', JSON.stringify(chats));
            console.log('Chat title updated:', chatId, newTitle);
        }
    } catch (error) {
        console.error('Error updating chat title:', error);
    }
}

export function clearHistory() {
    try {
        localStorage.removeItem('scribeai-chats');
        clearChatAndShowWelcome();
        console.log('Chat history cleared');
    } catch (error) {
        console.error('Error clearing history:', error);
    }
}