import './App.css';
import React,{ useState,createContext,useContext } from 'react';
import {useAsync,useToggle} from 'react-use';
import lodash from 'lodash';
import stringify from 'json-stringify-pretty-compact'

import { RobotOutlined, SearchOutlined} from '@ant-design/icons';
import {Table,Layout,Form,Select,Divider,Button,Modal,Descriptions,Tag,Input,Space,Tooltip} from 'antd'
import dayjs from 'dayjs';
import { SeeIcon,RerunIcon } from './icon';
import { ConfigTest } from './InvokeUi';
import AiLogReview, { judgeAiLog } from './aiLogReview';
import CodeMirror from '@uiw/react-codemirror';
import { json as codeJson } from '@codemirror/lang-json';
import { post,get } from './util';

const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const { Header, Content } = Layout;

const FormItem = Form.Item;
const Option = Select.Option;

const BaseUrlContext = createContext('');

const parseLogJson = value => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

const logJsonText = value => {
  const parsed = parseLogJson(value);
  if (typeof parsed === 'string') return parsed;
  return stringify(parsed, { indent: 2 });
};

const LogJsonBlock = ({ value }) => (
  <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
    <CodeMirror
      value={logJsonText(value)}
      extensions={[codeJson()]}
      style={{ minWidth: 0 }}
    />
  </div>
);

const Log=( {baseUrl} ) =>{

    const [invokeName,_invokeName] = useState('')
    const [groupName,_groupName] = useState('')
    const [systemId,_systemId] = useState('')
    const [key,_key] = useState('')

    
    const [pagination,_pagination] = useState({
      current: 1,
      total: 10,
      size: 'small',
      pageSize: 20,
      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
      onChange: (page,pageSize) =>{
        _pagination((prevPagination) => ({ ...prevPagination, current: page, pageSize:pageSize}));
      }
    })
  
    const [reload, _reload] = useToggle(false)
    const [detailVisible, _detailVisible] = useToggle(false);  
    const [aiReviewVisible, _aiReviewVisible] = useToggle(false);  
  
    const [currentRecod,_currentRecod] = useState({})
  
    const {value:dataSource,loading } = useAsync( async()=>{
      const json = await post(`${baseUrl}/invokeInfo/logs`,{
        page:pagination.current, pageSize: pagination.pageSize, invokeName, groupName, systemId,key
      })
      if(json){
        _pagination((prevPagination) => ({ ...prevPagination, total: json.totalElements }));
        return json.content
      }
      return []
    },[pagination.current,pagination.pageSize,reload])
  
    const {value:systemInfo=[] } = useAsync( ()=>get(`${baseUrl}/systemInfo`))
    
    const [queryParamChange, _queryParamChange] = useToggle(false);
    const {value:queryNames={names:[],groupNames:[]} } = useAsync( ()=>get(`${baseUrl}/invokeInfo/groupName`),[queryParamChange])    

    const [form] = Form.useForm();

    const onFinish = (values) =>{ 
      _systemId(values.systemId)
      _invokeName(values.invokeName)
      _groupName(values.groupName)
      _key(values.key)
      if(values.invokeName || values.groupName || values.key){
        _pagination((prevPagination) => ({ ...prevPagination, current:1 }))
      }
      _reload()
    }

    const openDetial = (record) =>{
      const kknd = lodash.cloneDeep(record)
      _currentRecod(kknd)
      _detailVisible()
    }

    const openAiReview = (record) =>{
      const kknd = lodash.cloneDeep(record)
      _currentRecod(kknd)
      _aiReviewVisible()
    }

    const columns = [
      {dataIndex: 'name', title: 'name', width: 80,},
      {dataIndex: 'key', title: 'logKey', width: 120,},
      { dataIndex: 'groupName', title: 'group name', width: 70 },
      { dataIndex: 'descrption', title: 'descrption', width: 120 },
      { dataIndex: 'method', title: 'method', width: 40 },
      { dataIndex: 'url', title: 'URL', width: 150 },
      { 
        dataIndex: 'code', title: 'http_code', width: 40,
        render: text => {
          if (200 <= text && text < 300) {
            return <Tag color="#4CAF50">{text}</Tag>
          } else if (300 <= text && text < 400) {
            return <Tag color="#f50">{text}</Tag>
          } else if (400 <= text && text < 500) {
            return <Tag color="#faad14">{text}</Tag>
          } else if (500 <= text && text < 600) {
            return <Tag color="#f5222d">{text}</Tag>
          } else {
            return <Tag>{text}</Tag>
          }
        }
      },
      { 
        dataIndex: 'date', title: 'date', width: 100,
        render: text => dayjs(text).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss')
      },
      {
        title: 'operation',
        dataIndex: 'id',
        width: 80,
        render: (text, record) => {
            const aiLog = judgeAiLog(record)
            return (
              <Space size={4}>
                <Tooltip title="detail">
                  <Button icon={<SeeIcon />} onClick={() => openDetial(record)} size="small"></Button>
                </Tooltip>
                <Tooltip title={aiLog.isAiLog ? `AI log review (${aiLog.type})` : 'Not an AI API log'}>
                  <Button
                    icon={<RobotOutlined />}
                    onClick={() => openAiReview(record)}
                    size="small"
                    disabled={!aiLog.isAiLog}
                  ></Button>
                </Tooltip>
              </Space>
            );
        }
      }
    ]

    return (
      <BaseUrlContext.Provider value={baseUrl}>
      <Layout style={{ height: "100%" }}>
        <Content style={{ height: "100%" }} >
          <Layout style={{ height: "100%" }}>
            <Header style={{ background: '#fff', padding: 5, height: 'auto' }}>
              <Form  onFinish={onFinish} form={form} layout="inline">
                <FormItem name='systemId'>
                  <Select style={{ width: '300px' }}  allowClear={true} placeholder="select system" >
                    {
                        systemInfo.map((o, i) => {
                            return <Select.Option key={o.systemId}>{o.name}</Select.Option>
                        })
                    }
                  </Select>
                </FormItem>
                <FormItem  name="invokeName" >
                  <Select style={{ width: '400px' }} allowClear={true} showSearch optionFilterProp="label" placeholder="search for name">
                      {
                          queryNames.names.map(_=> <Option key={_.name} label={_.name}>{_.name} ({_.description})</Option>)
                      }
                  </Select>
                </FormItem>
  
                <FormItem name='groupName' >
                  <Select style={{ width: '200px' }} allowClear={true} showSearch optionFilterProp="label" placeholder="search for group name">
                      {
                          queryNames.groupNames.map(_=> <Option key={_.name} label={_.name}>{_.name}</Option>)
                      }
                  </Select>
                </FormItem>
                <FormItem name='key' >
                  <Input style={{ width: '400px' }} placeholder='logKey' />
                </FormItem>
                <Button icon={<SearchOutlined />} type="primary" htmlType="submit"></Button>
                <Divider type="vertical" />
                <Space style={{float:'right'}}>
                </Space>
              </Form>
          </Header>
          <Content >
            <Modal open={detailVisible}
                width={1300}
                title={'detail'}
                footer={null}
                onCancel={_detailVisible}
                maskClosable={false}
                destroyOnClose={true}>
                <Detail record={currentRecod}/>
            </Modal>
            <Modal open={aiReviewVisible}
                width={1300}
                title={'AI log review'}
                footer={null}
                onCancel={_aiReviewVisible}
                maskClosable={false}
                destroyOnClose={true}>
                <AiLogReview record={currentRecod}/>
            </Modal>
            <Table columns={columns}
                rowKey={record => record.id}
                dataSource={dataSource}
                rowSelection={null}
                size="small"
                scroll={{ y: 1000 }}
                pagination={pagination}
                loading={loading}
                onChange={null}
            />
          </Content>
            </Layout>
        </Content>
    </Layout>
    </BaseUrlContext.Provider>)

}

const Detail=({ record }) => {
  const baseUrl = useContext(BaseUrlContext);
  const [rerunVisible, _rerunVisible] = useToggle(false);

  const { value: config = {} } = useAsync(async () => {
    const json = await post(`${baseUrl}/invokeInfo/infos`, {
      page: 1, pageSize: 1, invokeName: record.name,
    });
    if (json.totalElements && json.totalElements === 1) {
      return json.content[0];
    }
    return {};
  }, []);

  const codeTag = (code) => {
    if (200 <= code && code < 300) return <Tag color="#4CAF50">{code}</Tag>;
    if (300 <= code && code < 400) return <Tag color="#f50">{code}</Tag>;
    if (400 <= code && code < 500) return <Tag color="#faad14">{code}</Tag>;
    if (500 <= code && code < 600) return <Tag color="#f5222d">{code}</Tag>;
    return <Tag>{code}</Tag>;
  };

  const renderSidePanel = () => {
    const meta = [
      { label: 'method', value: record.method },
      { label: 'http code', value: codeTag(record.code) },
      { label: 'date', value: dayjs(record.date).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss') },
    ];
    return (
      <div style={{ minWidth: 180, padding: '0 0 0 16px', borderLeft: '1px solid #f0f0f0' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#666', marginBottom: 12 }}>Metadata</div>
        {meta.map(m => (
          <div key={m.label} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontSize: 13 }}>{m.value}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Modal open={rerunVisible}
        width={1300}
        title="rerun"
        footer={null}
        onCancel={_rerunVisible}
        maskClosable={false}
        destroyOnClose={true}>
        <ConfigTest record={{
          url: record.url, method: record.method, name: record.name,
          head: record.head, body: record.request, baseUrl,
          parseFun: config.parseFun,
        }} />
      </Modal>

      {/* URL + 元数据行 */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 16,
        padding: 12, background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#666', marginBottom: 6 }}>{record.descrption}</div>
          <div style={{
            fontSize: 12, color: '#1677ff', wordBreak: 'break-all',
            background: '#fff', padding: '6px 10px', borderRadius: 4, border: '1px solid #e8e8e8',
            fontFamily: 'monospace',
          }}>
            {record.method && <Tag color="#1677ff" style={{ marginRight: 6, fontSize: 11 }}>{record.method}</Tag>}
            {record.url}
          </div>
        </div>
        {renderSidePanel()}
      </div>

      {/* Head 单独一行 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 4 }}>
          <Tag color="#108ee9">Request Headers</Tag>
        </div>
        <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4 }}>
          <LogJsonBlock value={record.head} />
        </div>
      </div>

      {/* Request Body + Response 一行 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 4 }}>
            <Tag color="#108ee9">Request Body</Tag>
          </div>
          <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4 }}>
            <LogJsonBlock value={record.request} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 4 }}>
            <Tag color="#108ee9">Response</Tag>
          </div>
          <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4 }}>
            <LogJsonBlock value={record.response} />
          </div>
        </div>
      </div>

      {config.name && (
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <Button icon={<RerunIcon />} onClick={_rerunVisible} size="small">
            Rerun
          </Button>
        </div>
      )}
    </>
  );
};

export default Log;
