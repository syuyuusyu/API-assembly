/**
 * parseFun: OpenAI streaming format → Anthropic streaming format
 *
 * 将此文件中 openai2anthropic 函数体的字符串存入 API Configuration 的 parseFun 字段即可。
 * 调用约定（aiStream.js）：fn.call(parseFnObj, chunk, {}, 200, requestHead, requestBody, url)
 *   - this      : parseFnObj —— 跨 chunk 的状态对象
 *   - chunk     : 上游 OpenAI 格式的 SSE JSON 数据
 *   - 返回值     : Anthropic 事件对象数组（每个元素写成独立 SSE 行），null 表示跳过
 *
 * 支持场景：
 *   - 普通文本流
 *   - 单个 / 并行 tool call（通过 OpenAI tcIndex → Anthropic blockIndex 对齐 ID）
 *   - finish_reason 到 stop_reason 映射
 *   - token 用量（usage 字段）
 *
 * 状态字段（挂在 this / parseFnObj 上）：
 *   _oai2ant_init   : boolean          — 已初始化标记
 *   _msgId          : string           — message id（来自第一个含 id 的 chunk）
 *   _model          : string           — 模型名
 *   _msgStartSent   : boolean          — message_start 是否已发送
 *   _nextBlockIdx   : number           — 下一个 content block 的 Anthropic index
 *   _textBlockIdx   : number           — text block 的 Anthropic index（-1 表示未开启）
 *   _textBlockOpen  : boolean          — text block 是否处于开启状态
 *   _toolBlocks     : object           — tcIndex → { idx, open }，记录每个 tool call 的 block
 *   _inputTokens    : number
 *   _outputTokens   : number
 */
function openai2anthropic(chunk, res, status, head, body, url) {
  var self = this;
  var events = [];

  // ── 初始化状态 ──────────────────────────────────────────────
  if (!self._oai2ant_init) {
    self._oai2ant_init   = true;
    self._msgId          = '';
    self._model          = '';
    self._msgStartSent   = false;
    self._nextBlockIdx   = 0;
    self._textBlockIdx   = -1;
    self._textBlockOpen  = false;
    self._toolBlocks     = {};  // tcIndex → { idx: number, open: boolean }
    self._inputTokens    = 0;
    self._outputTokens   = 0;
  }

  // ── 提取元数据 ────────────────────────────────────────────────
  if (chunk.id && !self._msgId) self._msgId = chunk.id;
  if (chunk.model && !self._model) self._model = chunk.model;
  if (chunk.usage) {
    if (typeof chunk.usage.prompt_tokens === 'number')
      self._inputTokens = chunk.usage.prompt_tokens;
    if (typeof chunk.usage.completion_tokens === 'number')
      self._outputTokens = chunk.usage.completion_tokens;
  }

  var choices = Array.isArray(chunk.choices) ? chunk.choices : [];

  // ── message_start（仅首次发送）────────────────────────────────
  if (!self._msgStartSent && (self._msgId || choices.length > 0)) {
    self._msgStartSent = true;
    events.push({
      type: 'message_start',
      message: {
        id:            self._msgId || ('msg_' + Date.now()),
        type:          'message',
        role:          'assistant',
        content:       [],
        model:         self._model || (body && body.model) || '',
        stop_reason:   null,
        stop_sequence: null,
        usage:         { input_tokens: self._inputTokens, output_tokens: 0 },
      },
    });
  }

  // ── 遍历 choices ─────────────────────────────────────────────
  for (var ci = 0; ci < choices.length; ci++) {
    var choice       = choices[ci];
    var delta        = choice.delta || {};
    var finishReason = choice.finish_reason;

    // ── 文本内容 ──────────────────────────────────────────────
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      if (!self._textBlockOpen) {
        self._textBlockOpen = true;
        self._textBlockIdx  = self._nextBlockIdx++;
        events.push({
          type:          'content_block_start',
          index:         self._textBlockIdx,
          content_block: { type: 'text', text: '' },
        });
      }
      events.push({
        type:  'content_block_delta',
        index: self._textBlockIdx,
        delta: { type: 'text_delta', text: delta.content },
      });
    }

    // ── Tool calls（支持并行：多个 tc 有不同 index）──────────────
    if (Array.isArray(delta.tool_calls)) {
      for (var ti = 0; ti < delta.tool_calls.length; ti++) {
        var tc    = delta.tool_calls[ti];
        var tcIdx = typeof tc.index === 'number' ? tc.index : 0;

        // 新的 tool call：开启对应 content block
        // tc.id 只在首个 chunk 出现，以此判断是否需要新建 block
        if (tc.id && !self._toolBlocks[tcIdx]) {
          var blockIdx = self._nextBlockIdx++;
          self._toolBlocks[tcIdx] = { idx: blockIdx, open: true };
          events.push({
            type:          'content_block_start',
            index:         blockIdx,
            content_block: {
              type:  'tool_use',
              id:    tc.id,                               // 保留原始 tool call ID
              name:  (tc.function && tc.function.name) || '',
              input: {},
            },
          });
        }

        // arguments 增量（可能分多个 chunk 到达）
        if (tc.function && typeof tc.function.arguments === 'string' &&
            tc.function.arguments.length > 0) {
          var blk = self._toolBlocks[tcIdx];
          if (blk && blk.open) {
            events.push({
              type:  'content_block_delta',
              index: blk.idx,
              delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
            });
          }
        }
      }
    }

    // ── 结束处理 ──────────────────────────────────────────────
    if (finishReason) {
      // 关闭 text block
      if (self._textBlockOpen) {
        self._textBlockOpen = false;
        events.push({ type: 'content_block_stop', index: self._textBlockIdx });
      }

      // 按 Anthropic blockIndex 升序关闭所有 tool blocks
      // 并行 tool call 时保证顺序一致性
      var toolBlkList = Object.keys(self._toolBlocks)
        .map(function(k) { return self._toolBlocks[k]; })
        .sort(function(a, b) { return a.idx - b.idx; });
      for (var bi = 0; bi < toolBlkList.length; bi++) {
        if (toolBlkList[bi].open) {
          toolBlkList[bi].open = false;
          events.push({ type: 'content_block_stop', index: toolBlkList[bi].idx });
        }
      }

      // finish_reason → stop_reason 映射
      var stopReason = 'end_turn';
      if (finishReason === 'tool_calls')      stopReason = 'tool_use';
      else if (finishReason === 'length')     stopReason = 'max_tokens';
      else if (finishReason === 'content_filter') stopReason = 'stop_sequence';

      events.push({
        type:  'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: self._outputTokens },
      });
      events.push({ type: 'message_stop' });
    }
  }

  return events.length > 0 ? events : null;
}

module.exports = openai2anthropic;

/**
 * 存入数据库的字符串形式（复制 openai2anthropic 函数体存入 parseFun 字段）
 * 例：
 *   INSERT INTO invoke_info SET parseFun = module.exports.fnString ...
 */
module.exports.fnString = openai2anthropic.toString();
