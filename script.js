const GEMINI_API_KEY = 'AIzaSyCa2FEkuu8B4ngHRqEwLGGv28_jmn96oFo';
const SERVICE_ID = 'service_bye3v3e';
const TEMPLATE_ID = 'template_g7debpg';
const PUBLIC_KEY = 'dgkzTtICwD5tVpKbL';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL_CANDIDATES = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-pro'
];
let discoveredGeminiModel = null;

const questions = [
    {
        id: 1,
        question: 'What is your monthly income range?',
        options: [
            { value: 20, label: 'Below ₹25,000', description: 'Entry level income' },
            { value: 40, label: '₹25,000 - ₹50,000', description: 'Mid-level income' },
            { value: 60, label: '₹50,000 - ₹1,00,000', description: 'Upper-mid level' },
            { value: 80, label: 'Above ₹1,00,000', description: 'High income' }
        ]
    },
    {
        id: 2,
        question: 'How much of your income do you save regularly?',
        options: [
            { value: 10, label: 'Less than 10%', description: 'Minimal savings' },
            { value: 30, label: '10% - 20%', description: 'Basic savings' },
            { value: 60, label: '20% - 30%', description: 'Good savings habit' },
            { value: 90, label: 'More than 30%', description: 'Excellent saver' }
        ]
    },
    {
        id: 3,
        question: 'Do you have an emergency fund?',
        options: [
            { value: 0, label: 'No emergency fund', description: 'High risk' },
            { value: 30, label: '1-3 months expenses', description: 'Basic coverage' },
            { value: 70, label: '3-6 months expenses', description: 'Good coverage' },
            { value: 100, label: '6+ months expenses', description: 'Excellent coverage' }
        ]
    },
    {
        id: 4,
        question: 'How comfortable are you with investments?',
        options: [
            { value: 20, label: 'Not investing', description: 'No investment experience' },
            { value: 40, label: 'Only fixed deposits', description: 'Very conservative' },
            { value: 70, label: 'Mutual funds/stocks', description: 'Moderate risk taker' },
            { value: 90, label: 'Diversified portfolio', description: 'Advanced investor' }
        ]
    },
    {
        id: 5,
        question: 'Do you track your expenses?',
        options: [
            { value: 10, label: 'Never track', description: 'No awareness' },
            { value: 40, label: 'Occasionally', description: 'Some awareness' },
            { value: 70, label: 'Monthly tracking', description: 'Good habit' },
            { value: 100, label: 'Daily tracking', description: 'Excellent control' }
        ]
    },
    {
        id: 6,
        question: 'What is your loan/EMI situation?',
        options: [
            { value: 100, label: 'No loans', description: 'Debt-free' },
            { value: 60, label: 'Small EMIs', description: 'Manageable debt' },
            { value: 30, label: 'Multiple EMIs', description: 'High debt burden' },
            { value: 10, label: 'Credit card debt', description: 'Critical situation' }
        ]
    },
    {
        id: 7,
        question: 'Do you have insurance coverage?',
        options: [
            { value: 0, label: 'No insurance', description: 'Not protected' },
            { value: 40, label: 'Only employer insurance', description: 'Basic coverage' },
            { value: 80, label: 'Health + Life insurance', description: 'Well protected' },
            { value: 100, label: 'Comprehensive coverage', description: 'Fully protected' }
        ]
    },
    {
        id: 8,
        question: 'What describes your spending behavior?',
        options: [
            { value: 20, label: 'Impulsive spender', description: 'Buy without thinking' },
            { value: 50, label: 'Occasional splurges', description: 'Sometimes overspend' },
            { value: 80, label: 'Need-based spending', description: 'Thoughtful purchases' },
            { value: 100, label: 'Planned purchases only', description: 'Strict discipline' }
        ]
    }
];

let currentQuestionIndex = 0;
let answers = {};
let chatHistory = [];
let analysisResult = {
    score: 0,
    personality: 'Beginner',
    description: 'Complete your assessment to get your personalized report.',
    problems: [],
    improvements: [],
    detailedAdvice: '',
    currentPathSavings: 0,
    improvedPathSavings: 0,
    futureContinueText: '',
    futureImproveText: '',
    weeklyPlan: ['-', '-', '-', '-'],
    analysisComplete: false
};
let isEmailJsInitialized = false;

function isEmailJsConfigMissing() {
    const placeholders = ['SERVICE_ID', 'TEMPLATE_ID', 'PUBLIC_KEY'];
    return !SERVICE_ID
        || !TEMPLATE_ID
        || !PUBLIC_KEY
        || placeholders.includes(SERVICE_ID)
        || placeholders.includes(TEMPLATE_ID)
        || placeholders.includes(PUBLIC_KEY);
}

function getEmailErrorMessage(error) {
    if (!error) {
        return 'Unknown error while sending email.';
    }

    if (typeof error === 'string') {
        return error;
    }

    if (error.status || error.text) {
        return `EmailJS error ${error.status || ''} ${error.text || ''}`.trim();
    }

    if (error.message) {
        return error.message;
    }

    return 'Email sending failed. Check EmailJS service, template, and public key.';
}

function initializeEmailJsIfNeeded() {
    if (isEmailJsInitialized) {
        return;
    }

    if (!window.emailjs) {
        throw new Error('EmailJS SDK not loaded. Check internet connection or script include.');
    }

    if (isEmailJsConfigMissing()) {
        throw new Error('EmailJS credentials are missing. Set SERVICE_ID, TEMPLATE_ID, and PUBLIC_KEY.');
    }

    emailjs.init(PUBLIC_KEY);
    isEmailJsInitialized = true;
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function scrollToQuestionnaire() {
    document.getElementById('questionnaire').classList.remove('hidden');
    document.getElementById('questionnaire').scrollIntoView({ behavior: 'smooth' });
    renderQuestion();
}

function renderQuestion() {
    const question = questions[currentQuestionIndex];
    const container = document.getElementById('questionContainer');

    const html = `
        <h3 class="question-title">${question.question}</h3>
        <div class="options-grid">
            ${question.options.map((option) => `
                <div class="option-card ${answers[question.id] === option.value ? 'selected' : ''}"
                     onclick="selectOption(${question.id}, ${option.value})">
                    <h4>${option.label}</h4>
                    <p>${option.description}</p>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
    updateProgress();
    updateNavigationButtons();
}

function selectOption(questionId, value) {
    answers[questionId] = value;
    renderQuestion();
}

function updateProgress() {
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('currentQuestion').textContent = currentQuestionIndex + 1;
    document.getElementById('totalQuestions').textContent = questions.length;
}

function updateNavigationButtons() {
    document.getElementById('prevBtn').disabled = currentQuestionIndex === 0;

    const nextBtn = document.getElementById('nextBtn');
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const hasAnswer = answers[questions[currentQuestionIndex].id] !== undefined;

    if (isLastQuestion && hasAnswer) {
        nextBtn.innerHTML = 'View Results <i class="fas fa-check"></i>';
    } else {
        nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
    }

    nextBtn.disabled = !hasAnswer;
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex += 1;
        renderQuestion();
    } else {
        calculateResults();
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex -= 1;
        renderQuestion();
    }
}

function getAnswerLabel(questionId) {
    const question = questions.find((item) => item.id === questionId);
    const answerValue = answers[questionId];
    const option = question ? question.options.find((opt) => opt.value === answerValue) : null;
    return option ? option.label : 'Not answered';
}

function formatAnswersForPrompt() {
    return questions.map((question) => `${question.question} => ${getAnswerLabel(question.id)}`).join('\n');
}

function showLoading(message) {
    const overlay = document.getElementById('loadingOverlay');
    const loadingMessage = document.getElementById('loadingMessage');
    loadingMessage.textContent = message;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function setSubmitState(isDisabled) {
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.disabled = isDisabled;
    }
}

function detectPersonality(score) {
    const savings = answers[2] || 0;
    const emergencyFund = answers[3] || 0;
    const investments = answers[4] || 0;
    const tracking = answers[5] || 0;
    const emi = answers[6] || 0;
    const spending = answers[8] || 0;

    if (emi <= 30) {
        return 'EMI Trapped';
    }

    if (spending <= 50 && tracking <= 40) {
        return 'Impulse Spender';
    }

    if (savings >= 60 && emergencyFund >= 70 && investments <= 40) {
        return 'Fearful Saver';
    }

    if (score >= 70 && savings >= 60 && tracking >= 70 && emi >= 60 && spending >= 80) {
        return 'Balanced Planner';
    }

    return 'Beginner';
}

function defaultDescription(personality) {
    const map = {
        'EMI Trapped': 'Debt pressure is reducing your flexibility, so your first goal is to reduce high-cost EMI burden and rebuild control.',
        'Impulse Spender': 'Spending decisions are happening too fast, so you need stronger tracking and spending rules.',
        'Fearful Saver': 'You are good at saving but too conservative with growth assets, which can slow long-term wealth building.',
        Beginner: 'You are early in your money journey and need a simple system for saving, tracking, and protection.',
        'Balanced Planner': 'You already have healthy habits; now focus on optimizing and scaling your long-term plan.'
    };

    return map[personality] || map.Beginner;
}

function fallbackProblems(score, personality) {
    const problemMap = {
        'EMI Trapped': [
            'A large part of your income is locked in EMIs.',
            'High-interest debt is slowing your monthly progress.',
            'Savings get delayed because debt repayments come first.',
            'Emergency preparedness is weak under debt pressure.'
        ],
        'Impulse Spender': [
            'Spending happens before planning.',
            'Expense tracking is inconsistent or missing.',
            'Savings are treated as leftover money.',
            'Short-term wants are reducing long-term goals.'
        ],
        'Fearful Saver': [
            'Money is parked in low-growth options only.',
            'Inflation may erode long-term savings value.',
            'Portfolio diversification is limited.',
            'Fear of risk may prevent wealth growth.'
        ],
        Beginner: [
            'Savings habit is not stable yet.',
            'Emergency and insurance coverage may be weak.',
            'Investment familiarity is limited.',
            'Budget control needs structure.'
        ],
        'Balanced Planner': [
            'Current plan can be optimized further.',
            'Long-term goals may need clearer milestones.',
            'Portfolio review frequency can improve.'
        ]
    };

    const genericLowScore = score < 55 ? ['Score indicates basic financial systems are not fully in place yet.'] : [];
    const list = [...genericLowScore, ...(problemMap[personality] || problemMap.Beginner)];
    return list.slice(0, 5);
}

function fallbackImprovements(personality) {
    const improvementMap = {
        'EMI Trapped': [
            'List all debts and rank them by interest rate.',
            'Pay extra toward the highest-interest EMI every month.',
            'Avoid taking any new consumer debt for 90 days.',
            'Build a mini emergency fund of one month expenses first.',
            'Track debt reduction weekly to stay motivated.'
        ],
        'Impulse Spender': [
            'Use a 24-hour rule before non-essential purchases.',
            'Set a fixed weekly spending limit for wants.',
            'Automate savings on salary day.',
            'Track every expense for at least 30 days.',
            'Unsubscribe from shopping triggers and offers.'
        ],
        'Fearful Saver': [
            'Keep emergency money separate from investments.',
            'Start SIPs in one or two broad mutual funds.',
            'Increase growth allocation gradually each month.',
            'Review portfolio once a month, not daily.',
            'Set long-term goals with target amounts.'
        ],
        Beginner: [
            'Start with a simple 50-30-20 style budget.',
            'Save first by automating at least 10% of income.',
            'Build an emergency fund before aggressive investing.',
            'Track expenses weekly to find leaks.',
            'Learn one basic finance concept every week.'
        ],
        'Balanced Planner': [
            'Increase goal-based investing with clear timelines.',
            'Review and rebalance your portfolio quarterly.',
            'Optimize insurance and tax planning annually.',
            'Create a separate fund for major future goals.',
            'Track monthly net-worth growth.'
        ]
    };

    return (improvementMap[personality] || improvementMap.Beginner).slice(0, 5);
}

function fallbackWeeklyPlan(improvements) {
    return [
        improvements[0] || 'Track your spending and identify your top 3 money leaks.',
        improvements[1] || 'Set a monthly budget and automate your savings transfer.',
        improvements[2] || 'Strengthen emergency and protection basics.',
        improvements[3] || 'Start or optimize your investment and review plan.'
    ];
}

function parseJsonFromText(text) {
    const clean = text.trim();
    try {
        return JSON.parse(clean);
    } catch (error) {
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (innerError) {
                return null;
            }
        }
        return null;
    }
}

function safeArray(list, minItems, fallbackItems) {
    if (Array.isArray(list) && list.length >= minItems) {
        return list;
    }
    return fallbackItems;
}

function currencyLakhsFromScore(score, multiplier) {
    const normalized = Math.max(score, 25);
    return Math.round((normalized * multiplier) / 10);
}

function sanitizeModelName(name) {
    return name.replace(/^models\//, '');
}

async function discoverGeminiModel() {
    if (discoveredGeminiModel) {
        return discoveredGeminiModel;
    }

    const listUrl = `${GEMINI_API_BASE}?key=${GEMINI_API_KEY}`;
    const response = await fetch(listUrl);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini model discovery failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];

    const generateContentModels = models.filter((model) =>
        Array.isArray(model.supportedGenerationMethods)
        && model.supportedGenerationMethods.includes('generateContent')
    );

    const preferred = generateContentModels
        .map((model) => sanitizeModelName(model.name || ''))
        .find((name) => /flash/i.test(name));

    if (preferred) {
        discoveredGeminiModel = preferred;
        return discoveredGeminiModel;
    }

    const fallback = generateContentModels
        .map((model) => sanitizeModelName(model.name || ''))
        .find(Boolean);

    if (fallback) {
        discoveredGeminiModel = fallback;
        return discoveredGeminiModel;
    }

    throw new Error('No Gemini model with generateContent support found for this key.');
}

async function callGemini(promptText) {
    const requestBody = JSON.stringify({
        contents: [{
            parts: [{
                text: promptText
            }]
        }]
    });

    const modelErrors = [];

    // Try discovered model first so we use what this specific key/account supports.
    try {
        const discoveredModel = await discoverGeminiModel();
        const discoveredEndpoint = `${GEMINI_API_BASE}/${discoveredModel}:generateContent?key=${GEMINI_API_KEY}`;
        const discoveredResponse = await fetch(discoveredEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: requestBody
        });

        if (discoveredResponse.ok) {
            const data = await discoveredResponse.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        const discoveredError = await discoveredResponse.text();
        modelErrors.push(`${discoveredModel}: ${discoveredResponse.status}`);

        if (discoveredResponse.status !== 404) {
            throw new Error(`Gemini request failed: ${discoveredResponse.status} ${discoveredError}`);
        }
    } catch (discoverError) {
        modelErrors.push(`discovery: ${(discoverError && discoverError.message) ? discoverError.message : 'failed'}`);
    }

    for (const model of GEMINI_MODEL_CANDIDATES) {
        if (model === discoveredGeminiModel) {
            continue;
        }

        const endpoint = `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: requestBody
        });

        if (response.ok) {
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        const errorText = await response.text();
        modelErrors.push(`${model}: ${response.status}`);

        // 404 usually means model alias not available for the key/version, so try next candidate.
        if (response.status === 404) {
            continue;
        }

        throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
    }

    throw new Error(`Gemini request failed for available models (${modelErrors.join(', ')}). Try hard refresh (Ctrl+F5) to clear cached JavaScript.`);
}

async function calculateResults() {
    document.getElementById('questionnaire').classList.add('hidden');
    document.getElementById('results').classList.remove('hidden');
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });

    const totalScore = Object.values(answers).reduce((sum, val) => sum + val, 0);
    const finalScore = Math.round(totalScore / questions.length);
    const personality = detectPersonality(finalScore);

    analysisResult = {
        ...analysisResult,
        score: finalScore,
        personality,
        description: defaultDescription(personality),
        analysisComplete: false
    };

    animateScore(finalScore);
    setSubmitState(true);
    showLoading('Analyzing your financial habits...');

    await analyzeWithGemini(finalScore, personality);
}

function buildAnalysisPrompt(score, personality) {
    return `You are a financial mentor for beginners in India.

User data:
Score: ${score}
Personality: ${personality}
Answers:
${formatAnswersForPrompt()}

Return only valid JSON with this exact schema:
{
  "personality": "one of: Impulse Spender, Fearful Saver, EMI Trapped, Beginner, Balanced Planner",
  "description": "2-3 simple sentences",
  "problems": ["3 to 5 short problems"],
  "improvements": ["exactly 5 simple actionable steps"],
  "detailedAdvice": "simple practical paragraph",
  "futureSimulation": {
    "currentPathSavingsLakhs": number,
    "improvedPathSavingsLakhs": number,
    "currentSummary": "if user continues same habits",
    "improvedSummary": "if user improves"
  },
  "weeklyPlan": [
    "Week 1 task",
    "Week 2 task",
    "Week 3 task",
    "Week 4 task"
  ]
}

Explain:
- Why their financial health is low
- What they are doing wrong
- 5 simple steps to improve
Keep it simple and practical.`;
}

async function analyzeWithGemini(score, fallbackPersonality) {
    try {
        if (GEMINI_API_KEY === 'GEMINI_API_KEY') {
            throw new Error('Gemini API key placeholder is not configured.');
        }

        const responseText = await callGemini(buildAnalysisPrompt(score, fallbackPersonality));
        showLoading('Generating your personalized plan...');

        const parsed = parseJsonFromText(responseText);
        if (!parsed) {
            throw new Error('Could not parse Gemini JSON response.');
        }

        const personality = parsed.personality || fallbackPersonality;
        const description = parsed.description || defaultDescription(personality);
        const problems = safeArray(parsed.problems, 3, fallbackProblems(score, personality)).slice(0, 5);
        const improvements = safeArray(parsed.improvements, 5, fallbackImprovements(personality)).slice(0, 5);
        const weeklyPlan = safeArray(parsed.weeklyPlan, 4, fallbackWeeklyPlan(improvements)).slice(0, 4);

        const currentSavings = Number(parsed.futureSimulation?.currentPathSavingsLakhs)
            || currencyLakhsFromScore(score, 0.65);
        const improvedSavings = Number(parsed.futureSimulation?.improvedPathSavingsLakhs)
            || currencyLakhsFromScore(score + 20, 1.2);

        analysisResult = {
            score,
            personality,
            description,
            problems,
            improvements,
            detailedAdvice: parsed.detailedAdvice || responseText,
            currentPathSavings: currentSavings,
            improvedPathSavings: Math.max(improvedSavings, currentSavings + 3),
            futureContinueText: parsed.futureSimulation?.currentSummary || 'If you continue these habits, progress stays slow and financial stress can remain high.',
            futureImproveText: parsed.futureSimulation?.improvedSummary || 'If you improve discipline and planning, savings and confidence can grow much faster.',
            weeklyPlan,
            analysisComplete: true
        };

        displayResults(analysisResult);
    } catch (error) {
        console.error('Gemini analysis failed:', error);
        displayFallbackResults(score, fallbackPersonality, error.message);
    } finally {
        hideLoading();
        setSubmitState(false);
    }
}

function animateScore(score) {
    const scoreElement = document.getElementById('scoreNumber');
    const circleElement = document.getElementById('scoreCircle');
    const circumference = 2 * Math.PI * 85;
    const offset = circumference - (score / 100) * circumference;

    let current = 0;
    const increment = score / 50;
    const timer = setInterval(() => {
        current += increment;
        if (current >= score) {
            current = score;
            clearInterval(timer);
        }
        scoreElement.textContent = Math.round(current);
    }, 30);

    circleElement.style.strokeDashoffset = offset;
}

function displayResults(result) {
    document.getElementById('personalityType').textContent = result.personality;
    document.getElementById('personalityDescription').textContent = result.description;

    const problemList = document.getElementById('problemList');
    problemList.innerHTML = result.problems.map((problem) => `<li>${problem}</li>`).join('');

    const improvementList = document.getElementById('improvementList');
    improvementList.innerHTML = result.improvements.map((improvement) => `<li>${improvement}</li>`).join('');

    document.getElementById('detailedAdvice').textContent = result.detailedAdvice;

    document.getElementById('currentSavings').textContent = `₹${result.currentPathSavings}L`;
    document.getElementById('improvedSavings').textContent = `₹${result.improvedPathSavings}L`;
    document.getElementById('currentFutureSummary').textContent = result.futureContinueText;
    document.getElementById('improvedFutureSummary').textContent = result.futureImproveText;

    const planGrid = document.getElementById('actionPlan');
    planGrid.innerHTML = result.weeklyPlan.map((action, index) => `
        <div class="plan-week">
            <h4>Week ${index + 1}</h4>
            <p>${action}</p>
        </div>
    `).join('');
}

function displayFallbackResults(score, personality, reason) {
    const problems = fallbackProblems(score, personality);
    const improvements = fallbackImprovements(personality);
    const weeklyPlan = fallbackWeeklyPlan(improvements);

    analysisResult = {
        score,
        personality,
        description: `${defaultDescription(personality)} ${reason ? `(${reason})` : ''}`,
        problems,
        improvements,
        detailedAdvice: `You are a ${personality}. Focus first on fixing the top 1-2 problems this month, then scale up slowly. Consistency matters more than perfection in personal finance.`,
        currentPathSavings: currencyLakhsFromScore(score, 0.55),
        improvedPathSavings: currencyLakhsFromScore(score + 25, 1.2),
        futureContinueText: 'If current behavior continues, progress stays uneven and emergencies can disrupt your goals.',
        futureImproveText: 'If you follow the 30-day plan, savings discipline and long-term stability should improve clearly.',
        weeklyPlan,
        analysisComplete: true
    };

    displayResults(analysisResult);
}

function openChatPanel() {
    document.getElementById('chatPanel').classList.remove('hidden');
    document.getElementById('chatInput').focus();
}

function closeChatPanel() {
    document.getElementById('chatPanel').classList.add('hidden');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAiMessageHtml(text) {
    const escaped = escapeHtml(text || '');
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const blocks = withBold
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean);

    if (!blocks.length) {
        return '<p>I could not generate a response. Please try again.</p>';
    }

    return blocks.map((block) => {
        const lines = block
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        const listLines = lines
            .map((line) => line.replace(/^[-*\u2022]\s+/, ''));

        const isList = lines.length > 1
            && lines.every((line) => /^[-*\u2022]\s+/.test(line));

        if (isList) {
            return `<ul>${listLines.map((line) => `<li>${line}</li>`).join('')}</ul>`;
        }

        return `<p>${lines.join('<br>')}</p>`;
    }).join('');
}

function addChatMessage(role, text) {
    const messages = document.getElementById('chatMessages');
    const bubble = document.createElement('div');
    bubble.className = `chat-message ${role}`;

    if (role === 'ai') {
        bubble.innerHTML = formatAiMessageHtml(text);
    } else {
        bubble.textContent = text;
    }

    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
}

function buildChatPrompt(userMessage) {
    const historyText = chatHistory
        .slice(-6)
        .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.text}`)
        .join('\n');

    return `You are a financial mentor for beginners in India.
Answer in simple practical language.

Personal context:
Score: ${analysisResult.score}
Personality: ${analysisResult.personality}
Answers:
${formatAnswersForPrompt()}
Top problems:
${analysisResult.problems.join('\n')}
Top improvements:
${analysisResult.improvements.join('\n')}

Recent conversation:
${historyText || 'No previous messages.'}

User question: ${userMessage}`;
}

async function handleChatSubmit(event) {
    event.preventDefault();

    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const message = input.value.trim();
    if (!message) {
        return;
    }

    addChatMessage('user', message);
    chatHistory.push({ role: 'user', text: message });
    input.value = '';

    sendBtn.disabled = true;
    sendBtn.textContent = 'Thinking...';

    try {
        if (GEMINI_API_KEY === 'GEMINI_API_KEY') {
            throw new Error('Gemini API key placeholder is not configured.');
        }

        const aiText = await callGemini(buildChatPrompt(message));
        const finalText = aiText || 'I could not generate a response. Please try again.';
        addChatMessage('ai', finalText);
        chatHistory.push({ role: 'assistant', text: finalText });
    } catch (error) {
        const errorText = `I could not respond right now: ${error.message}`;
        addChatMessage('ai', errorText);
        chatHistory.push({ role: 'assistant', text: errorText });
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
    }
}

async function sendReport(event) {
    event.preventDefault();

    if (!analysisResult.analysisComplete) {
        alert('Please wait until analysis is complete before sending the report.');
        return;
    }

    const form = event.target;
    const button = form.querySelector('button');
    const buttonText = document.getElementById('sendButtonText');
    const originalText = buttonText.textContent;

    buttonText.textContent = 'Sending...';
    button.disabled = true;

    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim().toLowerCase();

    if (!name || !email) {
        buttonText.textContent = 'Missing Name/Email';
        setTimeout(() => {
            buttonText.textContent = originalText;
            button.disabled = false;
        }, 2500);
        return;
    }

    if (!isValidEmail(email)) {
        buttonText.textContent = 'Invalid Email';
        setTimeout(() => {
            buttonText.textContent = originalText;
            button.disabled = false;
        }, 2500);
        return;
    }

    try {
        initializeEmailJsIfNeeded();

        const templateParams = {
            name,
            from_name: name,
            user_name: name,
            to_name: name,
            email,
            toEmail: email,
            to_email: email,
            recipient_email: email,
            user_email: email,
            reply_to: email,
            score: analysisResult.score,
            personality: analysisResult.personality,
            description: analysisResult.description,
            problems: analysisResult.problems.join(' | '),
            improvements: analysisResult.improvements.join(' | '),
            ai_advice: analysisResult.detailedAdvice,
            future_summary: `Current: ${analysisResult.futureContinueText} | Improved: ${analysisResult.futureImproveText}`,
            current_savings: analysisResult.currentPathSavings,
            improved_savings: analysisResult.improvedPathSavings,
            week1: analysisResult.weeklyPlan[0],
            week2: analysisResult.weeklyPlan[1],
            week3: analysisResult.weeklyPlan[2],
            week4: analysisResult.weeklyPlan[3]
        };

        const emailResult = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);

        if (emailResult && emailResult.status && Number(emailResult.status) >= 400) {
            throw new Error(`EmailJS returned status ${emailResult.status}: ${emailResult.text || 'Failed'}`);
        }

        buttonText.textContent = 'Sent Successfully!';
        setTimeout(() => {
            buttonText.textContent = originalText;
            button.disabled = false;
            document.getElementById('emailForm').reset();
        }, 3000);
    } catch (error) {
        const details = getEmailErrorMessage(error);
        console.error('Error sending email:', error);
        alert(`Could not send report. ${details}`);
        buttonText.textContent = 'Error - Try Again';
        setTimeout(() => {
            buttonText.textContent = originalText;
            button.disabled = false;
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const openChatBtn = document.getElementById('openChatBtn');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatForm = document.getElementById('chatForm');

    if (openChatBtn) {
        openChatBtn.addEventListener('click', () => {
            openChatPanel();
            if (analysisResult.analysisComplete) {
                addChatMessage('ai', 'You can ask: How to save money? or Best way to invest based on my score?');
            }
        });
    }

    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', closeChatPanel);
    }

    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }
});
