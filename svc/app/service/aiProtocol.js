const Service = require('egg').Service;

/**
 * 与 Chat Completions / Messages / Responses 三种协议绑定的适配层。
 * aiStream 只负责协议无关的流式转发；这里根据客户端协议处理 stream 参数：
 *   - stream: true  -> 直接交给 aiStream 透传 SSE
 *   - 其他（含缺省） -> 仍复用 aiStream 拿到 SSE，再按协议聚合成一次性 JSON 响应
 */
class AiProtocolService extends Service {

	async handle() {
		const protocol = detectProtocol(this.ctx.path);
		const body = this.ctx.request.body || {};
		// 三种协议的 stream 都是请求体顶层布尔字段，缺省为 false
		if (!protocol || body.stream === true) {
			await this.service.aiStream.stream();
			return;
		}

		if (protocol === 'chat' && !body.stream_options) {
			// 上游实际走流式，需要显式要求在最后一个 chunk 返回 usage
			body.stream_options = { include_usage: true };
		}
		await this.service.aiStream.stream();

		const sse = this.ctx.body;
		// aiStream 在实体查找 / 模板解析 / 上游连接失败时直接返回错误 JSON
		if (!sse || typeof sse.pipe !== 'function') return;

		const chunks = [];
		try {
			for await (const chunk of sse) {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			}
		} catch (e) {
			this.ctx.logger.error('[aiProtocol] read upstream stream error', e);
			this.reply(502, { error: 'Upstream stream failed', detail: e.message });
			return;
		}

		const { events, others } = parseSse(Buffer.concat(chunks).toString('utf8'));
		if (events.length === 0) {
			// 上游返回非 2xx 时，aiStream 会把非 SSE 的错误体按行原样写出
			const raw = others.join('\n');
			this.reply(502, parseJsonOr(raw, null) || { error: 'Empty upstream response', detail: raw.slice(0, 2000) });
			return;
		}

		const errorEvent = events.find(ev => ev.type === 'error' || (ev.error && !ev.type && !ev.choices));
		if (errorEvent) {
			this.reply(502, toErrorBody(protocol, errorEvent));
			return;
		}

		this.reply(200, AGGREGATORS[protocol](events));
	}

	reply(status, body) {
		const { ctx } = this;
		// 清掉 aiStream 设置的 SSE 响应头
		ctx.remove('Cache-Control');
		ctx.remove('Connection');
		ctx.remove('X-Accel-Buffering');
		ctx.status = status;
		ctx.type = 'application/json';
		ctx.body = body;
	}
}

const PROTOCOL_PATHS = [
	['chat', /\/chat\/completions\/?$/],
	['messages', /\/messages\/?$/],
	['responses', /\/responses\/?$/],
];

function detectProtocol(path) {
	const hit = PROTOCOL_PATHS.find(([, re]) => re.test(path || ''));
	return hit ? hit[0] : null;
}

function parseSse(raw) {
	const events = [];
	const others = [];
	for (const line of raw.split(/\r?\n/)) {
		const text = line.trim();
		if (!text || text.startsWith('event:') || text.startsWith(':')) continue;
		if (!text.startsWith('data:')) {
			others.push(text);
			continue;
		}
		const data = text.slice(5).trim();
		if (!data || data === '[DONE]') continue;
		const parsed = parseJsonOr(data, null);
		if (parsed && typeof parsed === 'object') {
			events.push(parsed);
		} else {
			others.push(text);
		}
	}
	return { events, others };
}

function parseJsonOr(text, fallback) {
	try {
		return JSON.parse(text);
	} catch (e) {
		return fallback;
	}
}

function toErrorBody(protocol, ev) {
	if (protocol === 'messages') {
		return ev.type === 'error' ? ev : { type: 'error', error: ev.error };
	}
	if (ev.error) return { error: ev.error };
	// Responses 流里的 error 事件：{ type: 'error', code, message, param }
	return { error: { type: 'upstream_error', code: ev.code, message: ev.message, param: ev.param } };
}

const sortByIndex = map => Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

/**
 * chat.completion.chunk[] -> chat.completion
 */
function aggregateChat(events) {
	const result = {
		id: '',
		object: 'chat.completion',
		created: Math.floor(Date.now() / 1000),
		model: '',
		choices: [],
	};
	const choices = new Map();

	for (const ev of events) {
		if (ev.id) result.id = ev.id;
		if (ev.model) result.model = ev.model;
		if (typeof ev.created === 'number') result.created = ev.created;
		if (ev.system_fingerprint) result.system_fingerprint = ev.system_fingerprint;
		if (ev.usage) result.usage = ev.usage;

		for (const ch of ev.choices || []) {
			const index = ch.index || 0;
			let choice = choices.get(index);
			if (!choice) {
				choice = { index, message: { role: 'assistant', content: '' }, finish_reason: null, toolCalls: new Map() };
				choices.set(index, choice);
			}
			const delta = ch.delta || {};
			if (delta.role) choice.message.role = delta.role;
			if (typeof delta.content === 'string') choice.message.content += delta.content;
			if (typeof delta.reasoning_content === 'string') {
				choice.message.reasoning_content = (choice.message.reasoning_content || '') + delta.reasoning_content;
			}
			for (const tc of delta.tool_calls || []) {
				const tcIndex = tc.index || 0;
				const call = choice.toolCalls.get(tcIndex) || { id: '', type: 'function', function: { name: '', arguments: '' } };
				if (tc.id) call.id = tc.id;
				if (tc.type) call.type = tc.type;
				if (tc.function && tc.function.name) call.function.name = tc.function.name;
				if (tc.function && typeof tc.function.arguments === 'string') call.function.arguments += tc.function.arguments;
				choice.toolCalls.set(tcIndex, call);
			}
			if (ch.finish_reason) choice.finish_reason = ch.finish_reason;
		}
	}

	result.choices = sortByIndex(choices).map(({ toolCalls, ...choice }) => {
		if (toolCalls.size > 0) {
			choice.message.tool_calls = sortByIndex(toolCalls);
			if (!choice.message.content) choice.message.content = null;
		}
		return { ...choice, logprobs: null };
	});
	return result;
}

/**
 * Anthropic message 事件流 -> message
 */
function aggregateMessages(events) {
	let message = {
		id: '',
		type: 'message',
		role: 'assistant',
		model: '',
		content: [],
		stop_reason: null,
		stop_sequence: null,
		usage: {},
	};
	const blocks = new Map();
	const inputJson = new Map();

	for (const ev of events) {
		if (ev.type === 'message_start' && ev.message) {
			message = { ...message, ...ev.message, content: [] };
		} else if (ev.type === 'content_block_start') {
			blocks.set(ev.index || 0, { ...ev.content_block });
		} else if (ev.type === 'content_block_delta') {
			const index = ev.index || 0;
			const block = blocks.get(index) || { type: 'text', text: '' };
			const delta = ev.delta || {};
			if (delta.type === 'text_delta') {
				block.text = (block.text || '') + (delta.text || '');
			} else if (delta.type === 'thinking_delta') {
				block.thinking = (block.thinking || '') + (delta.thinking || '');
			} else if (delta.type === 'signature_delta') {
				block.signature = delta.signature;
			} else if (delta.type === 'input_json_delta') {
				inputJson.set(index, (inputJson.get(index) || '') + (delta.partial_json || ''));
			} else if (delta.type === 'citations_delta') {
				block.citations = [...(block.citations || []), delta.citation];
			}
			blocks.set(index, block);
		} else if (ev.type === 'message_delta') {
			if (ev.delta) Object.assign(message, ev.delta);
			if (ev.usage) message.usage = { ...message.usage, ...ev.usage };
		}
	}

	for (const [index, json] of inputJson) {
		if (json) blocks.get(index).input = parseJsonOr(json, { raw: json });
	}
	message.content = sortByIndex(blocks);
	return message;
}

/**
 * Responses 事件流 -> response。
 * 优先使用 response.completed 等事件携带的完整 response；output 为空时用逐项事件重建。
 */
function aggregateResponses(events) {
	let response = null;
	const items = new Map();
	const itemAt = ev => {
		const index = ev.output_index || 0;
		if (!items.has(index)) items.set(index, { type: 'message', role: 'assistant', content: [] });
		return items.get(index);
	};

	for (const ev of events) {
		if (ev.response && typeof ev.response === 'object') response = ev.response;

		if (ev.type === 'response.output_item.added' || ev.type === 'response.output_item.done') {
			if (ev.item) items.set(ev.output_index || 0, { ...ev.item });
		} else if (ev.type === 'response.output_text.delta') {
			const item = itemAt(ev);
			if (!Array.isArray(item.content)) item.content = [];
			const contentIndex = ev.content_index || 0;
			const part = item.content[contentIndex] || { type: 'output_text', text: '', annotations: [] };
			part.text = (part.text || '') + (ev.delta || '');
			item.content[contentIndex] = part;
		} else if (ev.type === 'response.function_call_arguments.delta') {
			const item = itemAt(ev);
			item.arguments = (item.arguments || '') + (ev.delta || '');
		}
	}

	if (response && Array.isArray(response.output) && response.output.length > 0) {
		return response;
	}
	return {
		id: '',
		object: 'response',
		created_at: Math.floor(Date.now() / 1000),
		status: 'completed',
		model: '',
		...response,
		output: sortByIndex(items),
	};
}

const AGGREGATORS = {
	chat: aggregateChat,
	messages: aggregateMessages,
	responses: aggregateResponses,
};

module.exports = AiProtocolService;
