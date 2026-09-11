/**
 * parseFun: Ollama OpenAI-compatible streaming format -> DeepSeek chat stream.
 *
 * Store ollama2deepseek.toString() in invoke_info.parseFun.
 * aiStream.js calls this as:
 *   fn.call(parseFnObj, chunk, {}, 200, requestHead, requestBody, url)
 *
 * Ollama's /v1/chat/completions streams reasoning as delta.reasoning, while
 * DeepSeek streams it as delta.reasoning_content. This keeps OpenAI-compatible
 * chat/tool-call chunks intact and normalizes only the fields DeepSeek clients
 * expect.
 */
function ollama2deepseek(chunk, res, status, head, body, url) {
  function clone(value) {
    if (value == null || typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeDelta(delta) {
    if (!delta || typeof delta !== 'object') return delta;

    var next = clone(delta);
    var reasoning = null;

    if (typeof next.reasoning_content === 'string') {
      reasoning = next.reasoning_content;
    } else if (typeof next.reasoning === 'string') {
      reasoning = next.reasoning;
    } else if (typeof next.thinking === 'string') {
      reasoning = next.thinking;
    }

    delete next.reasoning;
    delete next.thinking;

    if (reasoning !== null) {
      next.reasoning_content = reasoning;
      if (next.content == null || next.content === '') {
        next.content = null;
      }
    } else if (
      typeof next.content === 'string' ||
      next.content === null ||
      next.role ||
      next.tool_calls
    ) {
      if (next.role && next.content === undefined) {
        next.content = null;
      }
      next.reasoning_content = null;
    }

    return next;
  }

  if (!chunk || typeof chunk !== 'object') return chunk;

  var result = clone(chunk);
  var choices = Array.isArray(result.choices) ? result.choices : [];

  for (var i = 0; i < choices.length; i++) {
    var choice = choices[i];
    if (!choice || typeof choice !== 'object') continue;
    choice.delta = normalizeDelta(choice.delta || {});
    if (choice.logprobs === undefined) choice.logprobs = null;
    if (choice.finish_reason === undefined) choice.finish_reason = null;
  }

  return result;
}

module.exports = ollama2deepseek;
module.exports.fnString = ollama2deepseek.toString();
