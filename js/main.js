
import { initUI } from './ui.js';
import { handleSubmit, loadChatHistory } from './chat.js';
import { showToast } from './toast.js';

async function initializeLibraries() {
    // Ensure all required libraries are loaded
    const requiredLibraries = [
        { name: 'marked', global: 'marked', maxAttempts: 10 },
        { name: 'DOMPurify', global: 'DOMPurify', maxAttempts: 10 },
        { name: 'highlight.js', global: 'hljs', maxAttempts: 10 },
        { name: 'html2pdf', global: 'html2pdf', maxAttempts: 20 }
    ];
    
    for (const lib of requiredLibraries) {
        let attempts = 0;
        while (attempts < lib.maxAttempts && !window[lib.global]) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window[lib.global]) {
            console.error(`${lib.name} failed to load`);
            showToast(`Failed to load ${lib.name}`, 'error');
        }
    }
    
    // Configure marked.js if loaded
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

function setupEventListeners() {
    // Form submission
    const form = document.querySelector('.input-form');
    if (form) form.addEventListener('submit', handleSubmit);
    
    // Input validation
    const promptInput = document.querySelector('.prompt-input');
    const generateBtn = document.querySelector('.generate-btn');
    if (promptInput && generateBtn) {
        promptInput.addEventListener('input', () => {
            generateBtn.disabled = promptInput.value.trim() === '';
        });
    }
}

async function initialize() {
    try {
        await initializeLibraries();
        initUI();
        setupEventListeners();
        
        // Load existing chats
        const chats = JSON.parse(localStorage.getItem('scribeai-chats') || '[]');
        loadChatHistory(chats);
    } catch (error) {
        console.error('Initialization failed:', error);
        showToast('Failed to initialize application', 'error');
    }
}

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Global error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
    showToast('An unexpected error occurred', 'error');
});
