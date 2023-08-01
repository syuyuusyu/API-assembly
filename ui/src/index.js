// @ts-nocheck
import React from 'react';
import ReactDOM from 'react-dom/client';
import InvokeUi from './InvokeUi';

//let baseUrl = 'https://www.51bqm.com:7012'
let baseUrl = 'http://localhost:7001'
if(window.KKND && window.KKND.baseUrl){
    baseUrl = window.KKND.baseUrl
}


const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(
    <InvokeUi baseUrl = {baseUrl}/>
);

//export default InvokeUi

