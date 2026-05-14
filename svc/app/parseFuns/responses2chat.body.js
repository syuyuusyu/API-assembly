/**
 * API Configuration body builder: Responses request body -> Chat Completions body.
 *
 * Store module.exports.fnString in invoke_info.body. aiStream.js calls it as:
 *   fn.call(helperContext, params)
 *
 * params is the original request body sent by the client.
 */
function responses2chatBody(params) {
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
    model: body.model,
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
    body.input.forEach(item => {
      const msg = inputItemToMessage(item);
      if (msg) chatBody.messages.push(msg);
    });
  } else if (Array.isArray(body.messages)) {
    chatBody.messages = body.messages;
  }

  if (chatBody.messages.length === 0) {
    chatBody.messages.push({ role: 'user', content: '' });
  }

  if (Array.isArray(body.tools)) {
    chatBody.tools = body.tools.map(toolToChatTool).filter(Boolean);
  }
  if (body.tool_choice != null) {
    chatBody.tool_choice = toolChoiceToChat(body.tool_choice);
  }

  return chatBody;
}

module.exports = responses2chatBody;
module.exports.fnString = responses2chatBody.toString();
