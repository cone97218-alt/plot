/**
 * api-client.js - Async AI client (analysis pipeline)
 * Manages connections stored ONLY in extension_settings (not written back to ST).
 */

import { getContext, extension_settings } from '../../../../../extensions.js';
import { oai_settings, getChatCompletionModel, createGenerationParameters } from '../../../../../openai.js';

const MODULE_NAME = 'plot';

function getPlotSettings() {
    if (!extension_settings.plot) {
        extension_settings.plot = {};
    }
    return extension_settings.plot;
}

export function listConnections() {
    const s = getPlotSettings();
    if (!s.connections) {
        s.connections = [];
    }
    // Return custom list
    return s.connections;
}

export function saveConnection(config) {
    const s = getPlotSettings();
    if (!s.connections) {
        s.connections = [];
    }
    
    if (!config.id) {
        config.id = 'conn_' + Date.now();
        s.connections.push(config);
    } else {
        const idx = s.connections.findIndex(c => c.id === config.id);
        if (idx !== -1) {
            s.connections[idx] = config;
        } else {
            s.connections.push(config);
        }
    }
    getContext().saveSettingsDebounced?.();
    return config.id;
}

export function deleteConnection(id) {
    const s = getPlotSettings();
    if (!s.connections) return;
    s.connections = s.connections.filter(c => c.id !== id);
    
    // If the default connection is deleted, reset it
    if (s.defaultConnectionId === id) {
        s.defaultConnectionId = 'default';
    }
    getContext().saveSettingsDebounced?.();
}

export function getConnection(id) {
    if (!id || id === 'default') {
        return {
            id: 'default',
            name: 'SillyTavern 默认连接',
            type: 'default'
        };
    }
    const list = listConnections();
    return list.find(c => c.id === id) || null;
}

/**
 * Simulates the API request flow by compiling messages and passing them through
 * SillyTavern generation parameter creators to get the exact request body (messages),
 * without making any actual network fetch requests.
 * @param {string|Array} prompt
 * @param {string} systemPrompt
 * @param {string} connectionId
 * @returns {Promise<Array>}
 */
export async function getRealPromptMessages(prompt, systemPrompt = '', connectionId = null) {
    const ctx = getContext();
    const s = getPlotSettings();
    const connId = (!connectionId || connectionId === 'global') ? (s.defaultConnectionId || 'default') : connectionId;
    
    const connection = getConnection(connId);
    if (!connection) {
        throw new Error(`Connection not found: ${connId}`);
    }

    const messages = buildMessages(prompt, systemPrompt);

    if (connection.type === 'default') {
        try {
            const model = getChatCompletionModel(oai_settings);
            const { generate_data } = await createGenerationParameters(oai_settings, model, 'chat', messages);
            return generate_data.messages || messages;
        } catch (err) {
            console.warn('[Plot Client] Failed to run createGenerationParameters, fallback to raw messages:', err);
            return messages;
        }
    } else {
        return messages;
    }
}

export async function fetchModels(endpoint, apiKey) {
    const ctx = getContext();
    
    // Extract base URL (remove /chat/completions)
    let baseUrl = endpoint;
    if (endpoint.endsWith('/chat/completions')) {
        baseUrl = endpoint.slice(0, -17);
    } else if (endpoint.endsWith('/chat/completions/')) {
        baseUrl = endpoint.slice(0, -18);
    }
    // Remove trailing slash if any
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }

    const response = await fetch('/api/backends/chat-completions/status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...ctx.getRequestHeaders()
        },
        body: JSON.stringify({
            chat_completion_source: 'openai',
            reverse_proxy: baseUrl,
            proxy_password: apiKey
        })
    });

    if (!response.ok) {
        throw new Error(`获取模型失败: ${response.statusText} (${response.status})`);
    }

    const data = await response.json();
    if (Array.isArray(data.data)) {
        return data.data.map(item => item.id);
    }
    if (data.data && Array.isArray(data.data.data)) {
        return data.data.data.map(item => item.id);
    }
    throw new Error('未返回有效的模型列表数据格式');
}

export async function testConnection(endpoint, apiKey, model) {
    const ctx = getContext();
    const response = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...ctx.getRequestHeaders()
        },
        body: JSON.stringify({
            chat_completion_source: 'openai',
            reverse_proxy: endpoint,
            proxy_password: apiKey,
            model: model || 'default',
            messages: [{ role: 'user', content: 'Say word Hi' }],
            max_tokens: 5,
            temperature: 0.7,
            stream: false
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`连接测试失败: ${response.statusText} (${response.status}) - ${errText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Ping成功，但未返回文本';
    return reply;
}

export async function testConnectionById(connectionId) {
    const conn = getConnection(connectionId);
    if (!conn) {
        throw new Error('未找到该连接配置');
    }
    
    if (conn.id === 'default') {
        // Test SillyTavern's default proxy connection using callAI
        return await callAI('Say word OK', 'You are a test assistant.', 'default');
    } else {
        // Test custom connection
        return await testConnection(conn.endpoint, conn.apiKey, conn.model);
    }
}

export const lastApiLog = {
    timestamp: null,
    connectionName: '',
    model: '',
    systemPrompt: '',
    userPrompt: '',
    messages: null,
    response: '',
    error: null
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

/**
 * Build the messages array from prompt + optional system prompt.
 * @param {string|Array} prompt
 * @param {string} systemPrompt
 * @returns {Array<{role:string, content:string}>}
 */
function buildMessages(prompt, systemPrompt) {
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    if (Array.isArray(prompt)) {
        messages.push(...prompt);
    } else {
        messages.push({ role: 'user', content: prompt });
    }
    return messages;
}

/**
 * Parse a failed HTTP response and extract a human-readable error message.
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function parseErrorResponse(response) {
    let errorMsg = response.statusText;
    try {
        const errText = await response.text();
        const errData = JSON.parse(errText);
        if (errData?.error?.message) {
            errorMsg = errData.error.message;
        } else if (errData?.message) {
            errorMsg = errData.message;
        } else if (errText) {
            errorMsg = errText;
        }
    } catch (_) {}
    return errorMsg;
}

/**
 * Async generator that reads an SSE (Server-Sent Events) stream and yields text chunks.
 * @param {ReadableStreamDefaultReader} reader
 * @param {TextDecoder} decoder
 * @yields {string}
 */
async function* readSSEStream(reader, decoder) {
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete last line
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (trimmed.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(trimmed.slice(6));
                        const text = json.choices?.[0]?.delta?.content || '';
                        if (text) yield text;
                    } catch (_) {}
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Call the AI model for background analysis (non-streaming).
 * @param {string|Array} prompt - Prompt to send
 * @param {string} [systemPrompt] - System instructions
 * @param {string} [connectionId] - Specific connection ID (defaults to settings.defaultConnectionId)
 * @returns {Promise<string>}
 */
export async function callAI(prompt, systemPrompt = '', connectionId = null) {
    const ctx = getContext();
    const s = getPlotSettings();
    const connId = (!connectionId || connectionId === 'global') ? (s.defaultConnectionId || 'default') : connectionId;
    
    const connection = getConnection(connId);
    if (!connection) {
        const errMsg = `Connection not found: ${connId}`;
        lastApiLog.timestamp = Date.now();
        lastApiLog.error = errMsg;
        throw new Error(errMsg);
    }
    
    const messages = buildMessages(prompt, systemPrompt);

    lastApiLog.timestamp = Date.now();
    lastApiLog.connectionName = connection.name || '默认连接';
    lastApiLog.systemPrompt = systemPrompt;
    lastApiLog.userPrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt, null, 2);
    lastApiLog.messages = messages;
    lastApiLog.error = null;
    lastApiLog.response = '';

    try {
        let response;

        if (connection.type === 'default') {
            const model = getChatCompletionModel(oai_settings);
            lastApiLog.model = model || 'SillyTavern Active Model';
            
            const { generate_data } = await createGenerationParameters(oai_settings, model, 'chat', messages);
            
            response = await fetch('/api/backends/chat-completions/generate', {
                method: 'POST',
                body: JSON.stringify(generate_data),
                headers: { 'Content-Type': 'application/json', ...ctx.getRequestHeaders() },
            });
            
            if (!response.ok) {
                const errorMsg = await parseErrorResponse(response);
                throw new Error(`SillyTavern proxy request failed: ${errorMsg}`);
            }
        } else {
            lastApiLog.model = connection.model || 'custom';
            
            response = await fetch('/api/backends/chat-completions/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...ctx.getRequestHeaders() },
                body: JSON.stringify({
                    chat_completion_source: 'openai',
                    reverse_proxy: connection.endpoint,
                    proxy_password: connection.apiKey,
                    model: connection.model,
                    messages,
                    temperature: Number(connection.temperature) || 0.7,
                    top_p: Number(connection.topP) || 0.9,
                    max_tokens: Number(connection.maxTokens) || 1000,
                    stream: false
                })
            });
            
            if (!response.ok) {
                // B7 Fix: parse the response body for detailed error, same as default connection
                const errorMsg = await parseErrorResponse(response);
                throw new Error(`Custom connection request failed: ${errorMsg}`);
            }
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';
        lastApiLog.response = reply;
        return reply;
    } catch (err) {
        lastApiLog.error = err.message;
        throw err;
    }
}

/**
 * Call the AI model with streaming output.
 * @param {string|Array} prompt
 * @param {string} [systemPrompt]
 * @param {string} [connectionId]
 * @param {AbortSignal} [signal]
 * @yields {string} - Text chunks as they arrive
 */
export async function* callAIStream(prompt, systemPrompt = '', connectionId = null, signal = null) {
    const ctx = getContext();
    const s = getPlotSettings();
    const connId = (!connectionId || connectionId === 'global') ? (s.defaultConnectionId || 'default') : connectionId;
    
    const connection = getConnection(connId);
    if (!connection) {
        const errMsg = `Connection not found: ${connId}`;
        lastApiLog.timestamp = Date.now();
        lastApiLog.error = errMsg;
        throw new Error(errMsg);
    }

    const messages = buildMessages(prompt, systemPrompt);

    // Populate API log for streaming call
    lastApiLog.timestamp = Date.now();
    lastApiLog.connectionName = connection.name || '默认连接';
    lastApiLog.systemPrompt = systemPrompt;
    lastApiLog.userPrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt, null, 2);
    lastApiLog.messages = messages;
    lastApiLog.error = null;
    lastApiLog.response = '';

    if (connection.type === 'default') {
        const model = getChatCompletionModel(oai_settings);
        lastApiLog.model = model || 'SillyTavern Active Model';
    } else {
        lastApiLog.model = connection.model || 'custom';
    }

    try {
        let response;
        if (connection.type === 'default') {
            const model = getChatCompletionModel(oai_settings);
            const { generate_data } = await createGenerationParameters(oai_settings, model, 'chat', messages);
            generate_data.stream = true;
            
            response = await fetch('/api/backends/chat-completions/generate', {
                method: 'POST',
                body: JSON.stringify(generate_data),
                headers: { 'Content-Type': 'application/json', ...ctx.getRequestHeaders() },
                signal,
            });
            
            if (!response.ok) {
                const errorMsg = await parseErrorResponse(response);
                throw new Error(`SillyTavern proxy request failed: ${errorMsg}`);
            }
        } else {
            response = await fetch('/api/backends/chat-completions/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...ctx.getRequestHeaders() },
                body: JSON.stringify({
                    chat_completion_source: 'openai',
                    reverse_proxy: connection.endpoint,
                    proxy_password: connection.apiKey,
                    model: connection.model,
                    messages,
                    temperature: Number(connection.temperature) || 0.7,
                    top_p: Number(connection.topP) || 0.9,
                    max_tokens: Number(connection.maxTokens) || 1000,
                    stream: true
                }),
                signal,
            });

            if (!response.ok) {
                // B7 Fix: parse the response body for detailed error
                const errorMsg = await parseErrorResponse(response);
                throw new Error(`Custom connection stream failed: ${errorMsg}`);
            }
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullReply = '';
        for await (const chunk of readSSEStream(reader, decoder)) {
            fullReply += chunk;
            lastApiLog.response = fullReply;
            yield chunk;
        }
    } catch (err) {
        lastApiLog.error = err.message;
        throw err;
    }
}
