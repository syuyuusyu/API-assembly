import React from 'react';
import stringify from 'json-stringify-pretty-compact';
import { RobotOutlined, ToolOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Collapse, Descriptions, Empty, Space, Tag, Typography } from 'antd';
import { Bubble, CodeHighlighter, ThoughtChain, XProvider } from '@ant-design/x';
import XMarkdown from '@ant-design/x-markdown';
import Latex from '@ant-design/x-markdown/plugins/Latex';
import CodeMirror from '@uiw/react-codemirror';
import { json as codeJson } from '@codemirror/lang-json';

const { Text } = Typography;
const { Panel } = Collapse;

const userAvatar = { color: '#fff', backgroundColor: '#1677ff' };
const assistantAvatar = { color: '#fff', backgroundColor: '#52c41a' };
const toolAvatar = { color: '#fff', backgroundColor: '#722ed1' };
const systemAvatar = { color: '#fff', backgroundColor: '#8c8c8c' };

const parseJson = value => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return { raw: value };
  }
};

const jsonText = value => stringify(value || {}, { indent: 2 });

const JsonBlock = ({ value, height = 180 }) => (
  <CodeMirror
    value={jsonText(value)}
    extensions={[codeJson()]}
    height={`${height}px`}
    style={{ width: '100%', overflowWrap: 'break-word' }}
  />
);

const Code = props => {
  const { className, children } = props;
  const lang = className?.match(/language-(\w+)/)?.[1] || '';
  if (typeof children !== 'string') return null;
  return <CodeHighlighter lang={lang}>{children}</CodeHighlighter>;
};

const shortText = (value, len = 360) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '');
  return text.length > len ? `${text.slice(0, len)}...` : text;
};

const isDefaultPromptText = text => {
  if (typeof text !== 'string') return false;
  return /<system-reminder>|# claudeMd|CLAUDE\.md|You are Claude Code|SUGGESTION MODE|user-invocable skills|You are a coding agent running in the Codex CLI|<permissions instructions>|<skills_instructions>|<plugins_instructions>|sandbox_mode.*(?:workspace-write|workspace-ro|read-eval)|AGENTS\.md spec|How you work.*Personality|Responsiveness|Preamble messages/.test(text);
};

const defaultPromptTitle = text => {
  if (/<system-reminder>/.test(text) && /# claudeMd|CLAUDE\.md/.test(text)) return 'Claude Code context';
  if (/<system-reminder>/.test(text) && /skills are available|user-invocable skills/.test(text)) return 'Claude Code skills reminder';
  if (/You are Claude Code/.test(text)) return 'Claude Code system prompt';
  if (/SUGGESTION MODE/.test(text)) return 'Claude Code suggestion prompt';
  if (/<system-reminder>/.test(text)) return 'system reminder';
  if (/You are a coding agent running in the Codex CLI/.test(text) && /How you work/.test(text)) return 'Codex system prompt';
  if (/<permissions instructions>/.test(text) && /sandbox_mode/.test(text)) return 'Codex permissions & sandbox';
  if (/<skills_instructions>/.test(text) && /Available skills/.test(text)) return 'Codex skills instructions';
  if (/<plugins_instructions>/.test(text) && /Available plugins/.test(text)) return 'Codex plugins instructions';
  if (/<permissions instructions>/.test(text)) return 'permissions instructions';
  if (/<skills_instructions>/.test(text)) return 'skills instructions';
  if (/<plugins_instructions>/.test(text)) return 'plugins instructions';
  if (/AGENTS\.md spec/.test(text)) return 'AGENTS.md spec';
  if (/How you work.*Personality/.test(text)) return 'personality & behavior';
  return 'default prompt';
};

const splitTextBlocks = content => {
  if (!Array.isArray(content)) {
    return {
      visibleText: isDefaultPromptText(content) ? '' : contentText(content),
      foldedTextBlocks: isDefaultPromptText(content) ? [{ title: defaultPromptTitle(content), text: content }] : [],
    };
  }

  const foldedTextBlocks = [];
  const visibleBlocks = content.filter(item => {
    if (item?.type === 'text' && isDefaultPromptText(item.text)) {
      foldedTextBlocks.push({ title: defaultPromptTitle(item.text), text: item.text, raw: item });
      return false;
    }
    if (item?.type === 'tool_result') {
      return false;
    }
    return true;
  });

  return {
    visibleText: contentText(visibleBlocks),
    foldedTextBlocks,
  };
};

const contentText = content => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(item => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      if (item.type === 'text') return item.text || '';
      if (item.type === 'image_url') return `[image] ${item.image_url?.url || ''}`;
      if (item.type === 'image') return `[image] ${item.source?.media_type || ''}`;
      if (item.type === 'tool_result') return `[tool result ${item.tool_use_id || ''}] ${contentText(item.content)}`;
      return JSON.stringify(item);
    }).filter(Boolean).join('\n');
  }
  return JSON.stringify(content);
};

const isJsonText = text => {
  if (typeof text !== 'string') return false;
  try {
    JSON.parse(text);
    return true;
  } catch (e) {
    return false;
  }
};

const isMarkdownText = text => {
  if (typeof text !== 'string') return false;
  return /```|^\s*[-*]\s|^\s*\d+\.\s|^\s*#{1,6}\s|^\s*>|^\s*\||\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`/m.test(text);
};

const markdownText = text => {
  if (isJsonText(text)) {
    return `\`\`\`json\n${JSON.stringify(JSON.parse(text), null, 2)}\n\`\`\``;
  }
  if (isMarkdownText(text)) return text;
  return `\`\`\`text\n${text}\n\`\`\``;
};

const getRequest = record => parseJson(record.request);
const getResponse = record => parseJson(record.response);

export const judgeAiLog = record => {
  const url = String(record?.url || '').toLowerCase();
  const request = getRequest(record || {});

  const isOpenAIUrl = /from_minimaxi_for_openai|chat\/completions|\/v1\/responses|\/responses$/.test(url);
  const isAnthropicUrl = /anthropic|\/v1\/messages|\/messages|from_minimaxi|from_nvidia/.test(url) && !isOpenAIUrl;
  const hasResponsesInput = Array.isArray(request.input) && request.input.some(item =>
    item?.type === 'message' || item?.type === 'function_call' || item?.type === 'function_call_output'
  );

  if (isOpenAIUrl || hasResponsesInput) return { isAiLog: true, type: 'openai' };
  if (isAnthropicUrl) return { isAiLog: true, type: 'anthropic' };

  if (Array.isArray(request.messages)) {
    const hasOpenAIToolMsg = request.messages.some(m => m.role === 'tool' || m.tool_calls);
    const hasAnthropicBlocks = request.messages.some(m => Array.isArray(m.content) && m.content.some(b => b?.type === 'tool_result' || b?.type === 'tool_use'));
    if (hasOpenAIToolMsg || request.tools?.[0]?.function) return { isAiLog: true, type: 'openai' };
    if (hasAnthropicBlocks || request.anthropic_version || request.tools?.[0]?.input_schema) return { isAiLog: true, type: 'anthropic' };
  }

  return { isAiLog: false, type: '' };
};

const overview = (record, type, request) => (
  <Descriptions bordered size="small" column={3}>
    <Descriptions.Item label="format"><Tag color={type === 'openai' ? 'blue' : 'purple'}>{type}</Tag></Descriptions.Item>
    <Descriptions.Item label="model">{request.model || '-'}</Descriptions.Item>
    <Descriptions.Item label="stream">{String(Boolean(request.stream))}</Descriptions.Item>
    <Descriptions.Item label="url" span={3}>{record.url}</Descriptions.Item>
    <Descriptions.Item label="messages">{Array.isArray(request.messages) ? request.messages.length : 0}</Descriptions.Item>
    <Descriptions.Item label="tools">{Array.isArray(request.tools) ? request.tools.length : 0}</Descriptions.Item>
    <Descriptions.Item label="max_tokens">{request.max_tokens || '-'}</Descriptions.Item>
  </Descriptions>
);

const RawCollapse = ({ request, response, tools }) => (
  <Collapse>
    <Panel header={`available tools (${tools.length})`} key="tools">
      <JsonBlock value={tools} height={240} />
    </Panel>
    <Panel header="raw request" key="request">
      <JsonBlock value={request} height={320} />
    </Panel>
    <Panel header="raw response" key="response">
      <JsonBlock value={response} height={320} />
    </Panel>
  </Collapse>
);

const CompactJson = ({ title, value }) => (
  <Collapse size="small" ghost>
    <Panel header={title} key="json">
      <JsonBlock value={value} height={150} />
    </Panel>
  </Collapse>
);

const bubbleMeta = role => {
  if (role === 'user') return {
    role: 'user',
    placement: 'end',
    avatar: <Avatar icon={<UserOutlined />} style={userAvatar} />,
    variant: 'filled',
  };
  if (role === 'tool') return {
    role: 'tool',
    placement: 'start',
    avatar: <Avatar icon={<ToolOutlined />} style={toolAvatar} />,
    variant: 'outlined',
  };
  if (role === 'system') return {
    role: 'system',
    placement: 'start',
    avatar: <Avatar style={systemAvatar}>S</Avatar>,
    variant: 'borderless',
  };
  return {
    role: 'assistant',
    placement: 'start',
    avatar: <Avatar icon={<RobotOutlined />} style={assistantAvatar} />,
    variant: 'filled',
  };
};

const TextContent = ({ children }) => {
  if (!children) return <Text type="secondary">no text content</Text>;
  return (
    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', wordBreak: 'break-word' }}>
      <XMarkdown config={{ extensions: Latex() }} components={{ code: Code }} paragraphTag="div">
        {markdownText(String(children))}
      </XMarkdown>
    </div>
  );
};

const FoldedPromptBlocks = ({ blocks }) => {
  if (!blocks || blocks.length === 0) return null;
  return (
    <Collapse size="small">
      {blocks.map((block, index) => (
        <Panel header={`${block.title} (${String(block.text || '').length} chars)`} key={`${block.title}-${index}`}>
          <TextContent>{block.text}</TextContent>
          {block.raw ? <CompactJson title="raw block" value={block.raw} /> : null}
        </Panel>
      ))}
    </Collapse>
  );
};

const openAIToolItems = toolCalls => {
  return (toolCalls || []).map((call, index) => {
    const fn = call.function || {};
    let args = fn.arguments || {};
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch (e) {}
    }
    return {
      key: call.id || `openai-tool-${index}`,
      title: `tool call: ${fn.name || call.name || 'unknown'}`,
      description: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text code>{call.id || `index:${index}`}</Text>
          <Text type="secondary">{shortText(args, 220)}</Text>
        </Space>
      ),
      status: 'success',
      content: <CompactJson title="tool call detail" value={call} />,
    };
  });
};

const anthropicToolUseItems = blocks => {
  return (blocks || []).filter(block => block?.type === 'tool_use').map((block, index) => ({
    key: block.id || `anthropic-tool-${index}`,
    title: `tool use: ${block.name || 'unknown'}`,
    description: (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text code>{block.id || `index:${index}`}</Text>
        <Text type="secondary">{shortText(block.input, 220)}</Text>
      </Space>
    ),
    status: 'success',
    content: <CompactJson title="tool use detail" value={block} />,
  }));
};

const anthropicToolResultItems = blocks => {
  return (blocks || []).filter(block => block?.type === 'tool_result').map((block, index) => ({
    key: block.tool_use_id || `anthropic-result-${index}`,
    title: `tool result: ${block.tool_use_id || 'unknown'}`,
    description: (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text code>{block.tool_use_id || `index:${index}`}</Text>
        <Text type="secondary">content folded by default</Text>
      </Space>
    ),
    status: block.is_error ? 'error' : 'success',
    content: (
      <Collapse size="small">
        <Panel header={`tool result content (${contentText(block.content).length} chars)`} key="content">
          <TextContent>{contentText(block.content)}</TextContent>
        </Panel>
        <Panel header="tool result detail" key="detail">
          <JsonBlock value={block} height={150} />
        </Panel>
      </Collapse>
    ),
  }));
};

const makeBubble = ({ key, role, header, content, footer }) => ({
  key,
  ...bubbleMeta(role),
  header,
  content,
  footer,
});

const aggregateOpenAIResponse = response => {
  if (Array.isArray(response)) {
    const result = { message: { role: 'assistant', content: '', tool_calls: [] }, usage: null, raw: response };
    const toolCalls = {};
    response.forEach(chunk => {
      if (chunk?.usage) result.usage = chunk.usage;
      (chunk?.choices || []).forEach(choice => {
        const delta = choice.delta || {};
        if (delta.role) result.message.role = delta.role;
        if (typeof delta.content === 'string') result.message.content += delta.content;
        (delta.tool_calls || []).forEach(call => {
          const index = call.index || 0;
          if (!toolCalls[index]) toolCalls[index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
          if (call.id) toolCalls[index].id = call.id;
          if (call.type) toolCalls[index].type = call.type;
          if (call.function?.name) toolCalls[index].function.name = call.function.name;
          if (call.function?.arguments) toolCalls[index].function.arguments += call.function.arguments;
        });
        result.finish_reason = choice.finish_reason || result.finish_reason;
      });
    });
    result.message.tool_calls = Object.keys(toolCalls).map(k => toolCalls[k]);
    return result;
  }
  const choice = response?.choices?.[0] || {};
  return {
    message: choice.message || choice.delta || {},
    usage: response?.usage,
    finish_reason: choice.finish_reason,
    raw: response,
  };
};

const aggregateAnthropicResponse = response => {
  if (!Array.isArray(response)) return response || {};

  const content = {};
  const result = { content: [], usage: {}, raw: response };
  response.forEach(chunk => {
    if (chunk?.type === 'message_start') {
      result.model = chunk.message?.model;
      result.usage = { ...result.usage, ...(chunk.message?.usage || {}) };
    }
    if (chunk?.type === 'content_block_start') {
      content[chunk.index || 0] = { ...(chunk.content_block || {}) };
    }
    if (chunk?.type === 'content_block_delta') {
      const block = content[chunk.index || 0] || { type: 'text', text: '' };
      if (chunk.delta?.text) block.text = `${block.text || ''}${chunk.delta.text}`;
      if (chunk.delta?.thinking) block.thinking = `${block.thinking || ''}${chunk.delta.thinking}`;
      if (chunk.delta?.partial_json) block.input = `${block.input || ''}${chunk.delta.partial_json}`;
      content[chunk.index || 0] = block;
    }
    if (chunk?.type === 'message_delta') {
      result.stop_reason = chunk.delta?.stop_reason;
      result.usage = { ...result.usage, ...(chunk.usage || {}) };
    }
  });
  result.content = Object.keys(content).sort((a, b) => a - b).map(k => {
    const block = content[k];
    if (block.type === 'tool_use' && typeof block.input === 'string') {
      try {
        return { ...block, input: JSON.parse(block.input) };
      } catch (e) {}
    }
    return block;
  });
  return result;
};

const openAIMessageBubble = (msg, index) => {
  const toolItems = openAIToolItems(msg.tool_calls);
  const isTool = msg.role === 'tool';

  // System 消息：检测是否为 agent 内置 prompt，折叠显示
  if (msg.role === 'system' || msg.role === 'developer') {
    const text = typeof msg.content === 'string' ? msg.content : contentText(msg.content);
    const isDefault = isDefaultPromptText(text);
    return makeBubble({
      key: `request-${index}`,
      role: 'system',
      header: (
        <Space>
          <Tag>{msg.role === 'developer' ? 'developer' : 'system'}</Tag>
          {isDefault ? <Tag color="default">agent prompt folded</Tag> : null}
        </Space>
      ),
      content: isDefault
        ? <FoldedPromptBlocks blocks={[{ title: defaultPromptTitle(text), text }]} />
        : <TextContent>{text}</TextContent>,
    });
  }

  return makeBubble({
    key: `request-${index}`,
    role: isTool ? 'tool' : msg.role,
    header: (
      <Space>
        <Tag>{msg.role || 'message'}</Tag>
        {msg.name ? <Text type="secondary">{msg.name}</Text> : null}
        {msg.tool_call_id ? <Text code>{msg.tool_call_id}</Text> : null}
      </Space>
    ),
    content: (
      <Space direction="vertical" style={{ width: '100%' }}>
        <TextContent>{contentText(msg.content)}</TextContent>
        {toolItems.length ? <ThoughtChain items={toolItems} collapsible={{ defaultExpandedKeys: [] }} /> : null}
        <CompactJson title="message detail" value={msg} />
      </Space>
    ),
  });
};

const anthropicMessageBubble = (msg, index) => {
  const blocks = Array.isArray(msg.content) ? msg.content : [];
  const toolUses = anthropicToolUseItems(blocks);
  const toolResults = anthropicToolResultItems(blocks);
  const { visibleText, foldedTextBlocks } = splitTextBlocks(msg.content);
  const role = toolResults.length && msg.role === 'user' ? 'tool' : msg.role;
  return makeBubble({
    key: `request-${index}`,
    role,
    header: (
      <Space>
        <Tag>{toolResults.length ? 'tool result carried in request' : msg.role || 'message'}</Tag>
        {foldedTextBlocks.length ? <Tag color="default">default prompt folded</Tag> : null}
      </Space>
    ),
    content: (
      <Space direction="vertical" style={{ width: '100%' }}>
        <TextContent>{visibleText}</TextContent>
        <FoldedPromptBlocks blocks={foldedTextBlocks} />
        {toolUses.length ? <ThoughtChain items={toolUses} collapsible={{ defaultExpandedKeys: [] }} /> : null}
        {toolResults.length ? <ThoughtChain items={toolResults} collapsible={{ defaultExpandedKeys: [] }} /> : null}
        <CompactJson title="message detail" value={msg} />
      </Space>
    ),
  });
};

const openAIResponseBubble = response => {
  const toolItems = openAIToolItems(response.message?.tool_calls);
  return makeBubble({
    key: 'response',
    role: 'assistant',
    header: (
      <Space>
        <Tag color="green">model response</Tag>
        {response.finish_reason ? <Tag>{response.finish_reason}</Tag> : null}
      </Space>
    ),
    content: (
      <Space direction="vertical" style={{ width: '100%' }}>
        {toolItems.length ? <ThoughtChain items={toolItems} collapsible={{ defaultExpandedKeys: toolItems.map(item => item.key) }} /> : null}
        <TextContent>{response.message?.content}</TextContent>
        <CompactJson title="usage" value={response.usage || {}} />
      </Space>
    ),
  });
};

const anthropicResponseBubble = response => {
  const blocks = Array.isArray(response.content) ? response.content : [];
  const toolItems = anthropicToolUseItems(blocks);
  const thinking = blocks.filter(b => b?.type === 'thinking').map(b => b.thinking || '').join('\n');
  const text = blocks.filter(b => b?.type === 'text').map(b => b.text || '').join('\n');
  return makeBubble({
    key: 'response',
    role: 'assistant',
    header: (
      <Space>
        <Tag color="green">model response</Tag>
        {response.stop_reason ? <Tag>{response.stop_reason}</Tag> : null}
      </Space>
    ),
    content: (
      <Space direction="vertical" style={{ width: '100%' }}>
        {thinking ? (
          <Collapse size="small">
            <Panel header="thinking" key="thinking">
              <TextContent>{thinking}</TextContent>
            </Panel>
          </Collapse>
        ) : null}
        {toolItems.length ? <ThoughtChain items={toolItems} collapsible={{ defaultExpandedKeys: toolItems.map(item => item.key) }} /> : null}
        <TextContent>{text}</TextContent>
        <CompactJson title="usage" value={response.usage || {}} />
      </Space>
    ),
  });
};

const ReviewShell = ({ record, type, children, request, response }) => (
  <XProvider>
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {overview(record, type, request)}
      {children}
      <RawCollapse request={request} response={response} tools={Array.isArray(request.tools) ? request.tools : []} />
    </Space>
  </XProvider>
);

export const OpenAILogReview = ({ record }) => {
  const request = getRequest(record);
  const rawResponse = getResponse(record);
  const response = aggregateOpenAIResponse(rawResponse);

  // 将连续的系统 prompt 分组为一个折叠块
  const messages = request.messages || [];
  const items = [];
  let systemAccum = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'system' || msg.role === 'developer') {
      const text = typeof msg.content === 'string' ? msg.content : contentText(msg.content);
      if (isDefaultPromptText(text)) {
        if (!systemAccum) {
          systemAccum = { blocks: [], startIndex: i };
        }
        systemAccum.blocks.push({ title: defaultPromptTitle(text), text });
        continue;
      }
    }
    // 遇到非系统 prompt 消息，先 flush 累积的 system blocks
    if (systemAccum) {
      items.push(makeBubble({
        key: `request-system-${systemAccum.startIndex}`,
        role: 'system',
        header: (
          <Space>
            <Tag>system</Tag>
            <Tag color="default">agent prompt folded</Tag>
          </Space>
        ),
        content: <FoldedPromptBlocks blocks={systemAccum.blocks} />,
      }));
      systemAccum = null;
    }
    items.push(openAIMessageBubble(msg, i));
  }

  // flush 末尾的 system 分组
  if (systemAccum) {
    items.push(makeBubble({
      key: `request-system-${systemAccum.startIndex}`,
      role: 'system',
      header: (
        <Space>
          <Tag>system</Tag>
          <Tag color="default">agent prompt folded</Tag>
        </Space>
      ),
      content: <FoldedPromptBlocks blocks={systemAccum.blocks} />,
    }));
  }

  items.push(openAIResponseBubble(response));

  return (
    <ReviewShell record={record} type="openai" request={request} response={rawResponse}>
      <Bubble.List items={items} roles={{ user: { placement: 'end' }, assistant: { placement: 'start' }, tool: { placement: 'start' }, system: { placement: 'start' } }} />
    </ReviewShell>
  );
};

export const AnthropicLogReview = ({ record }) => {
  const request = getRequest(record);
  const rawResponse = getResponse(record);
  const response = aggregateAnthropicResponse(rawResponse);
  const systemText = typeof request.system === 'string' ? request.system : JSON.stringify(request.system || '');
  const items = [
    ...(request.system ? [makeBubble({
      key: 'system',
      role: 'system',
      header: (
        <Space>
          <Tag>system</Tag>
          {isDefaultPromptText(systemText) ? <Tag color="default">default prompt folded</Tag> : null}
        </Space>
      ),
      content: isDefaultPromptText(systemText)
        ? <FoldedPromptBlocks blocks={[{ title: defaultPromptTitle(systemText), text: systemText }]} />
        : <TextContent>{systemText}</TextContent>,
    })] : []),
    ...(request.messages || []).map(anthropicMessageBubble),
    anthropicResponseBubble(response),
  ];

  return (
    <ReviewShell record={record} type="anthropic" request={request} response={rawResponse}>
      <Bubble.List items={items} roles={{ user: { placement: 'end' }, assistant: { placement: 'start' }, tool: { placement: 'start' }, system: { placement: 'start' } }} />
    </ReviewShell>
  );
};

const AiLogReview = ({ record }) => {
  const result = judgeAiLog(record);
  if (!result.isAiLog) {
    return <Empty description="Not an AI API log" />;
  }
  if (result.type === 'openai') {
    return <OpenAILogReview record={record} />;
  }
  return <AnthropicLogReview record={record} />;
};

export default AiLogReview;
