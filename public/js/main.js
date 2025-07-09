document.addEventListener('DOMContentLoaded', function() {
    // Initialize AI Assistant
    initializeAssistant();
    
    const loginForm = document.getElementById('loginForm');
    const submitButton = document.getElementById('submitButton');
    const buttonText = document.getElementById('buttonText');
    const buttonLoader = document.getElementById('buttonLoader');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = usernameInput.value;
            const password = passwordInput.value;
            
            // Show loading state in button
            submitButton.disabled = true;
            buttonText.style.display = 'none';
            buttonLoader.style.display = 'inline-flex';
            buttonLoader.style.alignItems = 'center';
            
            // Disable input fields
            usernameInput.disabled = true;
            passwordInput.disabled = true;
            
            // Clear form fields immediately for security
            usernameInput.value = '';
            passwordInput.value = '';
            
            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Keep loading state while redirecting
                    if (data.isAdmin) {
                        window.location.href = data.redirectUrl || '/admin/dashboard';
                    } else {
                        window.location.href = '/welcome';
                    }
                } else {
                    // Reset button state
                    submitButton.disabled = false;
                    buttonText.style.display = 'inline';
                    buttonLoader.style.display = 'none';
                    
                    // Re-enable input fields
                    usernameInput.disabled = false;
                    passwordInput.disabled = false;
                    
                    // Restore username for convenience (but not password)
                    usernameInput.value = username;
                    
                    showErrorModal(data.message || 'Credenciales inválidas');
                }
            } catch (error) {
                // Reset button state
                submitButton.disabled = false;
                buttonText.style.display = 'inline';
                buttonLoader.style.display = 'none';
                
                // Re-enable input fields
                usernameInput.disabled = false;
                passwordInput.disabled = false;
                
                // Restore username for convenience
                usernameInput.value = username;
                
                showErrorModal('Error de conexión. Por favor, intenta nuevamente.');
            }
        });
    }
});

function showErrorModal(message) {
    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
    }
    if (errorModal) {
        errorModal.style.display = 'block';
    }
}

function closeModal() {
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
        errorModal.style.display = 'none';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const errorModal = document.getElementById('errorModal');
    if (event.target === errorModal) {
        errorModal.style.display = 'none';
    }
}

// AI Assistant Functionality
function initializeAssistant() {
    const toggleBtn = document.getElementById('assistant-toggle');
    const popup = document.getElementById('assistant-popup');
    const overlay = document.getElementById('assistant-overlay');
    const closeBtn = document.getElementById('assistant-close');
    const form = document.getElementById('assistant-form');
    const input = document.getElementById('assistant-input');
    const messages = document.getElementById('assistant-messages');

    // History panel elements
    const historyBtn = document.getElementById('assistant-history-btn');
    const newChatBtn = document.getElementById('assistant-new-chat');
    const historyPanel = document.getElementById('assistant-history-panel');
    const historyCloseBtn = document.getElementById('assistant-history-close');
    const clearHistoryBtn = document.getElementById('assistant-clear-history');
    const historyList = document.getElementById('assistant-history-list');

    // Debug: Check if elements exist
    console.log('Assistant elements:', {
        toggleBtn: !!toggleBtn,
        popup: !!popup,
        overlay: !!overlay,
        closeBtn: !!closeBtn,
        form: !!form,
        input: !!input,
        messages: !!messages
    });

    // Only initialize if elements exist (user is authenticated)
    if (!toggleBtn || !popup || !overlay) {
        console.log('Assistant elements not found, user probably not authenticated');
        return;
    }

    // Current session state
    let currentSessionId = null;

    // Toggle popup visibility
    toggleBtn.addEventListener('click', () => {
        console.log('Assistant button clicked');
        const isVisible = popup.style.display === 'flex' || window.getComputedStyle(popup).display === 'flex';
        console.log('Current popup display:', popup.style.display, 'isVisible:', isVisible);
        if (isVisible) {
            closeAssistant();
        } else {
            openAssistant();
        }
    });

    // Close popup functions
    function closeAssistant() {
        console.log('Closing assistant');
        popup.style.display = 'none';
        overlay.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    function openAssistant() {
        console.log('Opening assistant');
        popup.style.display = 'flex';
        overlay.style.display = 'block';
        document.body.classList.add('modal-open');
    }

    // Close popup on close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAssistant);
    }

    // Close popup on overlay click
    if (overlay) {
        overlay.addEventListener('click', closeAssistant);
    }

    // Close popup on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && popup && popup.style.display === 'flex') {
            closeAssistant();
        }
    });

    // Handle form submission
    if (form && input && messages) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const question = input.value.trim();
            if (!question) return;

            // Clear empty state if it exists
            const emptyState = messages.querySelector('.assistant-empty-state');
            if (emptyState) {
                emptyState.remove();
            }

            // Add user message
            const userMsg = document.createElement('div');
            userMsg.className = 'message user-message';
            userMsg.innerHTML = `<div class="message-content">${escapeHtml(question)}</div>`;
            messages.appendChild(userMsg);

            // Clear input
            input.value = '';

            // Add loading message
            const loadingMsg = document.createElement('div');
            loadingMsg.className = 'message assistant-message loading';
            loadingMsg.innerHTML = `<div class="message-content">Pensando...</div>`;
            messages.appendChild(loadingMsg);

            // Scroll to bottom
            messages.scrollTop = messages.scrollHeight;

            try {
                const response = await fetch('/assistant', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ question, sessionId: currentSessionId })
                });

                // Remove loading message
                loadingMsg.remove();

                if (response.ok) {
                    const data = await response.json();

                    if (data.answer) {
                        // Update current session ID
                        if (data.sessionId) {
                            currentSessionId = data.sessionId;
                        }

                        // Add assistant response
                        const assistantMsg = document.createElement('div');
                        assistantMsg.className = 'message assistant-message';
                        assistantMsg.innerHTML = `<div class="message-content">${parseMarkdown(data.answer)}</div>`;
                        messages.appendChild(assistantMsg);
                    } else {
                        // Add error message
                        const errorMsg = document.createElement('div');
                        errorMsg.className = 'message assistant-message error';
                        const errorText = data.error || 'No se pudo obtener una respuesta del asistente';
                        errorMsg.innerHTML = `<div class="message-content">❌ ${errorText}</div>`;
                        messages.appendChild(errorMsg);
                    }
                } else {
                    // Handle HTTP errors
                    const data = await response.json().catch(() => ({}));
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'message assistant-message error';

                    let errorText = 'Error inesperado';
                    if (response.status === 401) {
                        errorText = 'Debes iniciar sesión para usar el asistente';
                    } else if (response.status === 400) {
                        errorText = data.error || 'Solicitud inválida';
                    } else if (response.status === 408) {
                        errorText = '⏱️ La consulta tardó demasiado tiempo. Intenta nuevamente';
                    } else if (response.status === 429) {
                        errorText = '⏰ Límite de consultas alcanzado. Intenta más tarde';
                    } else if (response.status === 500) {
                        errorText = 'Error interno del servidor. Intenta nuevamente en unos momentos';
                    }

                    errorMsg.innerHTML = `<div class="message-content">❌ ${errorText}</div>`;
                    messages.appendChild(errorMsg);
                }
            } catch (error) {
                // Remove loading message
                loadingMsg.remove();

                // Add error message
                const errorMsg = document.createElement('div');
                errorMsg.className = 'message assistant-message error';

                let errorText = '🔌 Error de conexión';
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    errorText = '🔌 No se pudo conectar con el servidor. Verifica tu conexión a internet';
                } else if (error.name === 'AbortError') {
                    errorText = '⏱️ La solicitud tardó demasiado. Intenta nuevamente';
                } else {
                    errorText = '❌ Error inesperado. Intenta nuevamente en unos momentos';
                }

                errorMsg.innerHTML = `<div class="message-content">${errorText}</div>`;
                messages.appendChild(errorMsg);

                console.error('Assistant error:', error);
            }

            // Scroll to bottom
            messages.scrollTop = messages.scrollHeight;
        });
    }

    // History panel event listeners
    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            showHistoryPanel();
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            startNewChat();
        });
    }

    if (historyCloseBtn) {
        historyCloseBtn.addEventListener('click', () => {
            hideHistoryPanel();
        });
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres eliminar todo el historial de chat?')) {
                clearAllHistory();
            }
        });
    }

    // History panel functions
    function showHistoryPanel() {
        if (historyPanel) {
            historyPanel.style.display = 'flex';
            loadChatHistory();
        }
    }

    function hideHistoryPanel() {
        if (historyPanel) {
            historyPanel.style.display = 'none';
        }
    }

    function startNewChat() {
        currentSessionId = null;
        clearMessages();
        hideHistoryPanel();
    }

    function clearMessages() {
        if (messages) {
            messages.innerHTML = `
                <div class="assistant-empty-state">
                    <div class="assistant-empty-icon">💬</div>
                    <h4>¡Hola! Soy tu asistente de LTI.UY</h4>
                    <p>Pregúntame sobre tu progreso académico, materias, créditos, planes de carrera o cualquier duda sobre UTEC.</p>
                </div>
            `;
        }
    }

    async function loadChatHistory() {
        try {
            const response = await fetch('/assistant/history');
            const data = await response.json();

            if (data.chatHistory && data.chatHistory.length > 0) {
                displayChatHistory(data.chatHistory);
            } else {
                displayEmptyHistory();
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            displayEmptyHistory();
        }
    }

    function displayChatHistory(chatHistory) {
        if (!historyList) return;

        historyList.innerHTML = '';

        chatHistory.forEach(chat => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

            const lastMessage = chat.messages && chat.messages.length > 0
                ? chat.messages[chat.messages.length - 1]
                : null;

            // Create a clean preview
            const cleanPreview = (text) => {
                if (!text) return text;
                return text
                    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
                    .replace(/\*([^*\s][^*]*[^*\s])\*/g, '$1') // Remove italics
                    .replace(/\n+/g, ' ') // Replace newlines with space
                    .trim();
            };

            const preview = lastMessage
                ? (lastMessage.role === 'user' ? cleanPreview(lastMessage.content) : 'Asistente: ' + cleanPreview(lastMessage.content))
                : 'Conversación vacía';

            const date = new Date(chat.metadata.lastActivity).toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            historyItem.innerHTML = `
                <div class="history-item-date">${date}</div>
                <div class="history-item-preview">${escapeHtml(preview.substring(0, 100))}${preview.length > 100 ? '...' : ''}</div>
                <div class="history-item-meta">
                    <span>${chat.metadata.totalMessages} mensajes</span>
                    <button class="history-item-delete" onclick="deleteChatSession('${chat.sessionId}')">
                        Eliminar
                    </button>
                </div>
            `;

            historyItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('history-item-delete')) {
                    loadChatSession(chat.sessionId);
                }
            });

            historyList.appendChild(historyItem);
        });
    }

    function displayEmptyHistory() {
        if (historyList) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <div class="history-empty-icon">💬</div>
                    <p>No hay conversaciones anteriores</p>
                </div>
            `;
        }
    }

    async function loadChatSession(sessionId) {
        try {
            const response = await fetch(`/assistant/session/${sessionId}`);
            const data = await response.json();

            if (data.chatSession) {
                currentSessionId = sessionId;
                displayChatSession(data.chatSession);
                hideHistoryPanel();
            }
        } catch (error) {
            console.error('Error loading chat session:', error);
        }
    }

    function displayChatSession(chatSession) {
        if (!messages) return;

        messages.innerHTML = '';

        chatSession.messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.role}-message`;
            const content = msg.role === 'assistant' ? parseMarkdown(msg.content) : escapeHtml(msg.content);
            messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
            messages.appendChild(messageDiv);
        });

        messages.scrollTop = messages.scrollHeight;
    }

    async function clearAllHistory() {
        try {
            const response = await fetch('/assistant/history', {
                method: 'DELETE'
            });

            if (response.ok) {
                loadChatHistory();
                startNewChat();
            }
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    }

    // Global function for deleting individual sessions
    window.deleteChatSession = async function(sessionId) {
        if (confirm('¿Eliminar esta conversación?')) {
            try {
                const response = await fetch(`/assistant/session/${sessionId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    loadChatHistory();
                    if (currentSessionId === sessionId) {
                        startNewChat();
                    }
                }
            } catch (error) {
                console.error('Error deleting chat session:', error);
            }
        }
    };
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Simple markdown parser for assistant responses
function parseMarkdown(text) {
    if (!text) return text;
    
    return text
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*\s][^*]*[^*\s])\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Line breaks
        .replace(/\n/g, '<br>')
        // Lists
        .replace(/^\* (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
}

// Debug: Check if assistant button exists after everything is loaded
setTimeout(() => {
    const btn = document.getElementById('assistant-toggle');
    console.log('Final check - Assistant button exists:', !!btn);
    if (btn) {
        console.log('Button is visible:', btn.offsetParent !== null);
        console.log('Button computed style display:', window.getComputedStyle(btn).display);
    }
}, 1000);