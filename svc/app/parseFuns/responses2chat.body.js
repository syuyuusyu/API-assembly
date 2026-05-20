/**
 * API Configuration body builder: Responses request body -> Chat Completions body.
 *
 * Store module.exports.fnString in invoke_info.body. aiStream.js calls it as:
 *   fn.call(helperContext, params)
 *
 * params is the original request body sent by the client.
 */
function responses2chatBody(params) {
  const TARGET_CHAT_MODEL = 'deepseek-v4-flash';

  function copy(source, target, keys) {
    keys.forEach(key => {
      if (source[key] != null) target[key] = source[key];
    });
  }

  function stringify(value) {
    if (typeof value === 'string') return value;
    if (value == null) return '';
    return JSON.stringify(value);
  }

  function contentToChatContent(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return stringify(content);

    const parts = content.map(part => {
      if (!part || typeof part !== 'object') return '';
      if (part.type === 'input_text' || part.type === 'output_text' || part.type === 'text') {
        return part.text || '';
      }
      if (part.type === 'input_image' && part.image_url) {
        return { type: 'image_url', image_url: { url: part.image_url } };
      }
      return '';
    }).filter(Boolean);

    if (parts.every(part => typeof part === 'string')) {
      return parts.join('');
    }
    return parts.map(part => typeof part === 'string' ? { type: 'text', text: part } : part);
  }

  function inputItemToMessage(item) {
    if (!item || typeof item !== 'object') return null;

    if (item.type === 'message') {
      return {
        role: item.role === 'developer' ? 'system' : (item.role || 'user'),
        content: contentToChatContent(item.content),
      };
    }

    if (item.type === 'function_call') {
      return {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: item.call_id || item.id,
            type: 'function',
            function: {
              name: item.name || '',
              arguments: stringify(item.arguments),
            },
          },
        ],
      };
    }

    if (item.type === 'function_call_output') {
      return {
        role: 'tool',
        tool_call_id: item.call_id,
        content: stringify(item.output),
      };
    }

    return null;
  }

  function reasoningItemToText(item) {
    if (!item || typeof item !== 'object' || item.type !== 'reasoning') return '';
    if (typeof item.reasoning_content === 'string') return item.reasoning_content;
    if (typeof item.text === 'string') return item.text;

    const summary = Array.isArray(item.summary) ? item.summary : [];
    const summaryText = summary.map(part => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      return part.text || part.summary_text || '';
    }).filter(Boolean).join('');

    if (summaryText) return summaryText;

    const content = Array.isArray(item.content) ? item.content : [];
    return content.map(part => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      return part.text || part.reasoning_content || '';
    }).filter(Boolean).join('');
  }

  function appendReasoning(message, reasoning) {
    if (!message || !reasoning) return;
    message.reasoning_content = (message.reasoning_content || '') + reasoning;
  }

  function appendToolCalls(message, toolCalls) {
    if (!message || !Array.isArray(toolCalls) || toolCalls.length === 0) return;
    message.tool_calls = (message.tool_calls || []).concat(toolCalls);
  }

  function normalizeAssistantHistory(messages) {
    const normalized = [];
    messages.forEach(msg => {
      const prev = normalized[normalized.length - 1];
      if (
        msg &&
        msg.role === 'assistant' &&
        Array.isArray(msg.tool_calls) &&
        prev &&
        prev.role === 'assistant' &&
        !prev.tool_call_id
      ) {
        appendToolCalls(prev, msg.tool_calls);
        appendReasoning(prev, msg.reasoning_content || '');
        return;
      }
      normalized.push(msg);
    });

    normalized.forEach(msg => {
      if (msg && msg.role === 'assistant' && Array.isArray(msg.tool_calls) &&
          typeof msg.reasoning_content !== 'string') {
        msg.reasoning_content = msg.content || '';
      }
    });

    return normalized;
  }

  function toolToChatTool(tool) {
    if (!tool || tool.type !== 'function') return null;
    const fn = tool.function && typeof tool.function === 'object' ? tool.function : tool;
    return {
      type: 'function',
      function: {
        name: fn.name,
        description: fn.description || '',
        parameters: fn.parameters || {},
      },
    };
  }

  function namespaceToolToChatTools(tool) {
    if (!tool || tool.type !== 'namespace' || !Array.isArray(tool.tools)) return [];
    const namespace = tool.name || '';
    const toolNamePrefix = namespace.endsWith('__') ? namespace : `${namespace}__`;
    return tool.tools.map(child => {
      if (!child || child.type !== 'function') return null;
      const fn = child.function && typeof child.function === 'object' ? child.function : child;
      return {
        type: 'function',
        function: {
          name: `${toolNamePrefix}${fn.name}`,
          description: [
            `IMPORTANT: When calling this tool, the function name MUST be exactly "${toolNamePrefix}${fn.name}".`,
            `Do not omit the namespace or call it as "${fn.name}".`,
            tool.description,
            fn.description,
          ].filter(Boolean).join('\n'),
          parameters: fn.parameters || {},
        },
      };
    }).filter(Boolean);
  }

  function toolsToChatTools(tools) {
    const chatTools = [];
    tools.forEach(tool => {
      const chatTool = toolToChatTool(tool);
      if (chatTool) {
        chatTools.push(chatTool);
        return;
      }
      chatTools.push.apply(chatTools, namespaceToolToChatTools(tool));
    });
    return chatTools;
  }

  function toolChoiceToChat(choice) {
    if (typeof choice === 'string') return choice;
    if (!choice || typeof choice !== 'object') return choice;
    if (choice.type === 'function') {
      return {
        type: 'function',
        function: { name: choice.name || (choice.function && choice.function.name) },
      };
    }
    return choice;
  }

  const body = params || {};
  const chatBody = {
    model: TARGET_CHAT_MODEL || body.model,
    messages: [],
    stream: true,
  };

  copy(body, chatBody, [
    'temperature',
    'top_p',
    'presence_penalty',
    'frequency_penalty',
    'stop',
    'parallel_tool_calls',
    'user',
  ]);

  if (body.max_output_tokens != null) {
    chatBody.max_tokens = body.max_output_tokens;
  } else if (body.max_tokens != null) {
    chatBody.max_tokens = body.max_tokens;
  }

  if (body.instructions) {
    chatBody.messages.push({ role: 'system', content: String(body.instructions) });
  }

  if (typeof body.input === 'string') {
    chatBody.messages.push({ role: 'user', content: body.input });
  } else if (Array.isArray(body.input)) {
    let pendingReasoning = '';
    let lastAssistantMessage = null;
    body.input.forEach(item => {
      const reasoning = reasoningItemToText(item);
      if (reasoning) {
        if (lastAssistantMessage) {
          appendReasoning(lastAssistantMessage, reasoning);
        } else {
          pendingReasoning += reasoning;
        }
        return;
      }

      const msg = inputItemToMessage(item);
      if (!msg) return;

      if (msg.role === 'assistant') {
        appendReasoning(msg, pendingReasoning);
        pendingReasoning = '';
        lastAssistantMessage = msg;
      } else if (msg.role !== 'tool') {
        lastAssistantMessage = null;
        pendingReasoning = '';
      }

      chatBody.messages.push(msg);
    });
  } else if (Array.isArray(body.messages)) {
    chatBody.messages = body.messages;
  }

  if (chatBody.messages.length === 0) {
    chatBody.messages.push({ role: 'user', content: '' });
  }
  chatBody.messages = normalizeAssistantHistory(chatBody.messages);

  if (Array.isArray(body.tools)) {
    chatBody.tools = toolsToChatTools(body.tools);
  }
  if (body.tool_choice != null) {
    chatBody.tool_choice = toolChoiceToChat(body.tool_choice);
  }

  return chatBody;
}

module.exports = responses2chatBody;
module.exports.fnString = responses2chatBody.toString();
