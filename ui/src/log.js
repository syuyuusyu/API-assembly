import './App.css';
import React,{ useState,createContext } from 'react';
import {useAsync,useToggle} from 'react-use';
import lodash from 'lodash';
import stringify from 'json-stringify-pretty-compact'

import { SearchOutlined} from '@ant-design/icons';
import {Table,Layout,Form,Select,Divider,Button,Modal,Descriptions,Tag,Input,Space} from 'antd'
import dayjs from 'dayjs';
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
import { SeeIcon } from './icon';

dayjs.extend(utc);
dayjs.extend(timezone);

import CodeMirror from '@uiw/react-codemirror';
import { json as codeJson } from '@codemirror/lang-json';

const { Header, Content } = Layout;

const FormItem = Form.Item;
const Option = Select.Option;

import { post,get } from './util';

const BaseUrlContext = createContext('');


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
  
    const [currentRecod,_currentRecod] = useState({})
  
    const {value:dataSource,loading } = useAsync( async()=>{
      console.log(`${baseUrl}/invokeInfo/logs`)
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
            return (
              <span>
                <Button icon={<SeeIcon />} onClick={() => openDetial(record)} size="small"></Button>
              </span>
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

const Detail=( {record} ) =>{
  return (
    <Descriptions title={record.descrption} bordered  >
      <Descriptions.Item label="url" span={3}>{record.url}</Descriptions.Item>
      <Descriptions.Item label="http code" >{record.code}</Descriptions.Item>
      <Descriptions.Item label="method" >{record.method}</Descriptions.Item>
      <Descriptions.Item label="date" >{dayjs(record.date).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
      <Descriptions.Item label={ <Tag color="#108ee9">request head</Tag>} span={3}>
        <CodeMirror
          value={stringify( JSON.parse(record.head),{ indent: 2 })}
          extensions={[codeJson()]}
          style={{ width: '1050px', overflowWrap: 'break-word' }}
        />
      </Descriptions.Item>
      <Descriptions.Item label={<Tag color="#108ee9">request body</Tag>} span={3}>
        <CodeMirror
          value={stringify( JSON.parse(record.request),{ indent: 2 })}
          extensions={[codeJson()]}
          style={{ width: '1050px', overflowWrap: 'break-word' }}
        />
      </Descriptions.Item>
      <Descriptions.Item label={ <Tag color="#108ee9">response</Tag>} span={3}>
        <CodeMirror
          value={stringify( JSON.parse(record.response),{ indent: 2 })}
          extensions={[codeJson()]}
          style={{ width: '1050px', overflowWrap: 'break-word' }}
        />
      </Descriptions.Item>            
    </Descriptions>
  )
}

export default Log;