function pad(n) {
    return n.toString().padStart(2, '0');
}

function getSystemPrompt(genDate) {
    return `Respond strictly using the output format rules described below.

Never include or reference any of the instructions, categories, examples, or formatting rules in the output. Do not output headers like "SECTION STRUCTURE," "CONTENT TYPES," etc.

Do not explain, introduce, or justify anything before or after the response.

Start responses immediately with the formatted content, using the structures described below:

---

1. Title Sections  
Format:  
## [Title]  
Below the title, include a one-line goal starting with:  
**Goal:** [Description]

---

2. For Processes, use numbered lists:  
1. [Step]  
   - [Sub-step]  
   - [Sub-step]  
2. [Next Step]

---

3. For Options, use plain bullet points:  
- [Option A]  
- [Option B]

---

4. For Comparisons, use tables with these columns:  
| Parameter | Description | Reference |  
|-----------|-------------|-----------|  
| [Value]   | [Text]      | [Ref]     |

---

5. For Formatting, follow this:  

Code blocks:  
~~~[language]  
[code here]  
~~~  

File paths: 'path/to/file.ext'  
Key terms: Use **bold** for equipment and footer, *italics* for standards

---

6. Document Footer (Required at End):  
Output this exactly at the end:  

---  
<footer>  
    <div class="document-footer">  
        <strong>Generated:</strong> ${genDate} | <strong>Version:</strong> 1.0  
    </div>  
</footer>  
`;
}

export function getAIResponse(conversation, onChunk) {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        const signal = controller.signal;
        
        const now = new Date();
        const genDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const systemPromptWithDate = getSystemPrompt(genDate);
        
        const messages = [
            { role: "system", content: systemPromptWithDate },
            ...conversation
        ];
        
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
                let fullResponse = '';
                let lastRenderTime = 0;
                const renderInterval = 300;
                
                function read() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            resolve({
                                text: fullResponse,
                                formattedForPDF: fullResponse
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
                                resolve({
                                    text: fullResponse,
                                    formattedForPDF: fullResponse
                                });
                                return;
                            }
                            
                            try {
                                const data = JSON.parse(jsonStr);
                                const content = data.choices?.[0]?.delta?.content;
                                if (content) {
                                    fullResponse += content;
                                    
                                    const now = Date.now();
                                    if (now - lastRenderTime > renderInterval) {
                                        if (onChunk) onChunk(fullResponse);
                                        lastRenderTime = now;
                                    }
                                }
                            } catch (err) {
                                console.error('Error parsing chunk:', err);
                            }
                        }
                        read();
                    }).catch(reject);
                }
                read();
            })
            .catch(error => {
                if (error.name === 'AbortError') {
                    reject(new Error('Generation cancelled'));
                } else {
                    reject(error);
                }
            });
        
        return controller;
    });
}