


export function request(method, url, body) {
    method = method.toUpperCase();
    let params;
    if (method === 'GET') {
        params = body;
        body = undefined;
    } else {
        body = body //&& JSON.stringify(body);
    }
    return fetch(url,{
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'access_token': sessionStorage.getItem('access_token') || '',// 从sessionStorage中获取access token
        },
        body: JSON.stringify(body),
    }).then((res) => {
        if (res.status === 401) {
            console.log('token失效!!');
            //essionStorage.clear();
            return Promise.reject('Unauthorized.');
        } else {
            // const token = res.headers['access-token'];
            // if (token) {
            //     sessionStorage.setItem('access-token', token);
            // }
            return res.json();
        }
    }).catch((err) => {
        if (err.response.status === 401) {
            console.log('token失效!!');
            sessionStorage.clear();
            return Promise.reject('Unauthorized.');
        }
    });
}

export const get = (url, body) => request('GET', url, body);
export const post = (url, body) => request('POST', url, body);
export const put = (url, body) => request('PUT', url, body);
export const del = (url, body) => request('DELETE', url, body);