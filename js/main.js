import { initUI } from './ui.js';
import { handleSubmit, loadChatHistory, startNewChat } from './chat.js';
import { loadChats, clearHistory } from './storage.js';

// Ensure libraries are loaded before initializing
async function ensureLibrariesLoaded() {
    const checkLib = (name, globalVar) => {
        if (!window[globalVar]) {
            console.warn(`${name} not loaded yet`);
            return false;
        }
        return true;
    };
    
    // Wait for all libraries to be available
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
        const allLoaded = [
            checkLib('marked', 'marked'),
            checkLib('DOMPurify', 'DOMPurify'),
            checkLib('highlight.js', 'hljs'),
            checkLib('html2pdf', 'html2pdf'),
        ].every(Boolean);
        
        if (allLoaded) {
            console.log('All libraries loaded successfully');
            break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    // Configure libraries
    try {
        if (window.marked) {
            window.marked.setOptions({
                breaks: true,
                gfm: true,
                sanitize: false
            });
            console.log('Marked.js configured');
        }
    } catch (error) {
        console.error('Error configuring marked.js:', error);
    }
}

// Main initialization
async function initialize() {
    try {
        console.log('ScribeAI initializing...');
        await ensureLibrariesLoaded();
        initUI();
        
        const form = document.querySelector('.input-form');
        if (form) form.addEventListener('submit', handleSubmit);
        
        const newChatBtn = document.querySelector('.new-chat-btn');
        if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);
        
        const clearHistoryBtn = document.querySelector('.clear-history-btn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                clearHistory();
                loadChatHistory([]);
            });
        }
        
        const promptInput = document.querySelector('.prompt-input');
        const generateBtn = document.querySelector('.generate-btn');
        if (promptInput && generateBtn) {
            promptInput.addEventListener('input', () => {
                generateBtn.disabled = promptInput.value.trim() === '';
            });
        }
        
        try {
            const chats = loadChats();
            loadChatHistory(chats);
        } catch (error) {
            loadChatHistory([]);
        }
        
    } catch (error) {
        showErrorToUser('Failed to initialize application. Please refresh the page.');
    }
}

function showErrorToUser(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.classList.add('fade-out');
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 300);
    }, 5000);
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

console.log('Main module loaded');