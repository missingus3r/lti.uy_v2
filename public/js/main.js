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
                    
                    showErrorModal(data.message || 'Credenciales inválidas', data);
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

function showErrorModal(message, data = {}) {
    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    const errorTitle = document.getElementById('errorTitle');
    const blockInfo = document.getElementById('blockInfo');
    const blockMessage = document.getElementById('blockMessage');
    const countdownTimer = document.getElementById('countdownTimer');
    const modalContent = document.querySelector('#errorModal .modal-content');
    const modalButtonText = document.getElementById('modalButtonText');
    const submitButton = document.getElementById('submitButton');
    
    if (errorMessage) {
        errorMessage.textContent = message;
    }
    
    // Handle blocked users
    if (data.isBlocked && data.blockExpiresAt) {
        if (errorTitle) {
            errorTitle.textContent = 'Cuenta Bloqueada';
            errorTitle.style.color = 'var(--error)';
        }
        
        if (modalContent) {
            modalContent.classList.add('blocked');
        }
        
        if (blockInfo && blockMessage && countdownTimer) {
            blockInfo.style.display = 'block';
            blockMessage.textContent = `Tu cuenta está bloqueada temporalmente por intentos de login fallidos.`;
            
            const blockExpiresAt = new Date(data.blockExpiresAt);
            
            // Function to calculate remaining time dynamically
            const calculateRemainingTime = () => {
                const now = new Date();
                const timeLeft = Math.max(0, Math.ceil((blockExpiresAt - now) / 1000));
                return timeLeft;
            };
            
            let timeLeft = calculateRemainingTime();
            updateCountdown(timeLeft, countdownTimer);
            
            // Update countdown every second with real-time calculation
            const countdownInterval = setInterval(() => {
                timeLeft = calculateRemainingTime();
                if (timeLeft <= 0) {
                    clearInterval(countdownInterval);
                    closeModal();
                    // Re-enable the submit button when countdown ends
                    if (submitButton) {
                        submitButton.disabled = false;
                    }
                } else {
                    updateCountdown(timeLeft, countdownTimer);
                }
            }, 1000);
        }
        
        if (modalButtonText) {
            modalButtonText.textContent = 'Entendido';
        }
    } else {
        // Regular error handling
        if (errorTitle) {
            errorTitle.textContent = 'Error de Autenticación';
            errorTitle.style.color = 'var(--error)';
        }
        
        if (modalContent) {
            modalContent.classList.remove('blocked');
        }
        
        if (blockInfo) {
            blockInfo.style.display = 'none';
        }
        
        if (modalButtonText) {
            modalButtonText.textContent = 'Intentar nuevamente';
        }
        
        // Show remaining attempts if available
        if (data.remainingAttempts !== undefined) {
            showAttemptAlert(data.remainingAttempts);
        }
    }
    
    if (errorModal) {
        errorModal.style.display = 'block';
    }
}

function updateCountdown(seconds, element) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timeString = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    element.textContent = `Tiempo restante: ${timeString}`;
}

function showAttemptAlert(remainingAttempts) {
    const attemptAlert = document.getElementById('attemptAlert');
    const attemptMessage = document.getElementById('attemptMessage');
    
    if (attemptAlert && attemptMessage) {
        attemptAlert.style.display = 'block';
        
        if (remainingAttempts <= 1) {
            attemptAlert.className = 'attempt-alert error';
            attemptMessage.textContent = `⚠️ Último intento restante. Tu cuenta será bloqueada si fallas nuevamente.`;
        } else {
            attemptAlert.className = 'attempt-alert warning';
            attemptMessage.textContent = `Tienes ${remainingAttempts} intentos restantes antes de que tu cuenta sea bloqueada.`;
        }
        
        // Hide alert after 5 seconds
        setTimeout(() => {
            attemptAlert.style.display = 'none';
        }, 5000);
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

    // Only initialize if elements exist (user is authenticated)
    if (!toggleBtn || !popup || !overlay) {
        return;
    }

    // Current session state
    let currentSessionId = null;

    // Function to get user context from the page
    function getUserContext() {
        const context = {
            user: {
                username: '',
                registrationDate: null,
                selectedPlan: 'No seleccionado',
                lastDataUpdate: null,
                manualRefreshCount: 0
            },
            academicProgress: null,
            careerPlans: {
                available: [],
                selected: null
            },
            utecInfo: {
                institution: 'Universidad Tecnológica del Uruguay (UTEC)',
                career: 'Licenciatura en Tecnologías de la Información (LTI)',
                platform: 'LTI.UY - Plataforma no oficial para estudiantes de LTI',
                platformCreators: 'Bruno Silveira, José Faller y Mariano Collazo (Licenciados en TI de UTEC)',
                platformFeatures: [
                    'Información y Servicios: Encuentra información de la carrera, hoteles, taxis y servicios útiles de las diferentes sedes de UTEC',
                    'Seguimiento de Progreso: Visualiza tu avance en la carrera y mantén un registro de tus calificaciones y créditos',
                    'Acceso Seguro: Utiliza tus credenciales de UTEC para acceder. No almacenamos ningún dato personal',
                    'Asistente IA V2.0: Nuevo asistente virtual integrado que te ayuda con consultas académicas, información sobre materias y dudas sobre LTI y UTEC'
                ],
                utecSites: {
                    portalAcademico: {
                        description: 'Accede a tu información académica oficial',
                        links: ['https://portal.utec.edu.uy', 'https://portaluxxi.utec.edu.uy', 'https://apps.utec.edu.uy/jsloader/ac/matricula#/acceso/bienvenida (Matrículas)']
                    },
                    plataformasAprendizaje: {
                        description: 'Recursos educativos y entornos virtuales',
                        links: ['https://ev1.utec.edu.uy (EVA/Moodle)', 'https://edu.utec.edu.uy (EDU)', 'https://airtable.com/shrm963356m0de6lj/tblUnEnOv4jH2Ovgk (Inscripción APEs)', 'https://taa.utec.edu.uy (TAA)', 'https://scaleup.utec.edu.uy (Aulas Scale Up)']
                    },
                    herramientasAcademicas: {
                        description: 'Gestión de cuenta y recursos digitales',
                        links: ['https://pwm.utec.edu.uy (Gestión de Cuenta)', 'https://red.utec.edu.uy (Recursos Digitales)']
                    },
                    soporteServicios: {
                        description: 'Ayuda técnica y servicios estudiantiles',
                        links: ['https://mds.utec.edu.uy (Mesa de Servicio)', 'https://mda.utec.edu.uy (Mesa de Ayuda)', 'https://erp.utec.edu.uy/jobs (Ofertas Laborales)', 'https://utec.netlanguages.com/utec/login.php (Net Languages)']
                    },
                    desarrolloTecnologia: {
                        description: 'Plataformas de desarrollo y testing',
                        links: ['https://git.utec.edu.uy (Git UTEC)', 'https://aichallenge.utec.edu.uy (AI Challenge)', 'https://mantis.utec.edu.uy (Mantis Bug Tracker)', 'https://testlink.utec.edu.uy (Testlink)']
                    },
                    sitioOficial: {
                        description: 'Información general e inscripciones',
                        links: ['https://utec.edu.uy (Página Principal)', 'https://descubri.utec.edu.uy (Descubrí UTEC)']
                    }
                },
                careerRequirements: {
                    connectivity: 'Conexión a internet estable para acceder a recursos digitales y plataformas virtuales',
                    hardware: {
                        os: 'Windows 64 bits (macOS y Linux compatibles)',
                        ram: '16 GB mínimo, 32-64 GB recomendado',
                        processor: 'Con capacidad de virtualización',
                        storage: '1 TB mínimo',
                        extras: 'Webcam y micrófono'
                    },
                    previaturas: 'Revisa constantemente las materias aprobadas y habilitaciones para evitar retrasos'
                },
                admission: {
                    quotaDistribution: {
                        interior: '90% de los cupos para estudiantes del interior del país',
                        montevideo: '10% de los cupos para estudiantes de Montevideo',
                        gender: '50% varones, 50% mujeres'
                    },
                    mobilityRestrictions: 'No podrán solicitar cambio de sede hasta obtener al menos la titulación intermedia',
                    inscriptionPeriod: 'Anualmente entre noviembre y diciembre',
                    requiredDocuments: [
                        'Constancia de domicilio expedida por el Ministerio del Interior (últimos 12 meses)',
                        'Cédula de Identidad vigente',
                        'Carné de salud vigente',
                        'Pase de la institución habilitante: Fórmula 69A o Constancia de Egreso',
                        'Carta motivación explicando por qué querés estudiar la carrera'
                    ]
                },
                presentialInstances: {
                    schedule: 'Principalmente en el último mes de cada semestre',
                    frequency: '5 a 7 instancias en diferentes horarios',
                    duration: 'Jornadas de día completo o medio día, en el rango de 9 a 17 horas',
                    purpose: 'Evaluación de cursos y proyectos',
                    additionalActivities: 'Actividades de complementación de cursos, vinculación con el medio empresarial'
                },
                sedes: {
                    durazno: {
                        name: 'ITR SO (Durazno)',
                        email: 'secretaria.lti.itrso@utec.edu.uy',
                        services: {
                            hotels: ['Hotel Durazno: 4362 2040', 'Hotel Santa Cristina: 4362 2525 / 094 161 111', 'Plaza Apart Hotel: 4362 9999', 'Patio Sarandí: 4363 1303', 'Hotel Central: 4362 0305'],
                            taxis: ['Radio Taxi La Paz: 4362 9090', 'Taxi Penza: 4362 0850', '4362 1031 / 4362 1001']
                        }
                    },
                    frayBentos: {
                        name: 'ITR CS (Fray Bentos)',
                        email: 'secretaria.lti.itrcs@utec.edu.uy',
                        services: {
                            hotels: ['Gran Hotel Fray Bentos: 4562 0566', 'Plaza Hotel Fray Bentos: 4562 2363', 'Hotel 25 de Mayo: 4562 2586', 'Suculento Apart: Ver en Booking.com'],
                            taxis: ['City Taxi: 4562 5050', 'Taxi 1313: 4562 1313 / 099 563 963', '4562 7057 / 4562 2121']
                        }
                    },
                    minas: {
                        name: 'Minas',
                        email: 'secretaria.lti.minas@utec.edu.uy'
                    },
                    melo: {
                        name: 'Melo',
                        email: 'secretaria.lti.melo@utec.edu.uy'
                    }
                },
                frequentQuestions: {
                    matriculation: 'Video explicativo disponible en la plataforma para matricularse a las materias',
                    platformOwnership: 'Este proyecto es realizado por estudiantes recibidos de la UTEC, para estudiantes de la UTEC. No es oficial de UTEC.',
                    graduation: {
                        requestPeriods: 'Mayo y noviembre de cada año',
                        process: 'Solicitud a través del ESPACIO COLABORATIVO anual del EVA',
                        requirements: [
                            'Verificar total de créditos obtenidos y unidades curriculares aprobadas',
                            'Certificado de nivel de inglés requerido',
                            'Cédula de identidad vigente',
                            'Carné de salud vigente'
                        ],
                        important: 'El nombre en el título será exactamente igual al de la cédula de identidad'
                    }
                },
                legalDisclaimer: 'Todos los logotipos, marcas, imágenes, textos y demás elementos son propiedad exclusiva de UTEC. Este sitio tiene como cometido facilitar información y reunir a los diferentes actores involucrados en la carrera LTI.'
            }
        };

        // Try to get data from global variables if they exist (from welcome.ejs)
        if (typeof studentProgress !== 'undefined' && studentProgress) {
            // Get the real total credits from DOM (includes both tables)
            const totalCreditsEl = document.getElementById('totalCredits');
            const realTotalCredits = totalCreditsEl ? parseInt(totalCreditsEl.textContent) || 0 : studentProgress.totalCredits || 0;
            const requiredCredits = studentProgress.requiredCredits || 360;
            
            // Calculate progress percentage (max 100%)
            const rawPercentage = (realTotalCredits / requiredCredits) * 100;
            const progressPercentage = Math.min(100, Math.round(rawPercentage));
            
            // Separate subjects by type
            const planSubjects = studentProgress.subjects || [];
            const additionalSubjects = [];
            
            // Get additional subjects from the additional subjects table
            const additionalRows = document.querySelectorAll('#additionalSubjectsTable tbody tr');
            if (additionalRows.length > 0) {
                additionalRows.forEach(row => {
                    if (row.cells.length >= 5) {
                        const subject = {
                            name: row.cells[0].textContent.trim(),
                            credits: parseInt(row.cells[1].textContent) || 0,
                            type: row.cells[2].textContent.trim(),
                            convocatoria: row.cells[3].textContent.trim(),
                            grade: row.cells[4].textContent.trim(),
                            passed: row.classList.contains('subject-passed'),
                            isAdditional: true
                        };
                        additionalSubjects.push(subject);
                    }
                });
            }
            
            // Include full academic progress data with better structure
            context.academicProgress = {
                // Credit summary
                creditsSummary: {
                    totalEarned: realTotalCredits,
                    requiredForGraduation: requiredCredits,
                    progressPercentage: progressPercentage,
                    remainingCredits: Math.max(0, requiredCredits - realTotalCredits),
                    surplusCredits: Math.max(0, realTotalCredits - requiredCredits),
                    hasCompletedRequirements: realTotalCredits >= requiredCredits
                },
                
                // Subjects from the career plan
                planSubjects: {
                    subjects: planSubjects,
                    total: planSubjects.length,
                    passed: planSubjects.filter(s => s.passed).length,
                    pending: planSubjects.filter(s => !s.passed).length,
                    creditsFromPlan: planSubjects.filter(s => s.passed).reduce((sum, s) => sum + (s.credits || 0), 0)
                },
                
                // Additional subjects (electives, VME, APEs)
                additionalSubjects: {
                    subjects: additionalSubjects,
                    total: additionalSubjects.length,
                    passed: additionalSubjects.filter(s => s.passed).length,
                    creditsFromAdditional: additionalSubjects.filter(s => s.passed).reduce((sum, s) => sum + (s.credits || 0), 0)
                },
                
                // Combined totals
                allSubjects: {
                    total: planSubjects.length + additionalSubjects.length,
                    passed: planSubjects.filter(s => s.passed).length + additionalSubjects.filter(s => s.passed).length,
                    allSubjectsList: [...planSubjects, ...additionalSubjects]
                },
                
                lastUpdated: studentProgress.lastUpdated || new Date()
            };
        }

        if (typeof currentCareerPlan !== 'undefined' && currentCareerPlan) {
            context.careerPlans.selected = currentCareerPlan;
            context.user.selectedPlan = currentCareerPlan.name;
        }

        // Get all available career plans from the select element
        const planSelect = document.getElementById('planSelect');
        if (planSelect && planSelect.options.length > 1) {
            context.careerPlans.available = [];
            for (let i = 1; i < planSelect.options.length; i++) {
                const option = planSelect.options[i];
                const planName = option.textContent.split(' (')[0];
                const creditsMatch = option.textContent.match(/\((\d+) créditos\)/);
                const credits = creditsMatch ? parseInt(creditsMatch[1]) : 0;
                
                context.careerPlans.available.push({
                    _id: option.value,
                    name: planName,
                    totalCredits: credits
                });
            }
        }

        // Try to get user info from DOM elements
        const welcomeHeader = document.querySelector('.welcome-header h1');
        if (welcomeHeader) {
            const match = welcomeHeader.textContent.match(/¡Hola, (.+)!/);
            if (match) {
                context.user.username = match[1];
            }
        }

        // Get progress info from DOM if not available from global vars
        const totalCreditsEl = document.getElementById('totalCredits');
        const requiredCreditsEl = document.getElementById('requiredCredits');
        const remainingCreditsEl = document.getElementById('remainingCredits');
        const progressBar = document.getElementById('progressBar');
        
        if (totalCreditsEl && requiredCreditsEl && remainingCreditsEl && !context.academicProgress) {
            // If no academic progress from global var, try to construct from DOM
            const totalCredits = parseInt(totalCreditsEl.textContent) || 0;
            const requiredCredits = parseInt(requiredCreditsEl.textContent) || 360;
            const remainingCredits = parseInt(remainingCreditsEl.textContent) || 360;
            const rawPercentage = progressBar ? parseInt(progressBar.style.width) || 0 : 0;
            const progressPercentage = Math.min(100, rawPercentage);
            
            const planSubjects = [];
            const additionalSubjects = [];
            
            // Get subjects from main table (plan subjects)
            const subjectsRows = document.querySelectorAll('#subjectsTable tbody tr');
            subjectsRows.forEach(row => {
                if (!row.classList.contains('semester-header') && row.cells.length >= 5) {
                    const subject = {
                        name: row.cells[0].textContent.trim(),
                        credits: parseInt(row.cells[1].textContent) || 0,
                        type: row.cells[2].textContent.trim(),
                        convocatoria: row.cells[3].textContent.trim(),
                        grade: row.cells[4].textContent.trim(),
                        passed: row.classList.contains('subject-passed'),
                        isAdditional: false
                    };
                    planSubjects.push(subject);
                }
            });
            
            // Get additional subjects from the second table
            const additionalRows = document.querySelectorAll('#additionalSubjectsTable tbody tr');
            additionalRows.forEach(row => {
                if (row.cells.length >= 5) {
                    const subject = {
                        name: row.cells[0].textContent.trim(),
                        credits: parseInt(row.cells[1].textContent) || 0,
                        type: row.cells[2].textContent.trim(),
                        convocatoria: row.cells[3].textContent.trim(),
                        grade: row.cells[4].textContent.trim(),
                        passed: row.classList.contains('subject-passed'),
                        isAdditional: true
                    };
                    additionalSubjects.push(subject);
                }
            });
            
            context.academicProgress = {
                // Credit summary
                creditsSummary: {
                    totalEarned: totalCredits,
                    requiredForGraduation: requiredCredits,
                    progressPercentage: progressPercentage,
                    remainingCredits: Math.max(0, remainingCredits),
                    surplusCredits: Math.max(0, totalCredits - requiredCredits),
                    hasCompletedRequirements: totalCredits >= requiredCredits
                },
                
                // Subjects from the career plan
                planSubjects: {
                    subjects: planSubjects,
                    total: planSubjects.length,
                    passed: planSubjects.filter(s => s.passed).length,
                    pending: planSubjects.filter(s => !s.passed).length,
                    creditsFromPlan: planSubjects.filter(s => s.passed).reduce((sum, s) => sum + (s.credits || 0), 0)
                },
                
                // Additional subjects (electives, VME, APEs)
                additionalSubjects: {
                    subjects: additionalSubjects,
                    total: additionalSubjects.length,
                    passed: additionalSubjects.filter(s => s.passed).length,
                    creditsFromAdditional: additionalSubjects.filter(s => s.passed).reduce((sum, s) => sum + (s.credits || 0), 0)
                },
                
                // Combined totals
                allSubjects: {
                    total: planSubjects.length + additionalSubjects.length,
                    passed: planSubjects.filter(s => s.passed).length + additionalSubjects.filter(s => s.passed).length,
                    allSubjectsList: [...planSubjects, ...additionalSubjects]
                },
                
                lastUpdated: new Date()
            };
        }

        // Get refresh information
        const refreshesLeftEl = document.getElementById('refreshesLeft');
        if (refreshesLeftEl) {
            context.user.manualRefreshCount = parseInt(refreshesLeftEl.textContent) || 0;
        }

        return context;
    }

    // Toggle popup visibility
    toggleBtn.addEventListener('click', () => {
        const isVisible = popup.style.display === 'flex' || window.getComputedStyle(popup).display === 'flex';
        if (isVisible) {
            closeAssistant();
        } else {
            openAssistant();
        }
    });

    // Close popup functions
    function closeAssistant() {
        popup.style.display = 'none';
        overlay.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    function openAssistant() {
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
            const assistantMsg = document.createElement('div');
            assistantMsg.className = 'message assistant-message loading';
            assistantMsg.innerHTML = `
                <div class="message-content">
                    <span class="loading-text">Pensando</span>
                    <span class="loading-dots">
                        <span>.</span><span>.</span><span>.</span>
                    </span>
                </div>
            `;
            messages.appendChild(assistantMsg);

            // Scroll to bottom
            messages.scrollTop = messages.scrollHeight;

            // Force DOM update before making the request
            await new Promise(resolve => setTimeout(resolve, 10));

            try {
                // Get current user context
                const context = getUserContext();
                console.log('📊 Contexto enviado al asistente:', context);
                
                const response = await fetch('/assistant', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ question, sessionId: currentSessionId, context })
                });

                if (response.ok) {
                    const data = await response.json();

                    if (data.answer) {
                        // Update current session ID
                        if (data.sessionId) {
                            currentSessionId = data.sessionId;
                        }

                        // Replace loading message with assistant response
                        assistantMsg.className = 'message assistant-message';
                        assistantMsg.innerHTML = `<div class="message-content">${parseMarkdown(data.answer)}</div>`;
                    } else {
                        // Replace loading message with error message
                        assistantMsg.className = 'message assistant-message error';
                        const errorText = data.error || 'No se pudo obtener una respuesta del asistente';
                        assistantMsg.innerHTML = `<div class="message-content">❌ ${errorText}</div>`;
                    }
                } else {
                    // Handle HTTP errors
                    const data = await response.json().catch(() => ({}));
                    assistantMsg.className = 'message assistant-message error';

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

                    assistantMsg.innerHTML = `<div class="message-content">❌ ${errorText}</div>`;
                }
            } catch (error) {
                // Replace loading message with error message
                assistantMsg.className = 'message assistant-message error';

                let errorText = '🔌 Error de conexión';
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    errorText = '🔌 No se pudo conectar con el servidor. Verifica tu conexión a internet';
                } else if (error.name === 'AbortError') {
                    errorText = '⏱️ La solicitud tardó demasiado. Intenta nuevamente';
                } else {
                    errorText = '❌ Error inesperado. Intenta nuevamente en unos momentos';
                }

                assistantMsg.innerHTML = `<div class="message-content">${errorText}</div>`;

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
            // Ocultar el contenido del chat principal
            const chatContent = document.getElementById('assistant-messages');
            const chatForm = document.getElementById('assistant-form');
            const chatDisclaimer = document.getElementById('assistant-disclaimer');
            
            if (chatContent) chatContent.style.display = 'none';
            if (chatForm) chatForm.style.display = 'none';
            if (chatDisclaimer) chatDisclaimer.style.display = 'none';
            
            // Mostrar el panel de historial
            historyPanel.style.display = 'flex';
            loadChatHistory();
        }
    }

    function hideHistoryPanel() {
        if (historyPanel) {
            // Ocultar el panel de historial
            historyPanel.style.display = 'none';
            
            // Mostrar el contenido del chat principal
            const chatContent = document.getElementById('assistant-messages');
            const chatForm = document.getElementById('assistant-form');
            const chatDisclaimer = document.getElementById('assistant-disclaimer');
            
            if (chatContent) chatContent.style.display = 'block';
            if (chatForm) chatForm.style.display = 'flex';
            if (chatDisclaimer) chatDisclaimer.style.display = 'block';
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
    
    let result = text;
    
    // Handle tables first
    result = parseMarkdownTables(result);
    
    // Handle lists
    result = parseMarkdownLists(result);
    
    return result
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*\s][^*]*[^*\s])\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Line breaks
        .replace(/\n/g, '<br>');
}

// Parse markdown tables
function parseMarkdownTables(text) {
    const tableRegex = /(\|[^\n]+\|[\s]*\n)+/g;
    
    return text.replace(tableRegex, (match) => {
        const lines = match.trim().split('\n');
        if (lines.length < 2) return match;
        
        let tableHTML = '<table class="assistant-table">';
        let isHeader = true;
        
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('|') || !trimmedLine.endsWith('|')) return;
            
            // Skip separator lines (contain only |, -, and spaces)
            if (/^\|[\s\-|]+\|$/.test(trimmedLine)) return;
            
            const cells = trimmedLine.slice(1, -1).split('|').map(cell => cell.trim());
            
            if (isHeader) {
                tableHTML += '<thead><tr>';
                cells.forEach(cell => {
                    tableHTML += `<th>${cell}</th>`;
                });
                tableHTML += '</tr></thead><tbody>';
                isHeader = false;
            } else {
                tableHTML += '<tr>';
                cells.forEach(cell => {
                    tableHTML += `<td>${cell}</td>`;
                });
                tableHTML += '</tr>';
            }
        });
        
        tableHTML += '</tbody></table>';
        return tableHTML;
    });
}

// Parse markdown lists
function parseMarkdownLists(text) {
    const lines = text.split('\n');
    const result = [];
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i].trim();
        
        // Check if it's a list item starting with *
        if (line.startsWith('* ')) {
            const listItems = [];
            let listType = 'ul'; // Default to unordered list
            
            // Check if it's a numbered list by looking at the content
            const content = line.substring(2).trim();
            if (/^\d+\./.test(content) || isNumberedListContext(lines, i)) {
                listType = 'ol';
            }
            
            // Collect all consecutive list items
            while (i < lines.length && lines[i].trim().startsWith('* ')) {
                const itemContent = lines[i].trim().substring(2).trim();
                // Remove number prefix if it exists for ordered lists
                const cleanContent = listType === 'ol' ? itemContent.replace(/^\d+\.\s*/, '') : itemContent;
                listItems.push(cleanContent);
                i++;
            }
            
            // Create the list HTML
            const listHTML = `<${listType}>${listItems.map(item => `<li>${item}</li>`).join('')}</${listType}>`;
            result.push(listHTML);
            i--; // Back up one since the loop will increment
        } else {
            result.push(line);
        }
        i++;
    }
    
    return result.join('\n');
}

// Helper function to determine if a list should be numbered
function isNumberedListContext(lines, startIndex) {
    // Look for numbered patterns in the first few items
    for (let i = startIndex; i < Math.min(startIndex + 3, lines.length); i++) {
        const line = lines[i].trim();
        if (!line.startsWith('* ')) break;
        
        const content = line.substring(2).trim();
        if (/^\d+\./.test(content)) return true;
    }
    
    // Check if previous context suggests numbering
    for (let i = Math.max(0, startIndex - 5); i < startIndex; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('pasos') || line.includes('etapas') || line.includes('fases') || 
            line.includes('procedimiento') || line.includes('proceso') || line.includes('orden')) {
            return true;
        }
    }
    
    return false;
}