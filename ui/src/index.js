// @ts-nocheck
import React from 'react';
import ReactDOM from 'react-dom/client';
import InvokeUi from './InvokeUi';
import Log from './log';
import { Tabs } from 'antd';

import { ApiIcon,LogIcon } from './icon';

//let baseUrl = 'https://www.51bqm.com:7012'
let baseUrl = 'http://localhost:7001'
if(window.KKND && window.KKND.baseUrl){
    baseUrl = window.KKND.baseUrl
}


const tables = [
    {
        label: <span><ApiIcon />API</span>,
        key: 1,
        children: <InvokeUi baseUrl = {baseUrl}/>,
    },
    {
        label: <span><LogIcon />LOG</span>,
        key: 2,
        children: <Log baseUrl = {baseUrl}/>,
    }
]

const App = () => <Tabs defaultActiveKey="2" items={tables} />


const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(
    <App/>
);

//export default InvokeUi

