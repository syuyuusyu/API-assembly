# AI Gateway 与 LangChain 兼容性总结

本文档总结当前项目在 LangChain 接入 AI 网关时暴露出的兼容性问题，目标是在 AI 网关层统一抹平不同 provider 的 API 差异，保持业务侧代码简洁，尤其是 [app/service/langGraph_agent.py](/Users/syu/project/ml/ai_chat/mcp_agent/app/service/langGraph_agent.py) 不再承担 provider 特定格式适配。

## 当前业务侧调用方式

- 业务侧当前主要通过 `ChatOpenAI` 接入兼容 OpenAI 协议的模型。
- `LangGraph` 的 `create_react_agent` 会自动对模型做 `bind_tools(...)`，因此工具定义会作为请求顶层 `tools` 发送给模型。
- 业务侧期望 AI 网关尽量伪装成“LangChain 可直接消费的标准 provider API”。

## 结论总览

1. `ChatOpenAI` 支持 `additional_kwargs`，但不会从任意自定义流式字段自动填充 `additional_kwargs`。
2. 对 `ChatOpenAI` 来说，`chat.completion.chunk` 中真正会被解析的核心 `delta` 字段只有：`role`、`content`、`function_call`、`tool_calls`。
3. `reasoning_content` 这类兼容网关自定义字段，`ChatOpenAI` 会直接忽略。
4. `tools` 不属于 history，不会出现在 `messages` 中；它们是每次请求都要携带的顶层配置。
5. `ChatAnthropic` 使用的是完全不同的事件流协议，不能简单通过把 OpenAI chunk 改几个字段就兼容。
6. 如果目标是“业务侧统一只用 `ChatOpenAI`”，则 AI 网关必须把所有 provider 输出统一到 `ChatOpenAI` 可识别的 OpenAI 协议语义。

## LangChain `ChatOpenAI` 的实际解析行为

### 请求侧

`ChatOpenAI.bind_tools(...)` 会把工具 schema 放到请求顶层的 `tools` 字段，而不是放到 `messages` 中。

因此，符合 `ChatOpenAI` 预期的请求应类似：

```json
{
  "model": "deepseek-r1",
  "messages": [
    {"role": "user", "content": "..."}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "execute_shell",
        "description": "...",
        "parameters": {
          "type": "object",
          "properties": {
            "command": {"type": "string"}
          },
          "required": ["command"]
        }
      }
    }
  ],
  "tool_choice": "auto",
  "stream": true
}
```

### 流式响应侧

`ChatOpenAI` 在流式模式下消费的是 `chat.completion.chunk` 风格的数据。它对每个 chunk 的解析入口会读取：

- `choices`
- `choices[0].delta`
- `choices[0].finish_reason`
- `choices[0].logprobs`
- 顶层 `usage`
- 顶层 `model`
- 顶层 `system_fingerprint`

其中，`delta` 里真正会被识别的字段是：

- `role`
- `content`
- `function_call`
- `tool_calls`

不会自动识别：

- `reasoning_content`
- 任意额外自定义字段

### `tool_calls` 的要求

`ChatOpenAI` 会把 `delta.tool_calls` 转成 LangChain 内部的 `tool_call_chunks`。网关返回的 `tool_calls` 至少需要满足：

```json
{
  "choices": [
    {
      "index": 0,
      "delta": {
        "tool_calls": [
          {
            "index": 0,
            "id": "call_xxx",
            "type": "function",
            "function": {
              "name": "execute_shell",
              "arguments": "{\"command\":\"echo hello\"}"
            }
          }
        ]
      },
      "finish_reason": null
    }
  ],
  "object": "chat.completion.chunk"
}
```

注意事项：

1. `function.arguments` 必须是字符串。
2. `function.arguments` 不应返回 `null`。
3. `finish_reason: "tool_calls"` 是触发工具调用闭环的重要信号。
4. `choices: []` + 顶层 `usage` 的尾帧是可选但推荐保留。

## 当前 AI 网关暴露出的兼容性问题

### 1. `reasoning_content` 无法被 `ChatOpenAI` 自动放入 `additional_kwargs.reasoning_content`

AI 网关当前会返回类似：

```json
{
  "choices": [
    {
      "delta": {
        "content": null,
        "reasoning_content": "我们正在执行...",
        "role": "assistant"
      }
    }
  ]
}
```

这类字段对 `ChatOpenAI` 无效。最终 LangChain 只会忽略该字段，而不会自动得到：

```json
{
  "additional_kwargs": {
    "reasoning_content": "..."
  }
}
```

这意味着：

- 如果仍然使用 `ChatOpenAI`，AI 网关不能指望通过新增 `reasoning_content` 字段让 LangChain 自动识别思考内容。
- 如果要在业务侧拿到 `reasoning_content`，要么在业务侧二次提取，要么网关改造成 LangChain 原生支持的协议。

### 2. 把 `reasoning_content` 改写为 `<think>...</think>` 只能进入 `content`

我们曾尝试在网关层把：

- `reasoning_content: "xxx"`

转换为：

- `content: "<think>xxx</think>"`

这可以被 `ChatOpenAI` 识别，但结果只会进入最终消息的 `content`，例如：

```json
{
  "content": "<think>...</think>正常回复正文"
}
```

不会自动落到 `additional_kwargs.reasoning_content`。

### 3. `tool_calls` 分片格式需要更严格规范

当前网关原始返回中出现过：

- `function.arguments: null`
- 后续分片 `id: ""`
- 部分分片只有 `arguments`，没有 `name`

虽然 LangChain 对部分分片容错较高，但仍建议网关规范化：

1. `arguments` 始终为字符串，空值用 `""`。
2. 首个工具调用分片最好携带完整的 `id`、`name`、`arguments` 起始片段。
3. 后续分片至少保证 `index` 和 `function.arguments`。
4. 结束时返回 `finish_reason: "tool_calls"`。

### 4. `tools` 不在 history 中是正常现象

业务侧看到 history 的 `messages` 中没有 `tools`，不代表工具没有传出去。

正确理解是：

- `messages` 保存对话消息
- `tools` 是请求级配置
- 每次发起请求时，网关都要重新透传 `tools`

因此排查工具调用问题时，应该抓请求体顶层的 `tools` 字段，而不是看 `messages`。

## 为什么 `ChatAnthropic` 不是简单替代方案

`ChatAnthropic` 不是消费 `chat.completion.chunk`，而是消费 Anthropic 原生事件流，例如：

- `message_start`
- `content_block_start`
- `content_block_delta`
- `message_delta`
- `message_stop`

并且它会区分：

- `text_delta`
- `thinking_delta`
- `input_json_delta`
- `tool_use`

因此，如果网关要直接兼容 `ChatAnthropic`，它不能只是把 OpenAI chunk 改几个字段；必须把 OpenAI 风格流拆成 Anthropic 事件流。

这会显著增加网关复杂度，也会让“统一业务侧代码”的目标更难实现。

## 推荐的网关统一策略

### 方案 A：统一伪装成 OpenAI `chat.completions`

这是当前最可行的方案。

AI 网关对所有 provider 统一输出 OpenAI 兼容协议：

1. 请求侧统一接受 `messages`、`tools`、`tool_choice`、`stream`。
2. 响应侧统一输出 `chat.completion.chunk`。
3. 工具调用统一输出 `delta.tool_calls`。
4. usage 统一放到尾帧 `choices: []` + `usage`。
5. 不要指望 `ChatOpenAI` 原生接收 `reasoning_content`。

### 方案 B：网关自行把 reasoning 注入正文

如果业务侧继续使用 `ChatOpenAI` 且不想改 Python 代码，那么网关只有两种可行选择：

1. 彻底丢弃 reasoning
2. 把 reasoning 拼进 `content`

第二种可行，但会污染最终显示文本，例如：

```text
<think>...</think>最终回答正文
```

### 方案 C：业务侧少量后处理

如果允许业务侧做极少量兼容处理，则可以在业务代码中把 `content` 里的 `<think>...</think>` 提取到 `additional_kwargs.reasoning_content`。

这不是网关层纯解决，但实现成本最低。

## 网关调试检查清单

### 请求入站检查

1. 是否收到顶层 `tools`
2. 是否收到 `tool_choice`
3. 是否收到 `parallel_tool_calls`
4. 是否收到 `stream: true`
5. 是否保留原始 `messages`

### 向上游 provider 转发检查

1. provider 不支持 OpenAI tools 时，网关是否做了协议转换
2. provider 的工具调用结果是否重新映射回 OpenAI `tool_calls`
3. provider 的 reasoning 字段是否被统一处理

### 流式出站检查

1. 每个 chunk 是否是合法的 `chat.completion.chunk`
2. `choices[0].delta.tool_calls[*].function.arguments` 是否始终为字符串
3. 是否正确输出 `finish_reason: "tool_calls"` 或 `"stop"`
4. 是否输出最终 usage 尾帧
5. 是否避免输出 `ChatOpenAI` 不认识但业务侧又误以为会被识别的字段

## 对当前项目的建议

### 对 AI 网关

1. 把所有 provider 的流式输出收敛到标准 OpenAI `chat.completion.chunk`
2. 工具调用严格对齐 OpenAI 的 `delta.tool_calls`
3. 不要把 `reasoning_content` 当成 `ChatOpenAI` 能识别的标准字段
4. 如需保留 reasoning，要么直接丢弃，要么注入 `content`，要么定义业务侧后处理约定

### 对业务侧

在“网关应解决全部 provider 差异”的前提下，业务侧当前代码应尽量不做 provider 特定解析。当前 [app/service/langGraph_agent.py](/Users/syu/project/ml/ai_chat/mcp_agent/app/service/langGraph_agent.py) 里的 `_normalize_reasoning_content()` 可以保留用于 Anthropic 等结构化内容，但不应承担 OpenAI-compatible 网关的核心协议修正责任。

## 最终判断

AI 网关如果要作为统一适配层，最重要的不是“尽量保留 provider 自有字段”，而是“输出 LangChain 已明确支持的协议字段”。

在当前架构下，统一兼容 `ChatOpenAI` 的成本远低于兼容 `ChatAnthropic`。因此建议把 AI 网关目标协议固定为：

- OpenAI `chat.completions`
- 顶层 `tools`
- 流式 `delta.tool_calls`
- 标准 `finish_reason`
- 可选 `usage` 尾帧

并接受一个事实：

- `reasoning_content` 不是 `ChatOpenAI` 原生支持字段
- 想让它进入 `additional_kwargs.reasoning_content`，不能只靠 OpenAI 兼容流式 chunk，需要业务侧额外处理或改用不同协议
