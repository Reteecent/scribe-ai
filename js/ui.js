import { generatePDF } from './pdf.js';
import { deleteChat, loadChats } from './storage.js';

let longPressTimer;
let contextMenuChatIndex = null;
let currentContextMenu = null;
let editingMessage = null;

export function initUI() {
    setupInputTextarea();
    setupMenuToggle();
    setupClickOutsideHandlers();
    initContextMenus();
    initRenameModal();
    initDeleteModal();
    initScrollButton();
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
            const form = document.querySelector('.input-form');
            if (form) form.dispatchEvent(new Event('submit'));
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
    const sidebar = document.querySelector('.sidebar');
    const menuBtn = document.querySelector('.menu-btn');

    document.addEventListener('click', (e) => {
        if (sidebar && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !menuBtn.contains(e.target)) {
            sidebar.classList.remove('open');
        }

        const contextMenus = document.querySelectorAll('.context-menu');
        let clickedOnContextMenu = false;
        
        contextMenus.forEach(menu => {
            if (menu.contains(e.target)) clickedOnContextMenu = true;
        });
        
        if (!clickedOnContextMenu) hideContextMenus();
        if (editingMessage && !editingMessage.contains(e.target)) cancelEditMode();
    });
}

function initContextMenus() {
    const historyList = document.querySelector('.history-list');
    const historyContextMenu = document.querySelector('.history-context-menu');

    if (!historyList || !historyContextMenu) return;

    historyList.addEventListener('mousedown', (e) => {
        const listItem = e.target.closest('li');
        if (!listItem || !listItem.dataset.index || listItem.classList.contains('empty')) return;
        
        longPressTimer = setTimeout(() => {
            showContextMenu(e, listItem.dataset.index, historyContextMenu);
        }, 500);
    });

    historyList.addEventListener('mouseup', () => clearTimeout(longPressTimer));
    historyList.addEventListener('mouseleave', () => clearTimeout(longPressTimer));

    historyList.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const listItem = e.target.closest('li');
        if (!listItem || !listItem.dataset.index || listItem.classList.contains('empty')) return;
        showContextMenu(e, listItem.dataset.index, historyContextMenu);
    });

    historyList.addEventListener('touchstart', (e) => {
        const listItem = e.target.closest('li');
        if (!listItem || !listItem.dataset.index || listItem.classList.contains('empty')) return;
        
        longPressTimer = setTimeout(() => {
            const touch = e.touches[0];
            const syntheticEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {}
            };
            showContextMenu(syntheticEvent, listItem.dataset.index, historyContextMenu);
        }, 500);
    });

    historyList.addEventListener('touchend', () => clearTimeout(longPressTimer));
    historyList.addEventListener('touchcancel', () => clearTimeout(longPressTimer));

    document.addEventListener('click', function(e) {
        if (e.target.matches('.history-context-menu .rename-btn')) handleRename();
        else if (e.target.matches('.history-context-menu .delete-btn')) handleDelete();
    });
}

function handleRename() {
    const modal = document.getElementById('rename-modal');
    if (!modal) return;
    
    try {
        const chats = loadChats();
        if (contextMenuChatIndex !== null && chats[contextMenuChatIndex]) {
            const input = document.getElementById('rename-input');
            if (input) input.value = chats[contextMenuChatIndex].title || '';
        }
    } catch (error) {
        console.error('Error loading chat for rename:', error);
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
                const { updateChatTitle, loadChats } = await import('./storage.js');
                const { loadChatHistory } = await import('./chat.js');
                
                const chats = loadChats();
                const chat = chats[contextMenuChatIndex];
                if (chat) {
                    updateChatTitle(chat.id, newName);
                    loadChatHistory(loadChats());
                    showToast('Chat renamed successfully', 'success');
                }
            } catch (error) {
                console.error('Error renaming chat:', error);
                showToast('Failed to rename chat', 'error');
            }
        }
        closeModal(modal);
    });

    cancelBtn.addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });
}

function initDeleteModal() {
    const modal = document.getElementById('delete-modal');
    const deleteBtn = document.getElementById('delete-chat');
    const cancelBtn = document.getElementById('cancel-delete-chat');

    if (!modal || !deleteBtn || !cancelBtn) return;

    deleteBtn.addEventListener('click', async () => {
        if (contextMenuChatIndex !== null) {
            try {
                const { deleteChat, loadChats } = await import('./storage.js');
                const { loadChatHistory, startNewChat } = await import('./chat.js');
                
                const chats = loadChats();
                const chat = chats[contextMenuChatIndex];
                
                if (chat) {
                    deleteChat(chat.id);
                    loadChatHistory(loadChats());
                    showToast('Chat deleted successfully', 'success');
                    
                    const currentChatElement = document.querySelector('.history-list li.active');
                    if (currentChatElement && currentChatElement.dataset.chatId === chat.id) {
                        startNewChat();
                    }
                }
            } catch (error) {
                console.error('Error deleting chat:', error);
                showToast('Failed to delete chat', 'error');
            }
        }
        closeModal(modal);
    });

    cancelBtn.addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
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

function showContextMenu(e, index, menu) {
    if (!menu || !document.body.contains(menu)) return;
    
    e.preventDefault();
    hideContextMenus();
    
    menu.style.display = 'flex';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    contextMenuChatIndex = index;
    currentContextMenu = menu;

    setTimeout(() => {
        if (!document.body.contains(menu)) return;
        
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (e.clientX - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (e.clientY - rect.height) + 'px';
        menu.classList.add('show');
        menu.style.zIndex = '10000';
    }, 10);
}

function hideContextMenus() {
    const allContextMenus = document.querySelectorAll('.context-menu');
    allContextMenus.forEach(menu => {
        menu.classList.remove('show');
        menu.style.display = 'none';
    });
    
    if (currentContextMenu) {
        currentContextMenu.classList.remove('show');
        currentContextMenu.style.display = 'none';
    }
    
    currentContextMenu = null;
}

function closeModal(modal) {
    if (modal && modal.style) modal.style.display = 'none';
    contextMenuChatIndex = null;
}

// ... (previous imports remain the same)

export function addDownloadButton(content, container) {
    if (!container || !content) {
        console.warn('Invalid parameters for download button');
        return;
    }
    
    // Remove existing button if present
    const existingBtn = container.querySelector('.download-pdf-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    const btn = document.createElement('button');
    btn.className = 'download-pdf-btn';
    btn.innerHTML = `
        <div class="spinner" style="display: none;"></div>
        <span class="download-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 15V3M12 15L8 11M12 15L16 11M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15"
                      stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </span>
        <span class="btn-text">Download PDF</span>
    `;
    
    btn.addEventListener('click', async function() {
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner');
        const downloadIcon = btn.querySelector('.download-icon');
        
        // Set loading state
        btn.classList.add('loading');
        btn.disabled = true;
        if (btnText) btnText.textContent = 'Generating...';
        if (spinner) spinner.style.display = 'block';
        if (downloadIcon) downloadIcon.style.display = 'none';
        
        try {
            await generatePDF(container);
        } catch (error) {
            showToast('PDF Generation failed.', 'error');
            console.error('PDF generation failed:', error);
        } finally {
            // Reset button state
            btn.classList.remove('loading');
            btn.disabled = false;
            if (btnText) btnText.textContent = 'Download PDF';
            if (spinner) spinner.style.display = 'none';
            if (downloadIcon) downloadIcon.style.display = 'inline';
        }
    });
    
    // Add button to the most appropriate container
    const contentContainer = container.querySelector('.ai-message-content') ||
        container.querySelector('.ai-message') ||
        container;
    contentContainer.appendChild(btn);
}

//

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
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, duration);
}

window.updateScrollButtonVisibility = updateScrollButtonVisibility;