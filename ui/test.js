// ─────────────────────────────────────────────
// parseFun：将上游 <think> 标签格式转换为
// DeepSeek-R1 风格的 reasoning_content 分离格式
//
// this = parseFnObj（整流生命周期内共享）
//   this.isThink  : boolean  当前是否在 <think> 块内
// ─────────────────────────────────────────────
function parseFun(chunk) {
  if (!chunk || !Array.isArray(chunk.choices) || chunk.choices.length === 0) {
    return chunk;
  }

  const delta = chunk.choices[0].delta || {};

  // 上游已是原生 reasoning_content 格式（如 deepseek-r1），直接透传
  if (Object.prototype.hasOwnProperty.call(delta, 'reasoning_content')) {
    return chunk;
  }

  const rawContent = delta.content;

  // content 为 null / 空，直接透传
  if (rawContent == null || rawContent === '') {
    return chunk;
  }

  let content = rawContent;
  let reasoningContent = null;

  if (!this.isThink) {
    const startIdx = content.indexOf('<think>');
    if (startIdx !== -1) {
      const afterTag = content.slice(startIdx + 7); // skip '<think>'
      const endIdx = afterTag.indexOf('</think>');
      if (endIdx !== -1) {
        // 同一 chunk 内 <think>...</think> 完整出现
        reasoningContent = afterTag.slice(0, endIdx) || null;
        content = content.slice(0, startIdx) + afterTag.slice(endIdx + 8);
        content = content || null;
      } else {
        // <think> 打开，尚未关闭
        reasoningContent = afterTag || null;
        content = content.slice(0, startIdx) || null;
        this.isThink = true;
      }
    }
    // 没有 <think> 标签：content 保持原样，reasoningContent 为 null
  } else {
    // 当前处于 <think> 块内
    const endIdx = content.indexOf('</think>');
    if (endIdx !== -1) {
      reasoningContent = content.slice(0, endIdx) || null;
      content = content.slice(endIdx + 8) || null;
      this.isThink = false;
    } else {
      // 全部归入 reasoning
      reasoningContent = content;
      content = null;
    }
  }

  // 构造新 chunk，避免修改原对象
  return {
    ...chunk,
    choices: chunk.choices.map((choice, i) => {
      if (i !== 0) return choice;
      return {
        ...choice,
        delta: {
          ...delta,
          content,
          reasoning_content: reasoningContent,
        },
      };
    }),
  };
}

// ─────────────────────────────────────────────
// 原始输入：上游返回 <think> 标签格式（如 Qwen-thinking）
// ─────────────────────────────────────────────
const rawChunks = [
  // ── thinking 阶段：<think> 跨多个 chunk ──
  { choices: [{ delta: { content: '<think>我们', role: 'assistant' }, finish_reason: null, index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-001' },
  { choices: [{ delta: { content: '刚刚已经调' }, finish_reason: null, index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-001' },
  { choices: [{ delta: { content: '用了list_databases两次' }, finish_reason: null, index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-001' },
  { choices: [{ delta: { content: '，得到了相同的结果。\n 由于' }, finish_reason: null, index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-001' },
  { choices: [{ delta: { content: '结果相同，我将直接展示数据库列表，' }, finish_reason: null, index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-001' },
  { choices: [{ delta: { content: '并询问用户是否需要进一步操作。</think>' }, finish_reason: null, index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-001' },
  // ── content 阶段 ──
  { choices: [{ delta: { content: '我' }, finish_reason: null, index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-001' },
  { choices: [{ delta: { content: '再次调用了 `list_databases` 工具，' }, finish_reason: null, index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-001' },
  { choices: [{ delta: { content: '结果与上次一致。' }, finish_reason: null, index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-001' },
  // ── 同一 chunk 内完整 <think>...</think> ──
  { choices: [{ delta: { content: '<think>简短思考</think>直接回答' }, finish_reason: null, index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-002' },
  // ── finish ──
  { choices: [{ delta: { content: '' }, finish_reason: 'stop', index: 0 }], object: 'chat.completion.chunk', model: 'qwen-thinking', id: 'raw-001' },
];

// ─────────────────────────────────────────────
// 测试运行
// ─────────────────────────────────────────────
const parseFnObj = { isThink: false };

console.log('=== parseFun 转换结果 ===\n');
rawChunks.forEach((chunk, i) => {
  const result = parseFun.call(parseFnObj, chunk);
  const delta = result.choices[0].delta;
  const rc = delta.reasoning_content;
  const ct = delta.content;
  console.log(
    `[${String(i).padStart(2, '0')}]`,
    'reasoning_content:', rc == null ? 'null' : JSON.stringify(rc),
    ' | content:', ct == null ? 'null' : JSON.stringify(ct),
    parseFnObj.isThink ? ' [IN_THINK]' : ''
  );
});

console.log('\n=== isThink 最终状态:', parseFnObj.isThink, '（应为 false）===');

// ─────────────────────────────────────────────
// target 参考格式（DeepSeek-R1 原生，直接透传）
// ─────────────────────────────────────────────
const rarget  = [
  {
    "choices": [
      {
        "delta": {
          "content": null,
          "reasoning_content": "我们",
          "role": "assistant"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "刚刚"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "已经"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "调"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "用了list_databases两次"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "，得到了相同的结果。"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "现在用户说“再"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "执行一次”，可能"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "是在测试重复调用是否"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "会有变化，或者想确认"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "结果的一致性。\n 由于"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "结果相同，我将"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "直接展示数据库列表，"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "并询问用户是否需要进一步操作"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "。"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "我", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "再次调用了 `list", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "_databases` 工具，", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "结果与上次一致", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "：\n\n当前系统中共有 **", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "4 个数据库**", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "：\n\n| 序号", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": " | 数据库名 |\n|", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {
          "content": "------|----------|\n| ",
          "reasoning_content": null
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "1 | bqm |\n", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "| 2 | information", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "_schema |\n| 3", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {
          "content": " | performance_schema |\n",
          "reasoning_content": null
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "| 4 | sys", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": " |\n\n数据库列表保持不变", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "，说明这是一个稳定的系统环境", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "。接下来你想探索", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "哪个数据库？或者有其他", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {"content": "需求吗？", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "finish_reason": "stop",
        "delta": {"content": "", "reasoning_content": null},
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412941,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-c73b1e78-983c-93d5-87d5-325f9267efb7"
  },
  {
    "choices": [
      {
        "delta": {
          "content": null,
          "reasoning_content": "我们",
          "role": "assistant"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "连续"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "调"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "用了三次list"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "_databases，结果都是相同的"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "四个数据库：bqm,"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {
          "content": null,
          "reasoning_content": " information_schema, performance"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "_schema, sys。\n"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": " 用户可能是在"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "测试工具调用的稳定性"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "，或者想看看是否有"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "变化。由于结果一致"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "，说明数据库列表"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "是稳定的。\n "},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "考虑到用户只是简单要求调用"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "工具，并没有明确的任务"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "目标，我们可以主动"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": null, "reasoning_content": "询问下一步需求。"},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "我再次成功调", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "用了 `list_databases`", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": " 工具！✨", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "\n\n结果仍然显示有", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": " **4 个数据库**", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "，和之前完全", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "一致：\n\n| 序号", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": " | 数据库名 |\n|", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {
          "content": "------|----------|\n| ",
          "reasoning_content": null
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "1 | bqm |\n", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "| 2 | information", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "_schema |\n| 3", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {
          "content": " | performance_schema |\n",
          "reasoning_content": null
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "| 4 | sys", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": " |\n\n这说明数据库列表是", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "稳定的，没有发生变化", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "。您是否需要我执行", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "其他操作？比如查看", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "delta": {"content": "某个数据库的表结构？", "reasoning_content": null},
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  },
  {
    "choices": [
      {
        "finish_reason": "stop",
        "delta": {"content": "", "reasoning_content": null},
        "index": 0,
        "logprobs": null
      }
    ],
    "object": "chat.completion.chunk",
    "usage": null,
    "created": 1776412947,
    "system_fingerprint": null,
    "model": "deepseek-r1",
    "id": "chatcmpl-eed51145-fd8b-9bc9-85ed-75ff615dfadd"
  }
]

const raw = [
  {
    "id": "06311a4124b6edaf434def48c0ee849b",
    "choices": [{"index": 0, "delta": {"role": "assistant"}}],
    "created": 1776412487,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a4124b6edaf434def48c0ee849b",
    "choices": [
      {"index": 0, "delta": {"content": "<think>", "role": "assistant"}}
    ],
    "created": 1776412487,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a4124b6edaf434def48c0ee849b",
    "choices": [
      {
        "index": 0,
        "delta": {
          "content": "用户想简单调用一个工具。让我先列出可用的数据库，看看系统有什么。\n",
          "role": "assistant"
        }
      }
    ],
    "created": 1776412487,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a4124b6edaf434def48c0ee849b",
    "choices": [
      {"index": 0, "delta": {"content": "</think>", "role": "assistant"}}
    ],
    "created": 1776412487,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a4124b6edaf434def48c0ee849b",
    "choices": [{"index": 0, "delta": {"content": "", "role": "assistant"}}],
    "created": 1776412487,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a4124b6edaf434def48c0ee849b",
    "choices": [
      {
        "index": 0,
        "delta": {"content": "\n\n好的，让我先列出可用的数据库：\n", "role": "assistant"}
      }
    ],
    "created": 1776412487,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a4124b6edaf434def48c0ee849b",
    "choices": [
      {
        "index": 0,
        "delta": {
          "role": "assistant",
          "tool_calls": [
            {
              "id": "call_function_1e0ztcql82pw_1",
              "type": "function",
              "function": {"name": "list_databases", "arguments": ""},
              "index": 0
            }
          ]
        }
      }
    ],
    "created": 1776412487,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a4124b6edaf434def48c0ee849b",
    "choices": [
      {
        "index": 0,
        "delta": {
          "role": "assistant",
          "tool_calls": [{"function": {"arguments": "{}"}, "index": 0}]
        }
      }
    ],
    "created": 1776412487,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a4124b6edaf434def48c0ee849b",
    "choices": [
      {
        "finish_reason": "tool_calls",
        "index": 0,
        "delta": {"role": "assistant"}
      }
    ],
    "created": 1776412487,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
   {
    "id": "06311a6b37c9160dcb81d5df211a845d",
    "choices": [{"index": 0, "delta": {"role": "assistant"}}],
    "created": 1776412525,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a6b37c9160dcb81d5df211a845d",
    "choices": [
      {"index": 0, "delta": {"content": "<think>", "role": "assistant"}}
    ],
    "created": 1776412525,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a6b37c9160dcb81d5df211a845d",
    "choices": [
      {
        "index": 0,
        "delta": {
          "content": "好的，我成功调用了 list_databases 工具。它返回了4个数据库：bqm, information_schema, performance_schema, sys。\n\n现在我可以告诉用户我成功调用了工具并展示了结果。\n",
          "role": "assistant"
        }
      }
    ],
    "created": 1776412525,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a6b37c9160dcb81d5df211a845d",
    "choices": [
      {"index": 0, "delta": {"content": "</think>", "role": "assistant"}}
    ],
    "created": 1776412525,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a6b37c9160dcb81d5df211a845d",
    "choices": [{"index": 0, "delta": {"content": "", "role": "assistant"}}],
    "created": 1776412525,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a6b37c9160dcb81d5df211a845d",
    "choices": [
      {
        "index": 0,
        "delta": {
          "content": "\n\n我成功调用了 `list_databases` 工具！🎉\n\n当前系统中共有 **4 个数据库**：\n\n| 序号 | 数据库名 |\n|------|----------|\n| 1 | bqm |\n| 2 | information_schema |\n| 3 | performance_schema |\n| 4 | sys |\n\n如果你想进一步探索某个数据库（比如 \"bqm\"）的表结构，可以告诉我！",
          "role": "assistant"
        }
      }
    ],
    "created": 1776412525,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  },
  {
    "id": "06311a6b37c9160dcb81d5df211a845d",
    "choices": [
      {"finish_reason": "stop", "index": 0, "delta": {"role": "assistant"}}
    ],
    "created": 1776412525,
    "model": "MiniMax-M2.5",
    "object": "chat.completion.chunk",
    "usage": null,
    "input_sensitive": false,
    "output_sensitive": false,
    "input_sensitive_type": 0,
    "output_sensitive_type": 0,
    "output_sensitive_int": 0
  }
]

