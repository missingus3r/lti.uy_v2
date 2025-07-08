document.addEventListener('DOMContentLoaded', function() {
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