// @ts-nocheck

import './App.css';
import React,{useEffect, useState, useMemo,useCallback,createContext,useContext } from 'react';
import {useAsync,useToggle} from 'react-use';
import lodash from 'lodash';
import stringify from 'json-stringify-pretty-compact'

import { SearchOutlined,DeleteOutlined,EditOutlined,PlayCircleOutlined,SaveOutlined,RedoOutlined} from '@ant-design/icons';
import { ApiIcon,InvokeIcon,DuplicateIcon, } from './icon';
import {Table,Row,Col,Card,Layout,Form,Select,Divider,Button,Modal,notification,Tag,Input,Space,message,Spin} from 'antd'

const { Header, Content } = Layout;

const FormItem = Form.Item;
const Option = Select.Option;
const { confirm } = Modal;

import { post,get,del } from './util';

import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json as codeJson } from '@codemirror/lang-json';

//const baseUrl = 'http://127.0.0.1:7001'



const defaultHead = `{
  "Accept":"application/json",
  "Content-Type":"application/json;charset=UTF-8"
}`

const defaultFun = `function paraphraseFun(resObj, resHead, resStatus, reqHead, reqBody, url){
  return resObj
}`

const callableDefaultFun = `function paraphraseFun(obj,requestBody){
  return this.defaultValue(obj)
}`

const BaseUrlContext = createContext('');


const InvokeUi=( {baseUrl} ) =>{

  const [invokeName,_invokeName] = useState('')
  const [groupName,_groupName] = useState('')
  const [systemId,_systemId] = useState('')

  
  const [pagination,_pagination] = useState({
    current: 1,
    total: 0,
    size: 'small',
    pageSize: 20,
    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
    onChange: (page,pageSize) =>{
      _pagination((prevPagination) => ({ ...prevPagination, current: page, pageSize:pageSize}));
    }
  })

  const [reload, _reload] = useToggle(false)
  const [editFormVisible, _editFormVisible] = useToggle(false);
  const [isCallable, _isCallable] = useToggle(false);

  const editFormTitle = useMemo(()=> isCallable ? <Tag icon={<InvokeIcon />}  color="#87d068">Callable API</Tag> : <Tag icon={<ApiIcon />}  color="#2db7f5">API Configuration</Tag>,[isCallable])

  const [currentRecod,_currentRecod] = useState({})

  const {value:dataSource,loading } = useAsync( async()=>{
    const json = await post(`${baseUrl}/invokeInfo/infos`,{
      page:pagination.current, pageSize: pagination.pageSize, invokeName, groupName, systemId
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


  const openEditForm = (record,isDuplicate) =>{
    _isCallable(record.invokeType == "2" )
    const kknd = lodash.cloneDeep(record)
    if(isDuplicate){
      delete kknd.id 
      delete kknd.name 
    }
    _currentRecod(kknd)
    _editFormVisible()
  }

  const deleteRecord = (id,name) => {
    confirm({
        title: `confirm delete ${name}?`,
        okText: 'Yes',
        okType: 'danger',
        cancelText: 'No',
        onOk: async () => {
          const json = await del(`${baseUrl}/invokeInfo/delete/${id}`);
          if (json.success) {
              notification.success({
                  message: 'delete success',
              })
              _queryParamChange()
          } else {
              notification.error({
                  message: 'service error',
              })
          }
          _reload()
        },
        onCancel() {
            console.log('Cancel');
        },
    });
  }

  const columns = [
    { dataIndex: 'id', title: 'ID', width: 30 },
    { 
      dataIndex: 'systemId', title: 'system', width: 80,
      render: text=>{
        return systemInfo.find(i=> i.systemId == text).name
      }
    },
    {
        dataIndex: 'invokeType', title: 'API type', width: 70,
        render: (text, record) => {
            switch (text) {
                case '1':
                    return <Tag icon={<ApiIcon />}  color="#2db7f5">API Configuration</Tag>;
                case '2':
                    return <Tag icon={<InvokeIcon />}  color="#87d068">Callable API</Tag>;
                default:
                    return '';
            }
        }
    },
    {
        dataIndex: 'name', title: 'name', width: 80,
    },
    // post #49cc90
    // get #61affe
    // delete #f93e3e
    // put #fca130
    // patch #50e3c2
    { dataIndex: 'groupName', title: 'group name', width: 70 },
    { dataIndex: 'descrption', title: 'descrption', width: 120 },
    { 
      dataIndex: 'method', title: 'method', width: 40,
      render: (text) => {
        switch (text.toUpperCase()) {
            case 'GET':
                return <Tag color="#61affe">{text}</Tag>;
            case 'POST':
                return <Tag color="#49cc90">{text}</Tag>;
            case 'DELETE':
              return <Tag color="#f93e3e">{text}</Tag>;
            case 'PUT':
              return <Tag color="#fca130">{text}</Tag>;
            case 'PATCH':
              return <Tag color="#50e3c2">{text}</Tag>;
            default:
                return text;
        }
    }
    },
    { dataIndex: 'url', title: 'URL', width: 150 },
    {
      title: 'operation',
      dataIndex: 'id',
      width: 80,
      render: (text, record) => {
          return (
            <span>
              <Button icon={<DuplicateIcon />} onClick={() => openEditForm(record, true)} size="small"></Button>
              <Divider type="vertical" />
              <Button icon={<EditOutlined />} onClick={() => openEditForm(record)} size="small"></Button>
              <Divider type="vertical" />
              <Button danger icon={<DeleteOutlined />} onClick={() => deleteRecord(record.id, record.name)} size="small"></Button>
            </span>
          );
      }
  }
  ]

  const expandedRowRender = (record) => (
    <div className="box-code-card" style={{ background: '#ECECEC', padding: '1px' }}>
        <Row gutter={24} >
            <Col span={8} >
                <Card title={ <Tag color="#108ee9">request head</Tag>} bordered={false}><pre>{record.head}</pre></Card>
            </Col>
            <Col span={8} >
                <Card title={ <Tag color="#108ee9">request body</Tag>} bordered={false}><pre>{record.body}</pre></Card>
            </Col>
            <Col span={8} >
                <Card title={<Tag color="#108ee9">paraphrase function</Tag>} bordered={false}><pre>{record.parseFun}</pre></Card>
            </Col>
        </Row>
    </div>
  );

  const [form] = Form.useForm();

  const onFinish = (values) =>{ 
    _systemId(values.systemId)
    _invokeName(values.invokeName)
    _groupName(values.groupName)
    if(values.invokeName || values.groupName){
      _pagination((prevPagination) => ({ ...prevPagination, current:1 }))
    }
    _reload()
  }

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
                <Select style={{ width: '400px' }} allowClear={true} showSearch  placeholder="search for name" optionFilterProp="label" >
                    {
                        queryNames.names.map(_=> <Option key={_.name} label={_.name}>{_.name} ({_.description})</Option>)
                    }
                </Select>
              </FormItem>

              <FormItem name='groupName' >
                <Select style={{ width: '200px' }} allowClear={true} showSearch placeholder="search for group name"  optionFilterProp="label" >
                    {
                        queryNames.groupNames.map(_=> <Option key={_.name} label={_.name}>{_.name}</Option>)
                    }
                </Select>
              </FormItem>
              <Button icon={<SearchOutlined />} type="primary" htmlType="submit"></Button>
              <Divider type="vertical" />
              <Space style={{float:'right'}}>
              <Button icon={<ApiIcon />} style = {{color:'#2db7f5'}} onClick={()=> openEditForm({invokeType:'1'})} >new API Configuration</Button>
              <Button icon={<InvokeIcon />}  style = {{color:'#87d068'}} onClick={()=> openEditForm({invokeType:'2',method:'POST'})} >new Callable API</Button>
              </Space>
            </Form>
        </Header>
        <Content >
          <Modal open={editFormVisible}
              width={1300}
              title={editFormTitle}
              footer={null}
              onCancel={_editFormVisible}
              maskClosable={false}
              destroyOnClose={true}>
              <EditForm record={currentRecod} isCallable={isCallable} systemInfo={systemInfo} allNames={queryNames.names} closeFun={{close:_editFormVisible,reloadTable:_reload,reloadName: _queryParamChange}}/>
          </Modal>
          <Table columns={columns}
              rowKey={record => record.id}
              dataSource={dataSource}
              rowSelection={null}
              size="small"
              scroll={{ y: 1000 }}
              expandedRowRender={expandedRowRender}
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

function EditForm({record,isCallable,systemInfo=[],allNames=[],closeFun={} }){
  const baseUrl = useContext(BaseUrlContext);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm()

  const [callTestVisible, _callTestVisible] = useToggle(false);
  const [configTestVisible, _configTestVisible] = useToggle(false);



  useEffect(() => {
    form.setFieldsValue({
      method: record.method,
      next: record.next ? record.next.split(',') : [],
      descrption: record.descrption,
      url: record.url,
      name: record.name,
      groupName: record.groupName,
      enableLog: record.enableLog,
      systemId: record.systemId
    })
  }, []);

  const checkUnique =async (rule, value) =>{
    if(!value){
      return Promise.reject('')
    }
    if(record.name== value){
      return Promise.resolve()
    }
    let json = await get(`${baseUrl}/invokeInfo/checkUnique/${value}`);
    if (json.total === 0) {
      return Promise.resolve()
    } else {
      return Promise.reject('')
    }
  }

  const [headValue,_headValue] = useState(record.head ? record.head : defaultHead)
  const [bodyValue,_bodyValue] = useState(record.body ? record.body : '{}')
  const [funValue,_funValue] = useState(record.parseFun ? record.parseFun : (isCallable ? callableDefaultFun : defaultFun ) )

  const headChange = useCallback(_headValue, []);
  const bodyChange = useCallback(_bodyValue, []);
  const funChange = useCallback(_funValue, []);

  const reset =()=>{
    _headValue('{}')
    _bodyValue('{}')
    _funValue('')
    form.resetFields()
  }

  const save = ()=>{
    //let a =await form.validateFields()
    form.validateFields().then(async (values)=>{
      if(record.id){
        values.id = record.id
      }
      values.head = headValue;
      values.body = bodyValue;
      values.parseFun = funValue;
      values.next = values.next.join(',')
      values.invokeType = isCallable ? '2' : '1'

      let json = await post(`${baseUrl}/invokeInfo/save`, values);
      if(json.success){
        messageApi.info('save success')
        closeFun.reloadName()
        closeFun.reloadTable()
        closeFun.close()

      }else{
        messageApi.error('error occure on service side, save fail')
        closeFun.close()
      }
    }).catch(() => {
      messageApi.error('invalied input')
    })
  }

  const showTest = () => isCallable ? _callTestVisible() : _configTestVisible()

  return (
    <div>
      {contextHolder}
      <Form form={form}   layout="vertical" >
          <Row gutter={24}>
              <Col span={5}>
                <FormItem label="system" name='systemId' rules={[{ required: true, message: 'required!!' }]}>
                  <Select onChange={null}>
                      {
                          systemInfo.map((o, i) => <Select.Option key={o.systemId}>{o.name}</Select.Option>)
                      }
                  </Select>
                </FormItem>
              </Col>
              <Col span={5}>
                  <FormItem 
                    label="name" 
                    name="name" 
                    //help="input name of API(must be unique)"
                    rules={[
                      {
                        required: true, 
                        validator: checkUnique, 
                        message: 'must be unique', 
                      }
                    ]} 
                    validateTrigger='onBlur'>
                    <Input placeholder="" />
                  </FormItem>
              </Col>     
              <Col span={5}>
                  <FormItem label="group name" 
                    //help="Just use it for queries. It is recommended that the relevant APIs be in the same group."
                    name="groupName" >
                    <Input placeholder="" />
                  </FormItem>
              </Col>  
              <Col span={5}>
                  <FormItem label="method" name= "method" rules={[{ required: true, message: 'required!!' }]}>
                    <Select disabled={isCallable} onChange={null}>
                      <Option key="GET"><Tag color="#61affe">GET</Tag></Option>
                      <Option key="POST"><Tag color="#49cc90">POST</Tag></Option>
                      <Option key="PUT"><Tag color="#fca130">PUT</Tag></Option>
                      <Option key="DELETE"><Tag color="#f93e3e">DELETE</Tag></Option>
                      <Option key="PATCH"><Tag color="#50e3c2">PATCH</Tag></Option>
                    </Select>
                  </FormItem>
              </Col>                                   
              <Col span={4}>
                  <FormItem label="save log" name='enableLog'>
                    <Select disabled={isCallable} onChange={null}>
                      <Select.Option key={1}>Yes</Select.Option>
                      <Select.Option key={0}>No</Select.Option>
                    </Select>
                  </FormItem>
              </Col>
          </Row>
          <Row gutter={24}>


              <Col span={12}>
                  <FormItem label="URL" name="url" rules={[{ required: !isCallable, message: 'url invalied',pattern: /((https?|ftp|file):\/\/)?[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/ }]}>
                    <Input disabled={isCallable} />
                  </FormItem>
              </Col>
              <Col span={12}>
                <FormItem label="descrption" name = "descrption">
                    <Input placeholder="The description of the current configuration." />
                </FormItem>
              </Col>              
          </Row>          
          <Row gutter={24}>
              <Col span={24}>
                  <FormItem label="relevant request" name="next" rules={[{ required: isCallable, message: 'required!!' }]}>
                    <Select mode="multiple" placeholder="" optionFilterProp="label">
                      {
                        allNames.map(_=> <Option key={_.id} label={_.name}>{_.name} ({_.description})</Option>)
                      }
                    </Select>
                  </FormItem>
              </Col>
          </Row>

          <Row gutter={24}>
              <Col span={12}>
                  <div>
                      <div style={{ marginBottom: '5px', marginTop: '10px' }}><Tag color="#108ee9">request head</Tag></div>
                      <CodeMirror
                        value={headValue}
                        height="250px"
                        extensions={[codeJson()]}
                        onChange={headChange}
                      />
                  </div>
              </Col>
              <Col span={12}>
                  <div>
                      <div style={{ marginBottom: '5px', marginTop: '10px' }}><Tag color="#108ee9">request body</Tag></div>
                      <CodeMirror
                        value={bodyValue}
                        height="250px"
                        extensions={[codeJson()]}
                        onChange={bodyChange}
                      />
                  </div>
              </Col>
          </Row>
          <Row>
              <Col span={24}>
                  <div>
                      <div style={{ marginBottom: '5px', marginTop: '10px' }}><Tag color="#108ee9">paraphrase function</Tag></div>
                      <CodeMirror
                        value={funValue}
                        height="400px"
                        extensions={[javascript({ jsx: true })]}
                        onChange={funChange}
                      />
                  </div>
              </Col>
          </Row>
          <Row style={{ marginBottom: '5px', marginTop: '10px' }}>
              <Col span={24} style={{ textAlign: 'right' }}>
                <Space>
                  <Button icon={<PlayCircleOutlined />} onClick={showTest}>TEST</Button>
                  <Button icon={<SaveOutlined />} type="primary" onClick={save} >SAVE</Button>
                  <Button icon={<RedoOutlined />} onClick={reset}>RESET</Button>
                </Space>
              </Col>
          </Row>
      </Form>
      <Modal open={callTestVisible}
              width={1300}
              title=<Tag icon={<InvokeIcon />}  color="#87d068">Test Callable API</Tag>
              footer={null}
              onCancel={_callTestVisible}
              maskClosable={false}
              destroyOnClose={true}>
        <CallableTest  record={{ ...record,...form.getFieldsValue(), head: headValue, body: bodyValue, parseFun: funValue }} />
      </Modal>
      <Modal open={configTestVisible}
            width={1300}
            title=<Tag icon={<ApiIcon />}  color="#2db7f5">Test API Configuration</Tag>
            footer={null}
            onCancel={_configTestVisible}
            maskClosable={false}
            destroyOnClose={true}>
        <ConfigTest  record={{ ...record,...form.getFieldsValue(), head: headValue, body: bodyValue, parseFun: funValue }} />
      </Modal>
  </div>
  )

}

function CallableTest({record}){

  const baseUrl = record.baseUrl ? record.baseUrl:useContext(BaseUrlContext);

  const [loading, _loading] = useToggle(false)

  const [url,_url] = useState(`${baseUrl}/invoke/${record.name}`)

  const [headValue,_headValue] = useState(record.head ? record.head : defaultHead)
  const [bodyValue,_bodyValue] = useState(record.body ? record.body : '{}')
  const [resultValue,_resultValue] = useState('{}')

  const headChange = useCallback(_headValue, []);
  const bodyChange = useCallback(_bodyValue, []);

  const execute = async () =>{
    _resultValue('{}')
    _loading(true)
    fetch(url,{
      method: 'POST',
      headers: {
          ...JSON.parse(headValue),
          'access_token': sessionStorage.getItem('access_token') || '',// 从sessionStorage中获取access token
      },
      body: bodyValue,
    }).then(async (res) => {
      const kknd = await res.json()
      _resultValue(stringify(kknd,{ indent: 2 }))
    }).catch((err) => {
      _resultValue(err.toString())
    }).finally( ()=>{
      _loading(false)
    })
  }

  return (
    <div>
      <Spin spinning={loading}>
      <Row gutter={24}>
        <Col span={4}><Tag color="#108ee9">method</Tag><Input disabled={true} value = {'POST'} /></Col>
        <Col span={20}><Tag color="#108ee9">url</Tag><Input onChange={e=>_url(e.target.value)}  value = {url} /></Col>
      </Row>
      <Row gutter={24}>
          <Col span={12}>
              <div>
                  <div style={{ marginBottom: '5px', marginTop: '10px' }}><Tag color="#108ee9">request head</Tag></div>
                  <CodeMirror
                    value={headValue}
                    height="250px"
                    extensions={[codeJson()]}
                    onChange={headChange}
                  />
              </div>
          </Col>
          <Col span={12}>
              <div>
                  <div style={{ marginBottom: '5px', marginTop: '10px' }}><Tag color="#108ee9">request body</Tag></div>
                  <CodeMirror
                    value={bodyValue}
                    height="250px"
                    extensions={[codeJson()]}
                    onChange={bodyChange}
                  />
              </div>
          </Col>
      </Row>
      <Row>
          <Col span={24}>
              <div>
                  <div style={{ marginBottom: '5px', marginTop: '10px' }}><Tag color="#108ee9">result</Tag></div>
                  <CodeMirror
                    value={resultValue}
                    height="400px"
                    extensions={[codeJson()]}
                  />
              </div>
          </Col>
      </Row>
      </Spin>
      <Row style={{ marginBottom: '5px', marginTop: '10px' }}>
          <Col span={24} style={{ textAlign: 'right' }}>
            <Space>
              <Button icon={<PlayCircleOutlined />} type="primary"  onClick={execute}>Execute</Button>
            </Space>
          </Col>
      </Row>
    </div>
  )
}



function ConfigTest({record}){
  const baseUrl = record.baseUrl ? record.baseUrl:useContext(BaseUrlContext);
  const [loading, _loading] = useToggle(false)
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm()

  const [funValue,_funValue] = useState(record.parseFun ? record.parseFun : '')
  const funChange = useCallback(_funValue, []);

  const [oresult,_oresult] = useState("{}")
  const [presult,_presult] = useState("{}")

  const queryStr = useMemo(()=> {
    let kknd = [];
    (record.url + record.head + record.body).replace(/@(\w+)/g, function (w, p1) {
        if(p1!='baseUrl'){
          kknd.push(p1)
        }
      
    });
    return kknd
  })

  const execute = () =>{
    form.validateFields().then(async (values)=>{
      _oresult('{}')
      _presult('{}')
      
      _loading(true)
      const kknd = lodash.cloneDeep(record)
      kknd.parseFun = funValue
      fetch(`${baseUrl}/invokeInfo/test`,{
        method: 'POST',
        headers: {
            ...JSON.parse(record.head),
            'access_token': sessionStorage.getItem('access_token') || '',// 从sessionStorage中获取access token
        },
        body: stringify({
          queryObj:values,
          entity: kknd
        }),
      }).then(async (res) => {
        const result = await res.json()
        _oresult(stringify(result.oresult,{ indent: 2 }))
        _presult(stringify(result.presult,{ indent: 2 }))
      }).catch((err) => {
        //_resultValue(err.toString())
      }).finally( ()=>{
        _loading(false)
      })

    }).catch((e) => {
      console.log(e)
      messageApi.error('invalied input')
    })
  }

  return (
    <div>
      {contextHolder}
      <Spin spinning={loading}>
      <Form form={form}   layout="horizontal" >
        {
          queryStr.map(o=><FormItem key={o} label={o} name={o} ><Input /></FormItem> )
        }
      </Form>
      <Row>
          <Col span={24}>
              <div>
                  <div style={{ marginBottom: '5px', marginTop: '10px' }}><Tag color="#108ee9">orginal result</Tag></div>
                  <CodeMirror
                    value={oresult}
                    height="300px"
                    extensions={[codeJson()]}
                  />
              </div>
          </Col>
      </Row>     
      <Row>
          <Col span={24}>
              <div>
                  <div style={{ marginBottom: '5px', marginTop: '10px' }}><Tag color="#108ee9">paraphrase function</Tag></div>
                  <CodeMirror
                    value={funValue}
                    height="300px"
                    extensions={[javascript({ jsx: true })]}
                    onChange={funChange}
                  />
              </div>
          </Col>
      </Row>         
      <Row>
          <Col span={24}>
              <div>
                  <div style={{ marginBottom: '5px', marginTop: '10px' }}><Tag color="#108ee9">paraphrased result</Tag></div>
                  <CodeMirror
                    value={presult}
                    height="300px"
                    extensions={[codeJson()]}
                  />
              </div>
          </Col>
      </Row>             
      </Spin>
      <Row style={{ marginBottom: '5px', marginTop: '10px' }}>
          <Col span={24} style={{ textAlign: 'right' }}>
            <Space>
              <Button icon={<PlayCircleOutlined />} type="primary"  onClick={execute}>Execute</Button>
            </Space>
          </Col>
      </Row>      
    </div>
  )
}
export { ConfigTest }

export default InvokeUi;