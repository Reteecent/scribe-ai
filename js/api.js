function pad(n) {
    return n.toString().padStart(2, '0');
}

function getSystemPrompt(genDate) {
    return `
Respond EXACTLY in this format for all outputs. Never deviate:

1. SECTION STRUCTURE (THERE SHOULD BE AS MANY SECTION STRUCTURES AS POSSIBLE, DEPENDING ON THE LENGTH OF THE RESPONSE):
## [Title]
**Goal:** [1-sentence purpose]

2. CONTENT TYPES
• Processes → Numbered lists:
  1. [Step]
    - [Sub-step]
    - [Sub-step]
  2. [Next step]...

• Options → Bullet points:
  - [Item 1]
  - [Item 2]...

• Comparisons → Tables:
| Parameter | Description | Reference |
|-----------|-------------|-----------|

3. FORMATTING
• Code: \`\`\`[language]
[content]
\`\`\`
• Files: \`path/to/file.ext\`
• Key terms: **bold** for equipment, *italics* for standards

4. DOCUMENT CONTROL (AT THE END OF THE RESPONSE)
---
**Generated:** ${genDate} | **Version:** 1.0
---

Maintain strict left-alignment and never merge content types.
`;
}

export function getAIResponse(prompt, onChunk) {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        const signal = controller.signal;
        
        const now = new Date();
        const genDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const systemPromptWithDate = getSystemPrompt(genDate);
        
        // Prepare messages with system prompt
        const messages = [
            { role: "system", content: systemPromptWithDate },
            { role: "user", content: prompt }
        ];
        
        console.log('Starting AI request for prompt:', prompt.substring(0, 50) + '...');
        
        fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer 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`
                },
                body: JSON.stringify({
                    model: 'llama3-8b-8192',
                    messages: messages,
                    temperature: 0.3,
                    max_tokens: 2048,
                    stream: true
                }),
                signal
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let finalText = '';
                
                function read() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            console.log('AI response complete, total length:', finalText.length);
                            resolve({
                                text: finalText,
                                formattedForPDF: finalText
                            });
                            return;
                        }
                        
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';
                        
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed.startsWith('data:')) continue;
                            
                            const jsonStr = trimmed.slice(5).trim();
                            if (jsonStr === '[DONE]') {
                                console.log('Stream finished');
                                resolve({
                                    text: finalText,
                                    formattedForPDF: finalText
                                });
                                return;
                            }
                            
                            try {
                                const data = JSON.parse(jsonStr);
                                const content = data.choices?.[0]?.delta?.content;
                                if (content) {
                                    finalText += content;
                                    if (onChunk) onChunk(content);
                                }
                            } catch (err) {
                                console.error('Error parsing chunk:', err, 'JSON:', jsonStr);
                            }
                        }
                        read();
                    }).catch(reject);
                }
                read();
            })
            .catch(error => {
                console.error('API request failed:', error);
                if (error.name === 'AbortError') {
                    reject(new Error('Generation cancelled'));
                } else {
                    reject(error);
                }
            });
        
        // Return controller to allow cancellation
        return controller;
    });
}