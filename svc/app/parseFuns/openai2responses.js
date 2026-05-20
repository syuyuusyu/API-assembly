/**
 * parseFun: OpenAI Chat Completions streaming format -> OpenAI Responses streaming format
 *
 * Invocation convention in aiStream.js:
 *   fn.call(parseFnObj, chunk, {}, 200, requestHead, requestBody, url)
 *
 * The upstream provider returns chat.completion.chunk SSE objects. This function
 * emits Responses API SSE event objects for Codex clients configured with
 * wire_api = "responses".
 * @param {object} chunk Upstream chat.completion.chunk object.
 * @param {object} res Unused upstream response object.
 * @param {number} status Unused upstream status code.
 * @param {object} head Unused request headers.
 * @param {object} body Unused request body.
 * @param {string} url Unused upstream URL.
 */
function openai2responses(chunk) {
  function responseEnvelope(self, status, output) {
    return {
      id: self._responseId || ('resp_' + Date.now()),
      object: 'response',
      created_at: self._created || Math.floor(Date.now() / 1000),
      status,
      model: self._model || '',
      output: output || [],
      parallel_tool_calls: true,
      usage: convertUsage(self._usage),
    };
  }

  function convertUsage(usage) {
    if (!usage) return null;
    return {
      input_tokens: usage.prompt_tokens || 0,
      output_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
    };
  }

  function ensureTextItem(self, events) {
    if (self._textItem) return;
    self._textItem = {
      id: 'msg_' + self._nextOutputIndex,
      outputIndex: self._nextOutputIndex++,
      text: '',
      done: false,
    };
    self._outputItems.push(self._textItem);
    events.push({
      type: 'response.output_item.added',
      output_index: self._textItem.outputIndex,
      item: messageOutputItem(self._textItem, 'in_progress'),
    });
    events.push({
      type: 'response.content_part.added',
      item_id: self._textItem.id,
      output_index: self._textItem.outputIndex,
      content_index: 0,
      part: { type: 'output_text', text: '', annotations: [] },
    });
  }

  function closeOpenItems(self, events) {
    if (self._textItem && !self._textItem.done) {
      self._textItem.done = true;
      events.push({
        type: 'response.output_text.done',
        item_id: self._textItem.id,
        output_index: self._textItem.outputIndex,
        content_index: 0,
        text: self._textItem.text,
      });
      events.push({
        type: 'response.content_part.done',
        item_id: self._textItem.id,
        output_index: self._textItem.outputIndex,
        content_index: 0,
        part: { type: 'output_text', text: self._textItem.text, annotations: [] },
      });
      events.push({
        type: 'response.output_item.done',
        output_index: self._textItem.outputIndex,
        item: messageOutputItem(self._textItem, 'completed'),
      });
    }

    const keys = Object.keys(self._toolItems).sort(function(a, b) {
      return self._toolItems[a].outputIndex - self._toolItems[b].outputIndex;
    });
    for (let i = 0; i < keys.length; i++) {
      const item = self._toolItems[keys[i]];
      if (item.done) continue;
      item.done = true;
      events.push({
        type: 'response.function_call_arguments.done',
        item_id: item.id,
        output_index: item.outputIndex,
        arguments: item.arguments,
      });
      events.push({
        type: 'response.output_item.done',
        output_index: item.outputIndex,
        item: toolOutputItem(item, 'completed'),
      });
    }
  }

  function completedOutput(self) {
    return self._outputItems
      .slice()
      .sort(function(a, b) { return a.outputIndex - b.outputIndex; })
      .map(function(item) {
        if (Object.prototype.hasOwnProperty.call(item, 'text')) {
          return messageOutputItem(item, 'completed');
        }
        return toolOutputItem(item, 'completed');
      });
  }

  function messageOutputItem(item, status) {
    return {
      id: item.id,
      type: 'message',
      status,
      role: 'assistant',
      content: [
        { type: 'output_text', text: item.text || '', annotations: [] },
      ],
    };
  }

  function toolOutputItem(item, status) {
    const outputItem = {
      id: item.id,
      type: 'function_call',
      status,
      call_id: item.callId,
      name: item.name || '',
      arguments: item.arguments || '',
    };
    if (item.namespace) {
      outputItem.namespace = item.namespace;
      outputItem.name = item.name || '';
    }
    return outputItem;
  }

  function splitNamespacedToolName(name) {
    if (typeof name !== 'string') return null;
    const match = name.match(/^(mcp__.+?__)(.+)$/);
    if (!match) return null;
    return {
      namespace: match[1],
      name: match[2],
    };
  }

  const self = this;
  const events = [];

  if (!self._oai2resp_init) {
    self._oai2resp_init = true;
    self._responseId = '';
    self._model = '';
    self._created = Math.floor(Date.now() / 1000);
    self._responseStarted = false;
    self._textItem = null;
    self._toolItems = {};
    self._outputItems = [];
    self._nextOutputIndex = 0;
    self._usage = null;
  }

  if (chunk.id && !self._responseId) self._responseId = chunk.id;
  if (chunk.model && !self._model) self._model = chunk.model;
  if (typeof chunk.created === 'number') self._created = chunk.created;
  if (chunk.usage && typeof chunk.usage === 'object') self._usage = chunk.usage;

  if (!self._responseStarted) {
    self._responseStarted = true;
    events.push({
      type: 'response.created',
      response: responseEnvelope(self, 'in_progress', []),
    });
    events.push({
      type: 'response.in_progress',
      response: responseEnvelope(self, 'in_progress', []),
    });
  }

  const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
  for (let ci = 0; ci < choices.length; ci++) {
    const choice = choices[ci] || {};
    const delta = choice.delta || {};

    if (typeof delta.content === 'string' && delta.content.length > 0) {
      ensureTextItem(self, events);
      self._textItem.text += delta.content;
      events.push({
        type: 'response.output_text.delta',
        item_id: self._textItem.id,
        output_index: self._textItem.outputIndex,
        content_index: 0,
        delta: delta.content,
      });
    }

    if (Array.isArray(delta.tool_calls)) {
      for (let ti = 0; ti < delta.tool_calls.length; ti++) {
        const tc = delta.tool_calls[ti] || {};
        const tcIndex = typeof tc.index === 'number' ? tc.index : ti;
        let toolItem = self._toolItems[tcIndex];
        const fnName = tc.function && tc.function.name || '';
        const namespacedName = splitNamespacedToolName(fnName);

        if (!toolItem) {
          toolItem = {
            id: tc.id || ('call_' + self._nextOutputIndex),
            callId: tc.id || ('call_' + self._nextOutputIndex),
            name: namespacedName ? namespacedName.name : fnName,
            namespace: namespacedName ? namespacedName.namespace : '',
            arguments: '',
            outputIndex: self._nextOutputIndex++,
            done: false,
          };
          self._toolItems[tcIndex] = toolItem;
          self._outputItems.push(toolItem);
          events.push({
            type: 'response.output_item.added',
            output_index: toolItem.outputIndex,
            item: toolOutputItem(toolItem, 'in_progress'),
          });
        }

        if (tc.id) {
          toolItem.id = tc.id;
          toolItem.callId = tc.id;
        }
        if (tc.function && tc.function.name) {
          const splitName = splitNamespacedToolName(tc.function.name);
          toolItem.name = splitName ? splitName.name : tc.function.name;
          toolItem.namespace = splitName ? splitName.namespace : '';
        }
        if (tc.function && typeof tc.function.arguments === 'string' &&
					tc.function.arguments.length > 0) {
          toolItem.arguments += tc.function.arguments;
          events.push({
            type: 'response.function_call_arguments.delta',
            item_id: toolItem.id,
            output_index: toolItem.outputIndex,
            delta: tc.function.arguments,
          });
        }
      }
    }

    if (choice.finish_reason) {
      closeOpenItems(self, events);
      events.push({
        type: 'response.completed',
        response: responseEnvelope(self, 'completed', completedOutput(self)),
      });
    }
  }
  return events.length > 0 ? events : null;
}



module.exports = openai2responses;
module.exports.fnString = openai2responses.toString();
