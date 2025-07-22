import { generatePDF } from './pdf.js';
import { deleteChat, loadChats } from './storage.js';

let longPressTimer;
let contextMenuChatIndex = null;
let currentContextMenu = null;
let editingMessage = null;

export function initUI() {
    console.log('Initializing UI...');
    
    // Setup input textarea
    setupInputTextarea();
    
    // Setup menu toggle
    setupMenuToggle();
    
    // Setup click outside handlers
    setupClickOutsideHandlers();
    
    // Setup context menus (only for history now)
    initContextMenus();
    
    // Setup modals
    initRenameModal();
    initDeleteModal();
    
    // Setup scroll button
    initScrollButton();
    
    console.log('UI initialized successfully');
}

function setupInputTextarea() {
    const promptTextarea = document.querySelector('.prompt-input');
    const sendButton = document.querySelector('.generate-btn');

    if (!promptTextarea || !sendButton) {
        console.error('Input elements not found');
        return;
    }

    promptTextarea.addEventListener('input', function () {
        // Auto-resize textarea
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        
        // Enable/disable send button
        sendButton.disabled = this.value.trim() === '';
    });

    // Handle keyboard shortcuts
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

    if (!menuBtn || !sidebar) {
        console.error('Menu elements not found');
        return;
    }

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
        console.log('Sidebar toggled:', sidebar.classList.contains('open'));
    });
}

function setupClickOutsideHandlers() {
    const sidebar = document.querySelector('.sidebar');
    const menuBtn = document.querySelector('.menu-btn');

    document.addEventListener('click', (e) => {
        // Auto-close sidebar when clicking outside it (but not on menu button)
        if (sidebar && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !menuBtn.contains(e.target)) {
            sidebar.classList.remove('open');
        }

        // Close context menus when clicking outside them
        const contextMenus = document.querySelectorAll('.context-menu');
        let clickedOnContextMenu = false;
        
        contextMenus.forEach(menu => {
            if (menu.contains(e.target)) {
                clickedOnContextMenu = true;
            }
        });
        
        if (!clickedOnContextMenu) {
            hideContextMenus();
        }
        
        // Cancel any active edit mode when clicking outside
        if (editingMessage && !editingMessage.contains(e.target)) {
            cancelEditMode();
        }
    });
}

function initContextMenus() {
    const historyList = document.querySelector('.history-list');
    const historyContextMenu = document.querySelector('.history-context-menu');

    if (!historyList || !historyContextMenu) {
        console.error('Context menu elements not found');
        return;
    }

    // History list context menu - Desktop
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

    // History list context menu - Mobile
    historyList.addEventListener('touchstart', (e) => {
        const listItem = e.target.closest('li');
        if (!listItem || !listItem.dataset.index || listItem.classList.contains('empty')) return;
        
        longPressTimer = setTimeout(() => {
            // Create a synthetic event for positioning
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

    // Context menu actions using event delegation
    document.addEventListener('click', function(e) {
        // History context menu actions
        if (e.target.matches('.history-context-menu .rename-btn')) {
            handleRename();
        }
        else if (e.target.matches('.history-context-menu .delete-btn')) {
            handleDelete();
        }
    });
}

function handleRename() {
    const modal = document.getElementById('rename-modal');
    if (!modal) return;
    
    try {
        const chats = loadChats();
        if (contextMenuChatIndex !== null && chats[contextMenuChatIndex]) {
            const input = document.getElementById('rename-input');
            if (input) {
                input.value = chats[contextMenuChatIndex].title || '';
            }
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

    if (!modal || !saveBtn || !cancelBtn || !input) {
        console.error('Rename modal elements not found');
        return;
    }

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
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });
}

function initDeleteModal() {
    const modal = document.getElementById('delete-modal');
    const deleteBtn = document.getElementById('delete-chat');
    const cancelBtn = document.getElementById('cancel-delete-chat');

    if (!modal || !deleteBtn || !cancelBtn) {
        console.error('Delete modal elements not found');
        return;
    }

    deleteBtn.addEventListener('click', async () => {
        if (contextMenuChatIndex !== null) {
            try {
                const { deleteChat, loadChats } = await import('./storage.js');
                const { loadChatHistory, startNewChat } = await import('./chat.js');
                
                const chats = loadChats();
                const chat = chats[contextMenuChatIndex];
                
                if (chat) {
                    const deletedChat = deleteChat(chat.id);
                    loadChatHistory(loadChats());
                    showToast('Chat deleted successfully', 'success');
                    
                    // If we're deleting the current chat, start a new one
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
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });
}

function initScrollButton() {
    const scrollButton = document.querySelector('.scroll-to-bottom-btn');
    const chatContainer = document.querySelector('.chat-container');

    if (!scrollButton || !chatContainer) {
        console.error('Scroll elements not found');
        return;
    }

    // Update visibility on scroll
    chatContainer.addEventListener('scroll', updateScrollButtonVisibility);

    // Scroll to bottom on click
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
    
    // Close any open context menus first
    hideContextMenus();
    
    menu.style.display = 'flex';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    contextMenuChatIndex = index;
    currentContextMenu = menu;

    // Adjust position if menu goes off screen
    setTimeout(() => {
        if (!document.body.contains(menu)) return;
        
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (e.clientX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (e.clientY - rect.height) + 'px';
        }
        menu.classList.add('show');
        
        // Bring to front
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
    if (modal && modal.style) {
        modal.style.display = 'none';
    }
    contextMenuChatIndex = null;
}

export function addDownloadButton(content, container) {
    if (!container || !content) {
        console.log('Invalid parameters for download button');
        return;
    }

    // Check if button already exists
    if (container.querySelector('.download-pdf-btn')) {
        console.log('Download button already exists');
        return;
    }
    
    console.log('Adding download button');
    
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
    
    btn.addEventListener('click', async function handleDownload() {
        // Show loading state
        btn.classList.add('loading');
        const btnText = btn.querySelector('.btn-text');
        const downloadIcon = btn.querySelector('.download-icon');
        const spinner = btn.querySelector('.spinner');
        
        if (btnText) btnText.textContent = 'Generating...';
        if (downloadIcon) downloadIcon.style.display = 'none';
        if (spinner) spinner.style.display = 'block';
        btn.disabled = true;
        
        try {
            console.log('Starting PDF download...');
            const pdfBlob = await generatePDF(container);
            
            // Trigger download
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ScribeAI-${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log('PDF download completed');
            
        } catch (error) {
            console.error('PDF generation failed:', error);
            
            // Show error toast
            showToast('Failed to generate PDF. Please try again.', 'error');
            
        } finally {
            // Reset button state
            btn.classList.remove('loading');
            if (btnText) btnText.textContent = 'Download PDF';
            if (downloadIcon) downloadIcon.style.display = '';
            if (spinner) spinner.style.display = 'none';
            btn.disabled = false;
        }
    });
    
    // Find the best place to insert the button
    const aiMessage = container.querySelector('.ai-message');
    const contentContainer = container.querySelector('.ai-message-content');
    
    if (contentContainer) {
        contentContainer.appendChild(btn);
        console.log('Download button added to content container');
    } else if (aiMessage) {
        aiMessage.appendChild(btn);
        console.log('Download button added to ai message');
    } else {
        container.appendChild(btn);
        console.log('Download button added to container');
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard');
        }).catch(err => {
            console.error('Could not copy text: ', err);
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('Copied to clipboard');
    } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
        showToast('Copy failed', 'error');
    }
    document.body.removeChild(textArea);
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

function editMessage(messageElement) {
    if (editingMessage) {
        cancelEditMode();
    }
    
    editingMessage = messageElement;
    const originalText = messageElement.textContent.trim();
    
    messageElement.classList.add('editing');
    messageElement.innerHTML = `
        <textarea class="edit-textarea">${originalText}</textarea>
        <div class="edit-buttons">
            <button class="save-edit-btn">Save</button>
            <button class="cancel-edit-btn">Cancel</button>
        </div>
    `;
    
    const textarea = messageElement.querySelector('.edit-textarea');
    const saveBtn = messageElement.querySelector('.save-edit-btn');
    const cancelBtn = messageElement.querySelector('.cancel-edit-btn');
    
    // Auto-resize textarea
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(textarea.scrollHeight, 100) + 'px';
    
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    
    // Auto-resize on input
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.max(this.scrollHeight, 100) + 'px';
    });
    
    saveBtn.onclick = (e) => {
        e.stopPropagation();
        saveEditedMessage(messageElement, textarea.value, originalText);
    };
    
    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cancelEditMode();
    };
    
    // Save on Ctrl+Enter or Cmd+Enter
    textarea.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            saveEditedMessage(messageElement, textarea.value, originalText);
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditMode();
        }
    });
}

async function saveEditedMessage(messageElement, newText, originalText) {
    if (newText.trim() === '') {
        showToast('Message cannot be empty', 'error');
        return;
    }
    
    if (newText.trim() === originalText.trim()) {
        cancelEditMode();
        return;
    }
    
    try {
        // Update the message content
        messageElement.classList.remove('editing');
        messageElement.textContent = newText.trim();
        editingMessage = null;
        
        showToast('Message edited - regenerating responses...', 'info');
        
        // Find the index of the edited message
        const chatContainer = document.querySelector('.chat-container');
        const allMessages = Array.from(chatContainer.children);
        const messageIndex = allMessages.indexOf(messageElement);
        
        if (messageIndex >= 0) {
            // Remove all messages after the edited one
            const messagesToRemove = allMessages.slice(messageIndex + 1);
            messagesToRemove.forEach(msg => msg.remove());
            
            // Import chat functions and regenerate response
            const chatModule = await import('./chat.js');
            
            // Generate new AI response based on the edited message
            if (typeof chatModule.generateAIResponse === 'function') {
                await chatModule.generateAIResponse(newText.trim());
            } else {
                // Fallback: use handleSubmit-like logic
                const event = new Event('submit');
                const form = document.querySelector('.input-form');
                const input = document.querySelector('.prompt-input');
                
                // Temporarily set the input value
                const originalValue = input.value;
                input.value = newText.trim();
                
                // Trigger generation
                if (typeof chatModule.handleSubmit === 'function') {
                    await chatModule.handleSubmit(event);
                }
                
                // Restore original input value
                input.value = originalValue;
            }
        }
        
    } catch (error) {
        console.error('Error saving edited message:', error);
        showToast('Failed to edit message', 'error');
        
        // Restore original message
        messageElement.classList.remove('editing');
        messageElement.textContent = originalText;
        editingMessage = null;
    }
}

function cancelEditMode() {
    if (editingMessage && document.body.contains(editingMessage)) {
        editingMessage.classList.remove('editing');
        
        // Get the original text from the textarea's value or restore from backup
        const textarea = editingMessage.querySelector('.edit-textarea');
        const originalText = textarea ? textarea.defaultValue : editingMessage.textContent.replace(/SaveCancel$/, '');
        
        editingMessage.textContent = originalText;
        editingMessage = null;
    }
}

// Make functions available globally if needed
window.updateScrollButtonVisibility = updateScrollButtonVisibility;
window.copyToClipboard = copyToClipboard;
window.editMessage = editMessage;