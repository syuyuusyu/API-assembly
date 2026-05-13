import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import { useAsync, useToggle } from 'react-use'
import {
  UserOutlined,SaveOutlined,EditOutlined,DeleteOutlined,LinkOutlined,MoreOutlined,RedoOutlined,PlusOutlined,CopyOutlined,DownOutlined,
} from '@ant-design/icons'

import {Flex,App,Spin,Layout,Modal, Form,Row,Col,Button,Input,Select,Space,
  Dropdown,Typography,theme,Switch,Divider,Upload,Image,Avatar,Card,
} from 'antd'
import { Bubble, Sender, Conversations, ThoughtChain,CodeHighlighter,Think,FileCard } from '@ant-design/x'

import { QwenIcon } from '../icon.jsx'
const { Sider, Content, Footer } = Layout

const { TextArea } = Input
const FormItem = Form.Item
const { confirm } = Modal

import XMarkdown from '@ant-design/x-markdown'
import Latex from '@ant-design/x-markdown/plugins/Latex'

import { fetchEventSource } from '@microsoft/fetch-event-source';

import { get, post, del } from '../util'

import config from '../api'
const {mcpUrl,buzzUrl} = config

const Code = props => {
  var _a;
  const { className, children } = props;
  const lang =
    ((_a =
      className === null || className === void 0 ? void 0 : className.match(/language-(\w+)/)) ===
      null || _a === void 0
      ? void 0
      : _a[1]) || '';
  if (typeof children !== 'string') return null;
  return <CodeHighlighter lang={lang}>{children}</CodeHighlighter>;
};


const fooAvatar = {
  color: '#f56a00',
  backgroundColor: '#fde3cf',
}
const barAvatar = {
  color: '#fff',
  backgroundColor: '#87d068',
}

const siderStyle = {
  overflow: 'auto',
  height: '100vh',
  position: 'sticky',
  insetInlineStart: 0,
  top: 0,
  bottom: 0,
  scrollbarWidth: 'thin',
  scrollbarGutter: 'stable',
}

const renderMarkdown = r => {
  if (!r) return null
  if (React.isValidElement(r)) return r
  if (typeof r === 'string') {
    return (
      <XMarkdown config={{ extensions: Latex() }} paragraphTag="div">
        {r}
      </XMarkdown>
    )
  }
  return (
    <Typography>
      {r.urls && r.urls.length > 0
        ? r.urls.map((url, index) => (
            <div key={index} style={{ marginBottom: 8 }}>
              <Image src={url} alt={`image-${index}`} style={{ borderRadius: 6 }} width={128} height={128} />
            </div>
          ))
        : null}
      {React.isValidElement(r.content) ? r.content : (
        <XMarkdown config={{ extensions: Latex() }} paragraphTag="div">
          {r.content}
        </XMarkdown>
      )}
    </Typography>
  )
}

const conversationsMap = topic => {
  return {
    key: topic.id,
    label: topic.topic,
  }
}

const modelMap = model => {
  return {
    key: model.model,
    label: model.model,
  }
}

const setUpMessage = msgList => {
    const result = [];
    let currentItem = null;
    msgList.forEach((item) => {
        if (item.type === 'human') {
            if (currentItem) {
                result.push(currentItem);
            }
            currentItem = {
                role: 'user',
                id: item.id,
                question: item.content,
                steps: [],
                response: null,
                timestamp: null
            };
        } else if (item.type === 'ai') {
            if(Array.isArray(item.content)){
              if(item.content.length === 0){
                item.content = ''
              }
              if(item.content.length > 0 && item.content[0].text){
                item.content = item.content[0].text
              }
            }
            if (item.tool_calls && item.tool_calls.length > 0) {
              if (currentItem) {
                  currentItem.steps.push({
                      type: 'process',
                      content: item.content,
                      tool_calls: item.tool_calls,
                      message_id: item.id,
                      thinking: item.additional_kwargs?.reasoning_content || '',
                  });
                }
            } else if(item.invalid_tool_calls && item.invalid_tool_calls.length > 0){
              if (currentItem) {
                  currentItem.steps.push({
                      type: 'process',
                      content: item.content,
                      message_id: item.id,
                      thinking: item.additional_kwargs?.reasoning_content || '',
                      invalid_tool_calls: item.invalid_tool_calls || []
                  });
                  
                }
            }else {
                if (currentItem) {
                    currentItem.response = item.content;
                    currentItem.thinking = item.additional_kwargs?.reasoning_content || '';
                }
            }
        } else if (item.type === 'tool') {
            if (currentItem) {
                currentItem.steps.push({
                    type: 'tool_result',
                    content: item.content,
                    tool_call_id: item.tool_call_id,
                    name: item.name,
                    status: item.status
                });
            }
        }
    });
    if (currentItem) {
        result.push(currentItem);
    }
    return result;
}

const ThoughtChianItem = ({ id,suffix, title,name,arges,status,content,thinking }) => {
  const isJson = txt =>{
    try{
      JSON.parse(txt)
      return true
    }catch(e){
      return false
    }
  }
  const parseContent = txt => {
    if(!txt) return null
    if(/```|^\s*[-*]\s|^\s*\d+\.\s|^\s*#{1,6}\s|^\s*>|^\s*\|/m.test(txt)){
      return  <div style={{
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
      }}>
        <div style={{
            maxWidth: '100%',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            // Ensure container doesn't force width beyond parent
            minWidth: 0
        }}>
          <XMarkdown components={{ code: Code }} paragraphTag="div">
            {txt}
          </XMarkdown>
        </div>
      </div>
    }
    if(isJson(txt)){
      return <div style={{
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
      }}>
        <div style={{
            maxWidth: '100%',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            // Ensure container doesn't force width beyond parent
            minWidth: 0
        }}>
          <XMarkdown components={{ code: Code }} paragraphTag="div">
            {`\`\`\`json\n${JSON.stringify(JSON.parse(txt),null,1)}\n\`\`\``}
          </XMarkdown>
        </div>
      </div>
    }
    return <div style={{ width: '100%', maxWidth: 'calc(100vw - 500px)', overflowX: 'auto' }}>
          <XMarkdown components={{ code: Code }} paragraphTag="div">
            {`\`\`\`text\n${txt}\n\`\`\``}
          </XMarkdown>
      </div>
  }
  const parseTitle = txt =>{
    if(/```|^\s*[-*]\s|^\s*\d+\.\s|^\s*#{1,6}\s|^\s*>|^\s*\|/m.test(txt)){
      return  <XMarkdown components={{ code: Code }} paragraphTag="div">
        {txt}
        </XMarkdown>
    }
    return txt
  }
  return {
    key: id + suffix,
    title: parseTitle(title),
    description: (
      <Space orientation="vertical" style={{ width: '100%', overflow: 'hidden' }}>
        {
          thinking && (
            <Think defaultExpanded={false}>{thinking}</Think>
          )
        }
        <Typography.Text type="success" code style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>
          tool call: {name}
        </Typography.Text>
        {arges && Object.keys(arges).length > 0 && (
          <Typography.Text type="secondary" code style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>
            call args:{JSON.stringify(arges)}
          </Typography.Text>
        )}
      </Space>
    ),
    status: status,
    content: parseContent(content) 
  }
}

const chatRecordsMap = (record,token) => {
  if(!record.response && record.steps && record.steps.length > 0 && record.steps[0].invalid_tool_calls && record.steps[0].invalid_tool_calls.length > 0){
    //方法调用失败的特殊展示
    const call = record.steps[0]
    const tool_call = call.invalid_tool_calls[0]
    const items = [
      ThoughtChianItem({
        id: call.message_id,
        suffix: "-invalid",
        title: call.content,
        name: tool_call.name,
        arges: tool_call.args,
        status: "error",
        thinking: call.thinking
      })
    ]
    const userItem = {
      key: record.id + '-user',
      placement: 'end',
      content: record.question,
      avatar: <Avatar icon={<UserOutlined />} style={barAvatar} />,
      urls: record.imgUrl ? record.imgUrl.split(',') : [],
    }        
    const aiItem = {
      key: record.id + '-ai',
      placement: 'start',
      avatar: <Avatar icon={<QwenIcon />} style={fooAvatar} />,
      content: <div>
        <ThoughtChain items={items} style={{marginBottom: 12}} />
        <Typography.Text type="danger">Tool call failed!!</Typography.Text>
      </div>
    }
    return [userItem, aiItem]
  }else if(!record.response && record.steps.length==0){
    return [
      {
        key: record.id + '-user',
        placement: 'end',
        content: record.question,
        avatar: <Avatar icon={<UserOutlined />} style={barAvatar} />,
        urls: record.imgUrl ? record.imgUrl.split(',') : [],
      }   
    ] 
  }


  const userItem =  {
      key: record.id + '-user',
      placement: 'end',
      content: record.question,
      avatar: <Avatar icon={<UserOutlined />} style={barAvatar} />,
      urls: record.imgUrl ? record.imgUrl.split(',') : [],
    }
  if(record.question.map){
    const text = record.question.find(c => c.text)?.text
    const urls = record.question.filter(c => c.image).map(c =>{
      const suffix = c.image.split('.').slice(-1)[0]
      return {
        url: c.image, 
        suffix: suffix,
      }
    })
    userItem.content = <div>
      <Flex gap={8} wrap="wrap">
        {(urls.map((url, index) => (
          <FileCard
            key={`${index}`}
            src={url.url}
            name={`${index}.${url.suffix}`}
          />
        )))}
      </Flex>
      <span>{text}</span>
    </div>
  }
  let items = []
  if(record.steps && record.steps.length > 0){
    const callIds = new Set()
    record.steps.filter(_=> _.tool_calls && _.tool_calls.length > 0).forEach(step => {
      step.tool_calls.forEach(call => {
        callIds.add(call.id)
      })
    })
    callIds.forEach(callid => {
      const call = record.steps.find(step => step.type === 'process' && step.tool_calls.map(c=>c.id).includes(callid))
      const callTool = call.tool_calls.find(c=>c.id === callid)
      const callResult = record.steps.find(step => step.type === 'tool_result' && step.tool_call_id === callid)
      
      items.push(ThoughtChianItem({
        id: call.message_id,
        suffix: "-tool",
        title:call.content,
        name: callTool.name,
        arges: callTool.args,
        status: callResult ? callResult.status : 'loading',
        content: callResult ? callResult.content : null,
        thinking: call.thinking
      }))
    })
  }
  const aiItem = {
      key: record.id + '-ai',
      placement: 'start',
      avatar: <Avatar icon={<QwenIcon />} style={fooAvatar} />,
      content: <div>
        {items.length > 0 && <ThoughtChain items={items} style={{marginBottom: 12}} />}
        {record.thinking && (
          <Think defaultExpanded={false}>{record.thinking}</Think>
        )}
        {
          record.response ? 
          <XMarkdown config={{ extensions: Latex() }} components={{ code: Code }}  paragraphTag="div">{record.response}</XMarkdown>
          :
          <Typography.Text type="danger">No response available</Typography.Text>
        }
        </div>
  }
  return [userItem,aiItem]
}

function TopicForm({ record, closeFun = {}, onSaved }) {
  const { message } = App.useApp()
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({
      topic: record.topic,
      prompt: record.prompt,
    })
  }, [])

  const reset = () => {
    form.resetFields()
  }

  const save = () => {
    //let a =await form.validateFields()
    form
      .validateFields()
      .then(async values => {
        if (record.id) {
          values.id = record.id
        }

        let json = await post(`${buzzUrl}/ai/topic/save`, values)
        if (json.success) {
          message.info('save success')
          if (onSaved && json.data) {
            try {
              onSaved(json.data)
            } catch {}
          }
          closeFun.reload()
          closeFun.close()
        } else {
          message.error('error occure on service side, save faile')
          closeFun.close()
        }
      })
      .catch(e => {
        console.log(e)
        message.error('invalied input')
      })
  }

  return (
    <Form form={form} layout="vertical">
      <Row gutter={24}>
        <Col span={24}>
          <FormItem label="topic" name="topic" rules={[{ required: true, message: 'required!!' }]}>
            <Input placeholder="" />
          </FormItem>
        </Col>
      </Row>
      <Row gutter={24}>
        <Col span={24}>
          <FormItem label="prompt" name="prompt">
            <TextArea rows={4} />
          </FormItem>
        </Col>
      </Row>
      <Row style={{ marginBottom: '5px', marginTop: '10px' }}>
        <Col span={24} style={{ textAlign: 'right' }}>
          <Space>
            <Button icon={<SaveOutlined />} type="primary" onClick={save}>
              SAVE
            </Button>
            <Button icon={<RedoOutlined />} onClick={reset}>
              RESET
            </Button>
          </Space>
        </Col>
      </Row>
    </Form>
  )
}

function AiChat() {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [collapsed, _collapsed] = useToggle(false)

  const [reload, _reload] = useToggle(false)
  const [reloadHistory, _reloadHistory] = useToggle(false)
  const [topicFormVisiable, _topicFormVisiable] = useToggle(false)

  const [activeTopicId, _activeTopicId] = useState(null)
  const uploadRecordId = useRef(null)
  // Mapping from run_id (of on_chain_start) to tool_call_id
  const runIdToCallId = useRef({})

  const [allRecords, _allRecords] = useState([])

  const [sendLoading, _sendLoading] = useToggle(false)



  const [enableStream, _enableStream] = useState(true)

  const [startStreaming, _startStreaming] = useToggle(false)
  const [streamResponseLoading, _streamResponseLoading] = useToggle(false)

  const [streamingResponse, _streamingResponse] = useState('')

  const [thoughtItems, _thoughtItems] = useState([])

  const [startThinking, _startThinking] = useToggle(false)
  const [thinkingText, _thinkingText] = useState('')
  const streamingRef = useRef('')
  const eventSourceRef = useRef(null)
  // Coalesce scroll updates per frame (separate refs for different targets)
  const contentScrollRafRef = useRef(0)
  const thinkingScrollRafRef = useRef(0)

  // Bind the right pane height to the viewport so inner Content can scroll
  const rightPaneRef = useRef(null)
  const [paneHeight, setPaneHeight] = useState(null)
  const chatContentRef = useRef(null)
  const thinkingRef = useRef(null)

  useLayoutEffect(() => {
    const calc = () => {
      if (!rightPaneRef.current) return
      const rect = rightPaneRef.current.getBoundingClientRect()
      const h = Math.max(0, window.innerHeight - rect.top)
      setPaneHeight(h)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // Auto-scroll to bottom when records change
  useLayoutEffect(() => {
    const el = chatContentRef.current
    if (!el) return
    const raf = requestAnimationFrame(() => {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      } catch {
        el.scrollTop = el.scrollHeight
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [allRecords])

  // Also scroll on streaming updates (after paint) and coalesce to 1 rAF
  useEffect(() => {
    if (!startThinking) return
    const el = thinkingRef.current
    if (!el) return
    if (thinkingScrollRafRef.current) cancelAnimationFrame(thinkingScrollRafRef.current)
    thinkingScrollRafRef.current = requestAnimationFrame(() => {
      try {
        // Use instant scroll during streaming to minimize main-thread work
        el.scrollTo({ top: el.scrollHeight })
      } catch {
        el.scrollTop = el.scrollHeight
      }
      thinkingScrollRafRef.current = 0
    })
    return () => {
      if (thinkingScrollRafRef.current) cancelAnimationFrame(thinkingScrollRafRef.current)
      thinkingScrollRafRef.current = 0
    }
  }, [thinkingText, startThinking])

  useEffect(() => {
    if (!startStreaming) return
    const el = chatContentRef.current
    if (!el) return
    if (contentScrollRafRef.current) cancelAnimationFrame(contentScrollRafRef.current)
    contentScrollRafRef.current = requestAnimationFrame(() => {
      try {
        // Use instant scroll during streaming to minimize main-thread work
        el.scrollTo({ top: el.scrollHeight })
      } catch {
        el.scrollTop = el.scrollHeight
      }
      contentScrollRafRef.current = 0
    })
    return () => {
      if (contentScrollRafRef.current) cancelAnimationFrame(contentScrollRafRef.current)
      contentScrollRafRef.current = 0
    }
  }, [streamingResponse, startStreaming])

  const { value: topicItems = [], loading: topicLoading } = useAsync(async () => {
    const json = await get(`${buzzUrl}/ai/topic/list`)
    _activeTopicId(json[0].id + '')
    return json
  }, [reload])

  const [currentModel, _currentModel] = useState(null)

  const { value: models = [] } = useAsync(async () => {
    const json = await get(`${mcpUrl}/skills/models/list`)
    _currentModel(json[0])
    return json
  }, [])

  const { value: _ = [], loading: recordLoading } = useAsync(async () => {
    if (!activeTopicId) {
      return []
    }
    const json = await get(`${mcpUrl}/skills/history/${activeTopicId}/list`)
    // Append safely using functional update to ensure latest state
    _allRecords(json)
    return json
  }, [activeTopicId, reloadHistory])

  const menuConfig = conversation => ({
    trigger: () => (
      <span
        role="button"
        tabIndex={0}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        aria-label="actions"
        style={{ padding: 4, lineHeight: 0 }}
      >
        <MoreOutlined />
      </span>
    ),
    items: [
      {
        label: 'EDIT',
        key: 'edit',
        icon: <EditOutlined />,
      },
      {
        label: 'DEL',
        key: 'delete',
        icon: <DeleteOutlined />,
        danger: true,
      },
    ],
    onClick: menuInfo => {
      menuInfo.domEvent?.stopPropagation?.()
      console.log(`Click ${conversation.key} - ${menuInfo.key}`)
      if (menuInfo.key == 'edit') {
        //_activeTopicId(conversation.key);
        _currentTopic(topicItems.find(item => item.id === conversation.key))
        _topicFormVisiable()
      }
      if (menuInfo.key == 'delete') {
        deleteTopic(conversation.key, conversation.label)
        _reloadHistory()
      }
      _uploadFiles([])
    },
  })

  const [sendMsg, _sendMsg] = useState('')

  const STREAM_RETRY_DELAY_MS = 10000
  const STREAM_MAX_RETRY_COUNT = 5

  // 1. 在组件中定义 fetchEeventSource 的逻辑
  const streamQuestionWithFetch = async () => {
      _sendLoading(true);
      _streamResponseLoading(true)
      
      // 创建 AbortController
      const ctrl = new AbortController();
      // 将 controller 存入 ref，以便后续可以中止
      eventSourceRef.current = ctrl; 
      let firstChunkReceived = false; // 标记是否已收到第一条消息
        let retryCount = 0;

      try {
          await fetchEventSource(`${mcpUrl}/skills/chat_stream`, {
              method: 'POST',
              signal: ctrl.signal, // 必须传递 signal
              headers: {
                  'Content-Type': 'application/json',
                  'access_token': sessionStorage.getItem('access_token') || '',
              },
              body: JSON.stringify({
                  user_input: sendMsg,
                  model: currentModel?.modelName,
                  topic_id: activeTopicId,
                  files: uploadFiles.map(f => f.url)
              }),
                  onopen(response) {
                    if (!response.ok) {
                    throw new Error(`stream open failed: ${response.status}`)
                    }
                    retryCount = 0
                  },
              onmessage(msg) {
                  if (msg.data === '[DONE]') {
                      return;
                  }
                  const json = JSON.parse(msg.data);
                  if(json.event == 'on_chain_start' && json.metadata?.event_index === 1){
                    //第一条信息
                    console.log('first')
                    //console.log(json)
                    _sendLoading(false)
                    _sendMsg('')
                    const currentQuestion = {
                      id: json.run_id,
                      content: json.data.input.messages[0].content,
                      type: 'human',
                      imgUrl: ''
                    }
                    if(json.data.input.messages[0].content.find){
                      const text = json.data.input.messages[0].content.find(c => c.text)?.text
                      currentQuestion.content = text || json.data.input.messages[0].content
                    }
                    _allRecords(prev => [...prev, currentQuestion])
                    _startStreaming(true)

                    // Reset accumulator
                    streamingRef.current = ''
                    _streamingResponse('')
                    _thinkingText('')
                    _thoughtItems([])
                  }
                  if(json.event == 'on_chain_start' && json.data?.input?.tool_call){
                    const call = json.data.input.tool_call
                    const call_id = call.id
                    runIdToCallId.current[json.run_id] = call_id

                    const callMessage = json.data.input.state['messages'].filter(m => m.tool_calls && m.tool_calls[0]).find(m => m.tool_calls[0].id === call_id)
                    const title =  callMessage.content ? callMessage.content : 'tool calling...'
                    _thoughtItems(prev => {
                      return [...prev,
                        {
                          callId :call_id,
                          key: call_id + 'call-start',
                          title: title,
                          description: (
                            <Space orientation="vertical" style={{ width: '100%' }}>
                            <Typography.Text type="success" code>
                              tool call: {call.name}
                            </Typography.Text>
                            {call.args && Object.keys(call.args).length > 0 && (
                              <Typography.Text type="secondary" code>
                                call args:{JSON.stringify(call.args)}
                              </Typography.Text>
                            )}
                            </Space>
                          ),
                          status: 'loading',
                          content: null,
                          icon: <Spin />
                        }
                      ]
                    })                   
                  }
                  if (json.event === 'on_tool_error') {
                    //console.log(json)
                    let callId = json.data.output?.tool_call_id
                    // try to find callId from runIdToCallId map by parent_ids
                    if(!callId && json.parent_ids){
                      for(const pid of json.parent_ids){
                        if(runIdToCallId.current[pid]){
                          callId = runIdToCallId.current[pid]
                          break
                        }
                      }
                    }

                    const toolError = json.data.error
                    _thoughtItems(prev => prev.map(item => {
                        if (item.callId === callId) {
                          return {
                              ...item,
                              status: 'error',
                              content: <XMarkdown components={{ code: Code }} paragraphTag="div">{toolError}</XMarkdown> 
                          }
                        }
                        return item
                    }))                                
                  }

                  if (json.event === 'on_tool_end') {
                    const callId = json.data.output.tool_call_id
                    const toolOutput = json.data.output.content
                    _thoughtItems(prev => prev.map(item => {
                        if (item.callId === callId) {
                          return {
                              ...item,
                              status: 'success',
                              content: <XMarkdown components={{ code: Code }} paragraphTag="div">
                                {/```|^\s*[-*]\s|^\s*\d+\.\s|^\s*#{1,6}\s|^\s*>|^\s*\|/m.test(toolOutput)
                                  ? toolOutput
                                  : `\`\`\`text\n${toolOutput}\n\`\`\``}
                              </XMarkdown>
                          }
                        }
                        return item
                    }))
                  }

                  if(json.event == 'on_chat_model_stream'){
                      _streamResponseLoading(false)
                      
                      if(!firstChunkReceived){
                        _startStreaming(true)
                        firstChunkReceived = true
                      }
                      const chunk = json.data.chunk?.content
                      if(chunk){
                        _startThinking(false)
                        streamingRef.current += chunk
                        _streamingResponse(prev => prev + chunk)
                      }
                      const thinkChunk = json.data.chunk?.additional_kwargs?.reasoning_content
                      if(thinkChunk){
                        _startThinking(true)
                        _thinkingText(prev => prev + thinkChunk)
                      }
                  }
                  if (json.event == 'on_done' && json.metadata?.is_final_event) {
                    console.log(streamingRef.current)
                    const currentAnswer = {
                      id: json.run_id,
                      content: streamingRef.current,
                      type: 'ai',
                    }
                    // Cleanup
                    streamingRef.current = ''
                    _streamingResponse('')
                    //_thinkingText('');
                    _startStreaming(false)
                    _allRecords(prev => [...prev, currentAnswer])
                    _uploadFiles([])
                    _reloadHistory()
                    return
                  }
                  if(json.event == 'on_error' && json.metadata?.is_final_event){
                    streamingRef.current += '\n\n[Error]: ' + (json.data?.error || json.error) + '\n\nPlease try again.'
                    const currentAnswer = {
                      id: json.run_id,
                      content: streamingRef.current,
                      type: 'ai',
                    }
                    // Cleanup
                    streamingRef.current = ''
                    _streamingResponse('')
                    //_thinkingText('');
                    _startStreaming(false)
                    _allRecords(prev => [...prev, currentAnswer])
                    _uploadFiles([])
                    _reloadHistory()
                    return
                  }
              },
              onerror(err) {
                  console.log('fetchEventSource error',err)
                  retryCount += 1
                  if (retryCount > STREAM_MAX_RETRY_COUNT) {
                  _sendLoading(false)
                  _streamResponseLoading(false)
                  _startStreaming(false)
                  message.error(`stream retry failed after ${STREAM_MAX_RETRY_COUNT} attempts`)
                  throw err
                  }
                  // Return retry interval in milliseconds to avoid rapid reconnect loops.
                  return STREAM_RETRY_DELAY_MS
              }
          });
      } catch (err) {
          console.error(err);
      } finally {
          // 请求结束后清理 ref（可选，视逻辑而定）
          if (eventSourceRef.current === ctrl) {
              eventSourceRef.current = null;
          }
      }
  }

  // 2. 修改清理逻辑 (useEffect)
  useEffect(() => {
      return () => {
        const current = eventSourceRef.current;
        if (current) {
          // 检查是 EventSource 实例还是 AbortController
          if (typeof current.close === 'function') {
              current.close(); // 兼容旧的 EventSourcePolyfill
          } else if (typeof current.abort === 'function') {
              current.abort(); // 兼容 fetchEventSource 的 AbortController
          }
          eventSourceRef.current = null;
        }
      }
  }, [])

  const deleteTopic = (id, name) => {
    confirm({
      title: `confirm delete topic ${name}?,all chat records will be deleted`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        const json = await del(`${mcpUrl}/skills/history/${id}/del`)
        if (json.success) {
          message.info('delete success')
        } else {
          message.error(json.error || 'delete failed')
        }
        _allRecords([])
        _reload()
      },
      onCancel() {
        console.log('Cancel')
      },
    })
  }

  const deleteRecord = id => async () => {
    if (!id) {
      message.error('cannot get record id, please refresh and try again')
      return
    }
    const json = await del(`${buzzUrl}/ai/record/${id}/del`)
    if (json.success) {
      message.info('delete success')
      let index = allRecords.findIndex(item => item.id === id)
      if (index != -1) {
        allRecords.splice(index, 1)
        _allRecords([...allRecords])
      }
    } else {
      message.error(json.error || 'delete failed')
    }
  }

  const copyToClip = msg => () => {
    navigator.clipboard.writeText(msg)
    message.success('Copy to clipboard success')
  }

  //const currentTopic = useMemo(() => topicItems.find((item) => item.id === activeTopicId), [topicItems, activeTopicId])
  const [currentTopic, _currentTopic] = useState({})

  const selectTopic = topicId => {
    _allRecords([])
    _uploadFiles([])
    _activeTopicId(topicId)
  }

  const modelDrop = {
    items: models.map(modelMap) || [],
    onClick: e => {
      _currentModel(models.find(m => m.model === e.key))
    },
  }

  const [uploadFiles, _uploadFiles] = useState([])


  const uploadProps = {
    multiple: false,
    showUploadList: false,
    name: 'file',
    disabled: false,
    action: file => {
      return `${mcpUrl}/skills/${activeTopicId}/upload`
    },
    headers: { access_token: sessionStorage.getItem('access_token') || '' },
    beforeUpload: file => {
      return true
    },
    onChange: ({ file }) => {
      console.log(file)
      if (file.status === 'done') {
        const fileName = file.response?.saved_as
        if (fileName) {
          message.success(`${file.name} file upload success.`)
          _uploadFiles(prev => [...prev, { url: file.response.url, fileName: fileName, size: file.response.size }])
        }
      }
    },
  }

  const [enableThinking, _enableThinking] = useToggle(false)
  const [enableSearch, _enableSearch] = useToggle(false)

  const groupedRecords = useMemo(() => setUpMessage(allRecords || []), [allRecords])

  return (
    <Layout style={{ height: '100%', overflow: 'hidden' }} hasSider>
      <Sider width={300} style={{ height: '100%', background: '#fff', overflowY: 'auto', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={() => {
                _currentTopic({})
                _topicFormVisiable()
              }}
            >
              New TopiC
            </Button>
          </Space>
        </div>
        <Spin spinning={topicLoading}>
          <Conversations items={(topicItems || []).map(conversationsMap)} activeKey={activeTopicId} onActiveChange={selectTopic} menu={menuConfig} />
        </Spin>
      </Sider>
      <Modal open={topicFormVisiable} width={600} title="topic edit" footer={null} onCancel={_topicFormVisiable} maskClosable={false} destroyOnHidden={true}>
        <TopicForm
          record={currentTopic || {}}
          closeFun={{ close: _topicFormVisiable, reload: _reload }}
          onSaved={data => {
            if (data?.id) {
              _activeTopicId(data.id + '')
            }
          }}
        />
      </Modal>
      <div
        ref={rightPaneRef}
        style={{ height: paneHeight || 'auto', width: '100%', minWidth: 0, paddingBottom: 24, boxSizing: 'border-box', overflowX: 'hidden' }}
      >
        <Layout style={{ height: '100%', width: '100%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 16 }}>
          <Content key="chat-history" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }} ref={chatContentRef}>
            <Spin spinning={recordLoading} />
            <Flex gap="middle" vertical style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }} key="chat-bubbles">
              {groupedRecords.map((r)=>chatRecordsMap(r,token)).reduce((acc, val) => {
                return acc.concat(val) || []
              },[]).map((r) =>
                <Bubble
                  key={r.key}
                  placement={r.placement}
                  content={r.content}
                  avatar={r.avatar}
                  contentRender={renderMarkdown}
                  footer={msg => (
                    <Flex>
                      <Button size="small" type="link" icon={<CopyOutlined />} onClick={copyToClip(msg)}></Button>
                      <Button size="small" type="link" icon={<DeleteOutlined />} onClick={deleteRecord(r.key)}></Button>
                    </Flex>
                  )}
                />
              )}
              {startStreaming ? (
                <Bubble
                  loading={streamResponseLoading}
                  content={
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      {thoughtItems.length > 0 && (
                        <ThoughtChain
                          items={thoughtItems}
                          collapsible
                          style={{ marginBottom: 8, padding: 8, background: 'rgba(0,0,0,0.02)', borderRadius: 8 }}
                        />
                      )}
                      {streamingResponse}
                    </Space>
                  }
                  avatar={<Avatar icon={<QwenIcon />} style={fooAvatar} />}
                  header={_ => (
                    <Think ref={thinkingRef}>{thinkingText}</Think>
                  )}
                />
              ) : null}
            </Flex>
            <Spin spinning={recordLoading} />
          </Content>
          <Footer style={{ flex: '0 0 auto' }}>
            <Space size={token.paddingXXS}>
              <Flex gap={8} wrap="wrap">
                {(uploadFiles || []).map((file, index) => (
                  <FileCard
                    key={`${file.fileName}-${index}`}
                    src={file.url}
                    name={file.fileName}
                    byte={file.size}
                  />
                ))}
              </Flex>
            </Space>
            <Sender
              value={sendMsg}
              onChange={_sendMsg}
              loading={sendLoading}
              onSubmit={() => {
                  streamQuestionWithFetch()
              }}
              footer={messageContext => (
                <Space size={token.paddingXXS}>
                  <Upload {...uploadProps}>
                    <Button size="small" type="link" icon={<LinkOutlined />}></Button>
                  </Upload>
                  <Divider orientation="vertical" />
                  <Dropdown menu={modelDrop}>
                    <Button>
                      <Space>
                        {currentModel?.model || 'Select Model'}
                        <DownOutlined />
                      </Space>
                    </Button>
                  </Dropdown>
                  <Divider orientation="vertical" />
                  <Space>
                    thinking
                    <Switch disabled={!currentModel?.thinking} onChange={_enableThinking} checked={enableThinking} />
                  </Space>
                  <Divider orientation="vertical" />
                  <Space>
                    search
                    <Switch disabled={!currentModel?.search} onChange={_enableSearch} checked={enableSearch} />
                  </Space>
                </Space>
              )}
            />
          </Footer>
        </Layout>
      </div>
    </Layout>
  )
}

export default AiChat
