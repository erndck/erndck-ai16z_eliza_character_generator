pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let extractedText = '';
let generatedCharacter = null;

document.addEventListener('DOMContentLoaded', () => {
    const descriptionField = document.getElementById('description');
    if (descriptionField) {
        descriptionField.setAttribute('maxlength', '10000');
    }

    loadApiKeyFromStorage();

    // Listen for changes in model provider and load corresponding API key
    const modelProviderSelect = document.getElementById('modelProviderSelect');
    modelProviderSelect.addEventListener('change', loadApiKeyFromStorage);
});

function loadApiKeyFromStorage() {
    const provider = document.getElementById('modelProviderSelect').value;
    const apiKeyField = document.getElementById('apiKey');
    let key = '';
    if (provider === 'openai') {
        key = localStorage.getItem('openaiApiKey') || '';
    } else {
        key = localStorage.getItem('openrouterApiKey') || '';
    }
    apiKeyField.value = key;
    document.getElementById('saveKey').checked = !!key;
}

function saveApiKeyToStorage(provider, key) {
    if (provider === 'openai') {
        if (key) localStorage.setItem('openaiApiKey', key);
        else localStorage.removeItem('openaiApiKey');
    } else {
        if (key) localStorage.setItem('openrouterApiKey', key);
        else localStorage.removeItem('openrouterApiKey');
    }
}

function generateFileHeader(characterName) {
    return `import { Character, ModelProviderName } from "./types.ts";

export const defaultCharacter: Character = `;
}

function createBaseCharacter(name) {
    return {
        name: name,
        username: name.toLowerCase(),
        plugins: [],
        clients: [],
        modelProvider: 'ModelProviderName.OPENAI',
        settings: {
            secrets: {},
            voice: {
                model: "en_US-hfc_female-medium",
            },
        },
        system: `Roleplay and generate interesting dialogue on behalf of ${name}. Never use emojis or hashtags or cringe stuff like that. Never act like an assistant.`
    };
}

function updateLoadingStep(currentStep, totalSteps, stepName) {
    const loadingOverlay = document.querySelector('.loading-overlay');
    const loadingContent = loadingOverlay.querySelector('.loading-content p');
    if (loadingContent) {
        loadingContent.textContent = `Generating character file... Step ${currentStep} of ${totalSteps}: ${stepName}`;
    }
}

async function callAPI(provider, apiKey, prompt, maxTokens=3000) {
    if (provider === 'openai') {
        return callOpenAI(apiKey, prompt, maxTokens, "gpt-4o");
    } else {
        // For OpenRouter with claude-3.5-sonnet model
        return callOpenRouter(apiKey, prompt, maxTokens, "anthropic/claude-3.5-sonnet");
    }
}

async function callOpenAI(apiKey, prompt, maxTokens=3000, model="gpt-4o") {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    const body = {
        model: model,
        max_tokens: maxTokens,
        messages: [
            {
                role: "user",
                content: prompt
            }
        ]
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API call failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(content);
}

async function callOpenRouter(apiKey, prompt, maxTokens=3000, model="anthropic/claude-3.5-sonnet") {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    const body = {
        model: model,
        max_tokens: maxTokens,
        messages: [
            {
                role: "user",
                content: prompt
            }
        ]
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch {
            errorData = {};
        }
        throw new Error(errorData.error?.message || `API call failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(content);
}

// Generation functions
async function generateBio(provider, apiKey, description, additionalText) {
    const prompt = `
        Create a deeply detailed and extensive 'bio'.
        Return ONLY JSON like:
        {
          "bio": [ "...", "..." ]
        }

        Character description: ${description}
        ${additionalText ? `Additional context: ${additionalText}` : ''}
    `;
    return callAPI(provider, apiKey, prompt, 4000);
}

async function generateLore(provider, apiKey, description, additionalText) {
    const prompt = `
        Create a 'lore' array with a rich, comprehensive backstory.
        Return ONLY JSON like:
        {
          "lore": [ "...", "..." ]
        }

        Character description: ${description}
        ${additionalText ? `Additional context: ${additionalText}` : ''}
    `;
    return callAPI(provider, apiKey, prompt, 4000);
}

async function generateMessageExamples(provider, apiKey, name, description, additionalText) {
    const prompt = `
        Create 'messageExamples' as an array of arrays of messages, with at least 10 conversation examples.
        The user should ALWAYS be "{{user1}}" and the character as "${name}".
        Return ONLY JSON like:
        {
          "messageExamples": [
            [
              {
                "user": "{{user1}}",
                "content": { "text": "..." }
              },
              {
                "user": "${name}",
                "content": { "text": "..." }
              }
            ],
            ...
          ]
        }

        Character description: ${description}
        ${additionalText ? `Additional context: ${additionalText}` : ''}
    `;
    return callAPI(provider, apiKey, prompt, 6000);
}

async function generatePostExamples(provider, apiKey, description, additionalText) {
    const prompt = `
        Create 'postExamples' as an array of at least 20 unique posts.
        Return ONLY JSON like:
        {
          "postExamples": ["post1", "post2", ...]
        }

        Character description: ${description}
        ${additionalText ? `Additional context: ${additionalText}` : ''}
    `;
    return callAPI(provider, apiKey, prompt, 6000);
}

async function generateKnowledge(provider, apiKey, description, additionalText) {
    const prompt = `
        Create 'knowledge' as a long, detailed array of strings.
        Return ONLY JSON like:
        {
          "knowledge": [ "...", "..." ]
        }

        Character description: ${description}
        Additional context: ${additionalText}
    `;
    return callAPI(provider, apiKey, prompt, 4000);
}

async function generateTopics(provider, apiKey, description, additionalText) {
    const prompt = `
        Create 'topics' as a large array of subjects the character is knowledgeable about.
        Return ONLY JSON like:
        {
          "topics": ["...", "..."]
        }

        Character description: ${description}
        ${additionalText ? `Additional context: ${additionalText}` : ''}
    `;
    return callAPI(provider, apiKey, prompt, 3000);
}

async function generateStyle(provider, apiKey, description, additionalText) {
    const prompt = `
        Create 'style' with 'all', 'chat', and 'post' arrays of extensive guidelines.
        Return ONLY JSON like:
        {
          "style": {
            "all": [...],
            "chat": [...],
            "post": [...]
          }
        }

        Character description: ${description}
        ${additionalText ? `Additional context: ${additionalText}` : ''}
    `;
    return callAPI(provider, apiKey, prompt, 4000);
}

async function generateAdjectives(provider, apiKey, description, additionalText) {
    const prompt = `
        Create 'adjectives' as a large array of adjectives.
        Return ONLY JSON like:
        {
          "adjectives": ["...", "..."]
        }

        Character description: ${description}
        ${additionalText ? `Additional context: ${additionalText}` : ''}
    `;
    return callAPI(provider, apiKey, prompt, 3000);
}

async function generateCharacterFile(name, description, apiKey, additionalText = '', provider='openai') {
    let combinedAdditional = '';
    if (extractedText.trim()) combinedAdditional += extractedText.trim();
    if (additionalText.trim()) combinedAdditional += ' ' + additionalText.trim();

    const MAX_ADDITIONAL_LENGTH = 500000;
    if (combinedAdditional.length > MAX_ADDITIONAL_LENGTH) {
        combinedAdditional = combinedAdditional.substring(0, MAX_ADDITIONAL_LENGTH);
    }

    const includeKnowledge = Boolean(combinedAdditional.trim());

    const baseCharacter = createBaseCharacter(name);
    if (provider === 'openrouter') {
        baseCharacter.modelProvider = 'ModelProviderName.ANTHROPIC'; // If you want to reflect that it's using Claude via OpenRouter
    }

    let totalSteps = 7;
    if (includeKnowledge) totalSteps = 8;
    totalSteps += 1; // assembly
    let currentStep = 0;

    function nextStep(stepName) {
        currentStep++;
        updateLoadingStep(currentStep, totalSteps, stepName);
    }

    nextStep('Generating bio');
    const bioData = await generateBio(provider, apiKey, description, combinedAdditional);

    nextStep('Generating lore');
    const loreData = await generateLore(provider, apiKey, description, combinedAdditional);

    nextStep('Generating message examples');
    const msgData = await generateMessageExamples(provider, apiKey, name, description, combinedAdditional);

    nextStep('Generating post examples');
    const postData = await generatePostExamples(provider, apiKey, description, combinedAdditional);

    nextStep('Generating topics');
    const topicData = await generateTopics(provider, apiKey, description, combinedAdditional);

    nextStep('Generating style');
    const styleData = await generateStyle(provider, apiKey, description, combinedAdditional);

    nextStep('Generating adjectives');
    const adjData = await generateAdjectives(provider, apiKey, description, combinedAdditional);

    let knowledgeData = {};
    if (includeKnowledge) {
        nextStep('Generating knowledge');
        knowledgeData = await generateKnowledge(provider, apiKey, description, combinedAdditional);
    }

    nextStep('Assembling final character');
    generatedCharacter = {
        ...baseCharacter,
        ...bioData,
        ...loreData,
        ...msgData,
        ...postData,
        ...topicData,
        ...styleData,
        ...adjData,
        ...knowledgeData
    };

    return generatedCharacter;
}

function downloadCharacterFile() {
    if (!generatedCharacter) return;

    const header = generateFileHeader(generatedCharacter.name);
    let content = JSON.stringify(generatedCharacter, null, 2)
        .replace('"ModelProviderName.OPENAI"', 'ModelProviderName.OPENAI')
        .replace('"ModelProviderName.ANTHROPIC"', 'ModelProviderName.ANTHROPIC');

    content = content.replace(/"([A-Za-z0-9_]+)":/g, '$1:');

    const fileContent = header + content + ";\n";
    
    const blob = new Blob([fileContent], { type: 'application/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedCharacter.name.toLowerCase()}_character.ts`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.getElementById('characterForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const description = document.getElementById('description').value;
    const apiKey = document.getElementById('apiKey').value;
    const additionalText = document.getElementById('additionalText').value;
    const provider = document.getElementById('modelProviderSelect').value;
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    const successModal = document.querySelector('.success-modal');
    const apiError = document.getElementById('apiError');
    
    try {
        loadingOverlay.style.display = 'flex';
        apiError.style.display = 'none';
        
        if (document.getElementById('saveKey').checked) {
            saveApiKeyToStorage(provider, apiKey);
        } else {
            saveApiKeyToStorage(provider, '');
        }

        await generateCharacterFile(name, description, apiKey, additionalText, provider);
        
        loadingOverlay.style.display = 'none';
        successModal.style.display = 'flex';
    } catch (error) {
        loadingOverlay.style.display = 'none';
        apiError.textContent = error.message;
        apiError.style.display = 'block';
        console.error('Error:', error);
    }
});

// PDF handling
const dropZone = document.getElementById('dropZone');
const pdfInput = document.getElementById('pdfInput');

async function handlePdfFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ');
        }
        
        extractedText = fullText;
        document.getElementById('dropZone').textContent = `Processed: ${file.name}`;
    } catch (error) {
        console.error('Error processing PDF:', error);
        document.getElementById('dropZone').textContent = `Error processing PDF: ${error.message}`;
    }
}

dropZone.addEventListener('click', () => pdfInput.click());
dropZone.addEventListener('dragover', (e) => e.preventDefault());
dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        await handlePdfFile(file);
    }
});

pdfInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        await handlePdfFile(file);
    }
});

document.querySelector('.download-btn').addEventListener('click', downloadCharacterFile);

// Close success modal when clicking outside
document.querySelector('.success-modal').addEventListener('click', (e) => {
    if (e.target.className === 'success-modal') {
        e.target.style.display = 'none';
    }
});
