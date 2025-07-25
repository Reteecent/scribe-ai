
import { generatePDF } from './pdf.js';
import { showToast } from './toast.js';

let contextMenuChatIndex = null;
let currentContextMenu = null;
let isPDFGenerating = false;

export function initUI() {
    setupInputTextarea();
    setupMenuToggle();
    setupClickOutsideHandlers();
    initContextMenus();
    initRenameModal();
    initDeleteModal();
    initScrollButton();
    setupNewChatButton();
    setupClearHistoryButton();
}

function setupInputTextarea() {
    const promptTextarea = document.querySelector('.prompt-input');
    const sendButton = document.querySelector('.generate-btn');

    if (!promptTextarea || !sendButton) return;

    promptTextarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        sendButton.disabled = this.value.trim() === '';
    });

    promptTextarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.querySelector('.input-form')?.dispatchEvent(new Event('submit'));
        }
    });
}

function setupMenuToggle() {
    const menuBtn = document.querySelector('.menu-btn');
    const sidebar = document.querySelector('.sidebar');

    if (!menuBtn || !sidebar) return;

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
    });
}

function setupClickOutsideHandlers() {
    document.addEventListener('click', (e) => {
        const sidebar = document.querySelector('.sidebar');
        const menuBtn = document.querySelector('.menu-btn');
        
        if (sidebar?.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !menuBtn?.contains(e.target)) {
            sidebar.classList.remove('open');
        }

        if (!e.target.closest('.context-menu')) {
            hideContextMenus();
        }
    });
}

function initContextMenus() {
    const historyList = document.querySelector('.history-list');
    const historyContextMenu = document.querySelector('.history-context-menu');

    if (!historyList || !historyContextMenu) return;

    // Desktop right-click
    historyList.addEventListener('contextmenu', (e) => {
        const listItem = e.target.closest('li:not(.empty)');
        if (!listItem) return;
        e.preventDefault();
        showContextMenu(e, listItem.dataset.index, historyContextMenu);
    });

    // Mobile long-press
    historyList.addEventListener('touchstart', (e) => {
        const listItem = e.target.closest('li:not(.empty)');
        if (!listItem) return;
        
        const timer = setTimeout(() => {
            const touch = e.touches[0];
            showContextMenu({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {}
            }, listItem.dataset.index, historyContextMenu);
        }, 500);
        
        const cancelTimer = () => clearTimeout(timer);
        e.target.addEventListener('touchend', cancelTimer, { once: true });
        e.target.addEventListener('touchmove', cancelTimer, { once: true });
    });

    // Context menu actions
    document.addEventListener('click', (e) => {
        if (e.target.matches('.rename-btn')) handleRename();
        else if (e.target.matches('.delete-btn')) handleDelete();
    });
}

function handleRename() {
    const modal = document.getElementById('rename-modal');
    if (!modal) return;
    
    const chats = JSON.parse(localStorage.getItem('scribeai-chats') || []);
    if (contextMenuChatIndex !== null && chats[contextMenuChatIndex]) {
        const input = document.getElementById('rename-input');
        if (input) input.value = chats[contextMenuChatIndex].title || '';
    }
    
    modal.style.display = 'flex';
    hideContextMenus();
}

function handleDelete() {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.style.display = 'flex';
    hideContextMenus();
}

function initRenameModal() {
    const modal = document.getElementById('rename-modal');
    const saveBtn = document.getElementById('save-rename');
    const cancelBtn = document.getElementById('cancel-rename');
    const input = document.getElementById('rename-input');

    if (!modal || !saveBtn || !cancelBtn || !input) return;

    saveBtn.addEventListener('click', async () => {
        const newName = input.value.trim();
        if (newName && contextMenuChatIndex !== null) {
            try {
                const chats = JSON.parse(localStorage.getItem('scribeai-chats') || []);
                const chat = chats[contextMenuChatIndex];
                if (chat) {
                    chat.title = newName;
                    localStorage.setItem('scribeai-chats', JSON.stringify(chats));
                    showToast('Chat renamed successfully', 'success');
                    
                    const listItems = document.querySelectorAll('.history-list li');
                    if (listItems[contextMenuChatIndex]) {
                        listItems[contextMenuChatIndex].textContent = newName;
                    }
                }
            } catch (error) {
                console.error('Error renaming chat:', error);
                showToast('Failed to rename chat', 'error');
            }
        }
        modal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

function initDeleteModal() {
    const modal = document.getElementById('delete-modal');
    const deleteBtn = document.getElementById('delete-chat');
    const cancelBtn = document.getElementById('cancel-delete-chat');

    if (!modal || !deleteBtn || !cancelBtn) return;

    deleteBtn.addEventListener('click', () => {
        if (contextMenuChatIndex !== null) {
            try {
                const chats = JSON.parse(localStorage.getItem('scribeai-chats') || []);
                const chat = chats[contextMenuChatIndex];
                
                if (chat) {
                    chats.splice(contextMenuChatIndex, 1);
                    localStorage.setItem('scribeai-chats', JSON.stringify(chats));
                    showToast('Chat deleted successfully', 'success');
                    
                    const listItem = document.querySelector(`.history-list li[data-index="${contextMenuChatIndex}"]`);
                    if (listItem) listItem.remove();
                    
                    if (document.querySelector('.history-list').children.length === 0) {
                        document.querySelector('.history-list').innerHTML = '<li class="empty">No chat history</li>';
                    }
                    
                    if (document.querySelector(`.history-list li.active[data-chat-id="${chat.id}"]`)) {
                        document.querySelector('.chat-container').innerHTML = '';
                        document.querySelector('.chat-container').style.display = 'none';
                        document.querySelector('.welcome-screen').style.display = 'flex';
                    }
                }
            } catch (error) {
                console.error('Error deleting chat:', error);
                showToast('Failed to delete chat', 'error');
            }
        }
        modal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

function initScrollButton() {
    const scrollButton = document.querySelector('.scroll-to-bottom-btn');
    const chatContainer = document.querySelector('.chat-container');

    if (!scrollButton || !chatContainer) return;

    chatContainer.addEventListener('scroll', updateScrollButtonVisibility);
    scrollButton.addEventListener('click', () => {
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth',
        });
    });
}

function setupNewChatButton() {
    const newChatBtn = document.querySelector('.new-chat-btn');
    if (!newChatBtn) return;

    newChatBtn.addEventListener('click', () => {
        document.querySelector('.chat-container').innerHTML = '';
        document.querySelector('.chat-container').style.display = 'none';
        document.querySelector('.welcome-screen').style.display = 'flex';
        document.querySelectorAll('.history-list li').forEach(li => li.classList.remove('active'));
        document.querySelector('.scroll-to-bottom-btn').classList.remove('visible');
    });
}

function setupClearHistoryButton() {
    const clearHistoryBtn = document.querySelector('.clear-history-btn');
    if (!clearHistoryBtn) return;

    clearHistoryBtn.addEventListener('click', () => {
        localStorage.removeItem('scribeai-chats');
        document.querySelector('.history-list').innerHTML = '<li class="empty">No chat history</li>';
        document.querySelector('.chat-container').innerHTML = '';
        document.querySelector('.chat-container').style.display = 'none';
        document.querySelector('.welcome-screen').style.display = 'flex';
        showToast('Chat history cleared', 'success');
    });
}

function showContextMenu(e, index, menu) {
    e.preventDefault();
    hideContextMenus();
    
    menu.style.display = 'flex';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    contextMenuChatIndex = index;
    currentContextMenu = menu;

    // Adjust position if near window edge
    setTimeout(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 10}px`;
        
        menu.classList.add('show');
    }, 10);
}

function hideContextMenus() {
    document.querySelectorAll('.context-menu').forEach(menu => {
        menu.classList.remove('show');
        menu.style.display = 'none';
    });
    currentContextMenu = null;
}

export function addDownloadButton(content, container) {
    if (!container) return;

    // Remove existing button if present
    const existingBtn = container.querySelector('.download-pdf-btn');
    if (existingBtn) existingBtn.remove();

    const btn = document.createElement('button');
    btn.className = 'download-pdf-btn';
    btn.innerHTML = `
        <div class="spinner" style="display: none;"></div>
        <svg class="download-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 15V3M12 15L8 11M12 15L16 11M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="btn-text">Download PDF</span>
    `;

    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // Check if PDF is already generating
        if (isPDFGenerating) {
            showToast('PDF generation already in progress. Please wait.', 'error');
            return;
        }
        
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner');
        const downloadIcon = btn.querySelector('.download-icon');
        
        // Set loading state
        isPDFGenerating = true;
        btn.classList.add('loading');
        btn.disabled = true;
        if (btnText) btnText.textContent = 'Generating...';
        if (spinner) spinner.style.display = 'block';
        if (downloadIcon) downloadIcon.style.display = 'none';
        
        // Disable all other PDF buttons during generation
        document.querySelectorAll('.download-pdf-btn').forEach(pdfBtn => {
            if (pdfBtn !== btn) {
                pdfBtn.disabled = true;
                pdfBtn.style.opacity = '0.5';
            }
        });
        
        try {
            // Find the parent AI message content container
            const aiMessageContent = container.closest('.ai-message-content');
            if (aiMessageContent) {
                await generatePDF(aiMessageContent);
            } else {
                showToast('Unable to find content to export', 'error');
            }
        } catch (error) {
            console.error('PDF generation failed:', error);
            showToast('Failed to generate PDF', 'error');
        } finally {
            // Reset all PDF buttons state
            isPDFGenerating = false;
            document.querySelectorAll('.download-pdf-btn').forEach(pdfBtn => {
                pdfBtn.classList.remove('loading');
                pdfBtn.disabled = false;
                pdfBtn.style.opacity = '1';
                
                const pdfBtnText = pdfBtn.querySelector('.btn-text');
                const pdfSpinner = pdfBtn.querySelector('.spinner');
                const pdfDownloadIcon = pdfBtn.querySelector('.download-icon');
                
                if (pdfBtnText) pdfBtnText.textContent = 'Download PDF';
                if (pdfSpinner) pdfSpinner.style.display = 'none';
                if (pdfDownloadIcon) pdfDownloadIcon.style.display = 'inline';
            });
        }
    });
    
    container.appendChild(btn);
}

window.updateScrollButtonVisibility = () => {
    const chatContainer = document.querySelector('.chat-container');
    const scrollButton = document.querySelector('.scroll-to-bottom-btn');

    if (!chatContainer || !scrollButton) return;

    if (!chatContainer.children.length) {
        scrollButton.classList.remove('visible');
        return;
    }
    
    const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 100;
    scrollButton.classList.toggle('visible', !isAtBottom);
};
