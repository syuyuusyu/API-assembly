const Service = require('egg').Service;
const { PassThrough } = require('stream');

class AiStreamService extends Service {

	async stream() {
		const { invokeName, activeMethod } = this.ctx.params;
		const queryMap = this.ctx.request.body;
		console.log('activeMethod', activeMethod);

		// 查找 invokeName 对应的 Callable API（含 parseFun，用于处理每个 SSE chunk）
		const keyMap = await this.ctx.service.redis.get('invokeEntityKeyMap');
		const callerEntity = await this.ctx.service.redis.hget('invokeEntitys', keyMap[invokeName]);
		if (!callerEntity || !callerEntity.next) {
			this.ctx.status = 404;
			this.ctx.body = { error: `${invokeName} not found or has no relevant requests` };
			return;
		}

		// 从 next 中找到 activeMethod 对应的 API Configuration（含上游 URL/head/body）
		const nextEntityList = await this.ctx.service.redis.hmget('invokeEntitys', callerEntity.next.split(','));
		const targetEntity = nextEntityList.filter(e => e).find(e => e.name === activeMethod);
		if (!targetEntity) {
			this.ctx.status = 404;
			this.ctx.body = { error: `${activeMethod} not found in ${invokeName}` };
			return;
		}

		// 解析 URL / head / body 模板中的 @xxx 占位符
		const params = { ...queryMap };
		if (targetEntity.systemId) {
			const sysInfo = this.app.config.systemInfo.find(s => s.systemId == targetEntity.systemId);
			if (sysInfo) params.baseUrl = sysInfo.url;
		}
		const url = this.service.restful.parseByqueryMap(targetEntity.url, params);
		const method = targetEntity.method.toUpperCase();

		let requestBody, requestHead;
		try {
            // console.log(targetEntity.body)
            // console.log(params)
            if(targetEntity.body.trim()=='{}'){
                requestBody = params;
            }else{
                requestBody = JSON.parse(this.service.restful.parseByqueryMap(targetEntity.body, params));
            }
			requestHead = JSON.parse(this.service.restful.parseByqueryMap(targetEntity.head, params));
			// console.log(url);
			// console.log(requestHead);
			//this.ctx.logger.info(requestBody);
		} catch (e) {
			this.ctx.status = 500;
			this.ctx.body = { error: 'Failed to parse entity config', detail: e.message };
			return;
		}

		// 协议归一化：清理 MiniMax 不支持的 Anthropic 专有字段
		// system 数组 -> 字符串
		if (Array.isArray(requestBody.system)) {
			requestBody.system = requestBody.system
				.filter(b => b && b.type === 'text')
				.map(b => b.text || '')
				.join('\n');
		}
		// output_config 是 Anthropic 专有的结构化输出字段，MiniMax 不支持
		delete requestBody.output_config;
		// baseUrl 是 gateway 内部字段，不应发送给上游
		delete requestBody.baseUrl;
		// stream 路由始终要求上游开启流式输出，模板不需要显式配置 stream 字段
		requestBody.stream = true;

		// 向上游发起流式请求
		this.ctx.logger.info('[aiStream] requestBody: %j', requestBody);
		let upstreamRes, upstreamStatus;
		try {
			const { res, status } = await this.app.curl(url, {
				method,
				data: JSON.stringify(requestBody),
				headers: { 'Content-Type': 'application/json', ...requestHead },
				streaming: true,
				timeout: [30000, 600000],
			});
			upstreamRes = res;
			upstreamStatus = status;
			this.ctx.logger.info('[aiStream] upstream status: %d', upstreamStatus);
		} catch (e) {
			this.ctx.logger.error('stream upstream error', e);
			this.ctx.status = 502;
			this.ctx.body = { error: 'Upstream request failed', detail: e.message };
			return;
		}

		// 设置 SSE 响应头
		this.ctx.set('Content-Type', 'text/event-stream');
		this.ctx.set('Cache-Control', 'no-cache');
		this.ctx.set('Connection', 'keep-alive');
		this.ctx.set('X-Accel-Buffering', 'no');
		this.ctx.status = 200;
		const passThrough = new PassThrough();
		this.ctx.body = passThrough;

		// 无 parseFun 且不记日志：原样透传上游 SSE 流
		if (!targetEntity.parseFun && targetEntity.enableLog !== '1') {
			upstreamRes.pipe(passThrough);
			upstreamRes.on('error', err => passThrough.destroy(err));
			return;
		}

		// 有 parseFun 或需要记日志：逐行处理
		let fn = null;
		if (targetEntity.parseFun) {
			try {
				fn = evil(targetEntity.parseFun);
			} catch (e) {
				this.ctx.logger.error('parseFun compile error', e);
				upstreamRes.pipe(passThrough);
				return;
			}
		}

		const logChunks = [];
		let buffer = '';
		upstreamRes.on('data', (chunk) => {
			const raw = chunk.toString();
			this.ctx.logger.info('[aiStream] raw chunk: %s', raw.slice(0, 500));
			buffer += raw;
			const lines = buffer.split('\n');
			buffer = lines.pop(); // 末尾可能是不完整的行，留到下次处理

			for (const line of lines) {
				//console.log(line);
				if (!line.startsWith('data: ')) {
					if (line.trim()) passThrough.write(line + '\n');
					continue;
				}
				const dataStr = line.slice(6).trim();
				if (dataStr === '[DONE]') {
					passThrough.write('data: [DONE]\n\n');
					continue;
				}
				try {
					const parsed = JSON.parse(dataStr);
					if (targetEntity.enableLog === '1') logChunks.push(parsed);
					if (fn) {
						const transformed = fn(parsed, {}, 200, requestHead, requestBody, url);
						if (transformed != null) {
							passThrough.write(`data: ${JSON.stringify(transformed)}\n\n`);
						}
					} else {
						passThrough.write(line + '\n');
					}
				} catch (e) {
					this.ctx.logger.error('parseFun execution error', e);
					passThrough.write(line + '\n');
				}
			}
		});

		upstreamRes.on('end', () => {
			// flush 残留在 buffer 中的最后一行（无尾部换行符的情况）
			if (buffer.trim()) {
				const tail = buffer.trim();
				this.ctx.logger.info('[aiStream] buffer tail on end: %s', tail.slice(0, 200));
				if (tail.startsWith('data: [DONE]')) {
					passThrough.write('data: [DONE]\n\n');
				} else if (tail.startsWith('data: ')) {
					try {
						const parsed = JSON.parse(tail.slice(6));
						if (targetEntity.enableLog === '1') logChunks.push(parsed);
						if (fn) {
							const transformed = fn(parsed, {}, 200, requestHead, requestBody, url);
							if (transformed != null) passThrough.write(`data: ${JSON.stringify(transformed)}\n\n`);
						} else {
							passThrough.write(tail + '\n\n');
						}
					} catch (e) {
						passThrough.write(tail + '\n');
					}
				} else {
					passThrough.write(tail + '\n');
				}
			}
			console.log(logChunks.length);
			console.log(targetEntity.enableLog);
			if (targetEntity.enableLog == '1') {
                let mergedResponse = {};
                try {
                    mergedResponse = parseStreamLogChunks(invokeName, logChunks);
                }catch (e) {
                    this.ctx.logger.error('parseStreamLogChunks error', e);
                    mergedResponse = { error: 'Failed to parse log chunks', detail: e.message };
                    this.ctx.logger.error('parseStreamLogChunks error', e);
                    this.ctx.logger.error(logChunks);
                }
				
				this.app.mysql.insert('invoke_log', {
					key: requestHead.logKey,
					name: targetEntity.name,
					groupName: targetEntity.groupName,
					code: 200,
					request: JSON.stringify(requestBody),
					response: JSON.stringify(mergedResponse),
					date: this.app.mysql.literals.now,
					descrption: targetEntity.descrption,
					url: url,
					method: method,
					head: JSON.stringify(requestHead),
				}).catch(e => this.ctx.logger.error('[aiStream] invoke_log insert error', e));
			}
			passThrough.end();
		});

		upstreamRes.on('error', err => {
			this.ctx.logger.error('upstream stream error', err);
			passThrough.destroy(err);
		});
	}

}

function evil(fn) {
	fn.replace(/(\s?function\s?)(\w?)(\s?\(w+\)[\s|\S]*)/g, function (w, p1, p2, p3) {
		return p1 + p3;
	});

	let Fn = Function;
	return new Fn('return ' + fn)();
}

function parseStreamLogChunks(invokeName, logChunks) {
	if (!Array.isArray(logChunks) || logChunks.length === 0) {
		return {};
	}
	if (invokeName === 'anthropic') {
		return parseAnthropicChunks(logChunks);
	}
	return parseOpenAIChunks(logChunks);
}

function parseAnthropicChunks(chunks) {
	const result = {
		id: '',
		type: 'message',
		role: 'assistant',
		model: '',
		content: [],
		stop_reason: null,
		stop_sequence: null,
		usage: {},
	};

	const contentBlocks = new Map();

	for (const chunk of chunks) {
		if (!chunk || typeof chunk !== 'object') continue;

		if (chunk.type === 'message_start' && chunk.message) {
			result.id = chunk.message.id || result.id;
			result.type = chunk.message.type || result.type;
			result.role = chunk.message.role || result.role;
			result.model = chunk.message.model || result.model;
			if (chunk.message.usage && typeof chunk.message.usage === 'object') {
				result.usage = { ...result.usage, ...chunk.message.usage };
			}
		}

		if (chunk.type === 'content_block_start') {
			const idx = Number(chunk.index || 0);
			const block = chunk.content_block || {};
			if (block.type === 'tool_use') {
				contentBlocks.set(idx, {
					type: 'tool_use',
					id: block.id || '',
					name: block.name || '',
					input: block.input && typeof block.input === 'object' ? { ...block.input } : {},
					_inputJsonBuffer: '',
				});
			} else {
				contentBlocks.set(idx, {
					type: block.type || 'text',
					text: block.text || '',
					_thinking: '',
				});
			}
		}

		if (chunk.type === 'content_block_delta') {
			const idx = Number(chunk.index || 0);
			const block = contentBlocks.get(idx) || { type: 'text', text: '' };
			const delta = chunk.delta || {};

			if (delta.type === 'text_delta') {
				block.text = (block.text || '') + (delta.text || '');
			} else if (delta.type === 'thinking_delta') {
				block._thinking = (block._thinking || '') + (delta.thinking || '');
			} else if (delta.type === 'input_json_delta') {
				block._inputJsonBuffer = (block._inputJsonBuffer || '') + (delta.partial_json || '');
			}
			contentBlocks.set(idx, block);
		}

		if (chunk.type === 'message_delta') {
			if (chunk.delta && typeof chunk.delta === 'object') {
				if (Object.prototype.hasOwnProperty.call(chunk.delta, 'stop_reason')) {
					result.stop_reason = chunk.delta.stop_reason;
				}
				if (Object.prototype.hasOwnProperty.call(chunk.delta, 'stop_sequence')) {
					result.stop_sequence = chunk.delta.stop_sequence;
				}
			}
			if (chunk.usage && typeof chunk.usage === 'object') {
				result.usage = { ...result.usage, ...chunk.usage };
			}
		}
	}

	const orderedBlocks = Array.from(contentBlocks.entries())
		.sort((a, b) => a[0] - b[0])
		.map(([, block]) => {
			const cloned = { ...block };
			if (cloned.type === 'tool_use' && cloned._inputJsonBuffer) {
				try {
					cloned.input = JSON.parse(cloned._inputJsonBuffer);
				} catch (e) {
					cloned.input = { raw: cloned._inputJsonBuffer };
				}
			}
			delete cloned._inputJsonBuffer;
			delete cloned._thinking;
			return cloned;
		});

	result.content = orderedBlocks;
	return result;
}

function parseOpenAIChunks(chunks) {
	const base = {
		id: '',
		object: 'chat.completion',
		created: Math.floor(Date.now() / 1000),
		model: '',
		choices: [],
		usage: undefined,
	};

	const choicesMap = new Map();

	for (const chunk of chunks) {
		if (!chunk || typeof chunk !== 'object') continue;
		if (chunk.id) base.id = chunk.id;
		if (chunk.model) base.model = chunk.model;
		if (typeof chunk.created === 'number') base.created = chunk.created;
		if (chunk.usage && typeof chunk.usage === 'object') base.usage = chunk.usage;

		const chunkChoices = Array.isArray(chunk.choices) ? chunk.choices : [];
		for (const ch of chunkChoices) {
			const idx = Number(ch.index || 0);
			let agg = choicesMap.get(idx);
			if (!agg) {
				agg = {
					index: idx,
					message: {
						role: 'assistant',
						content: '',
					},
					finish_reason: null,
					_toolCalls: new Map(),
				};
				choicesMap.set(idx, agg);
			}

			const delta = ch.delta || {};
			if (delta.role) {
				agg.message.role = delta.role;
			}
			if (typeof delta.content === 'string') {
				agg.message.content += delta.content;
			}
			if (Array.isArray(delta.tool_calls)) {
				for (const tc of delta.tool_calls) {
					const toolIdx = Number(tc.index || 0);
					let toolAgg = agg._toolCalls.get(toolIdx);
					if (!toolAgg) {
						toolAgg = {
							id: tc.id || '',
							type: tc.type || 'function',
							function: {
								name: '',
								arguments: '',
							},
						};
						agg._toolCalls.set(toolIdx, toolAgg);
					}

					if (tc.id) toolAgg.id = tc.id;
					if (tc.type) toolAgg.type = tc.type;
					if (tc.function && tc.function.name) {
						toolAgg.function.name = tc.function.name;
					}
					if (tc.function && typeof tc.function.arguments === 'string') {
						toolAgg.function.arguments += tc.function.arguments;
					}
				}
			}

			if (Object.prototype.hasOwnProperty.call(ch, 'finish_reason')) {
				agg.finish_reason = ch.finish_reason;
			}
		}
	}

	base.choices = Array.from(choicesMap.values())
		.sort((a, b) => a.index - b.index)
		.map((choice) => {
			const toolCalls = Array.from(choice._toolCalls.entries())
				.sort((a, b) => a[0] - b[0])
				.map(([, item]) => item);
			if (toolCalls.length > 0) {
				choice.message.tool_calls = toolCalls;
			}
			delete choice._toolCalls;
			return choice;
		});

	return base;
}

module.exports = AiStreamService;
