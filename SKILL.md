---
name: invoke-interface-config
description: Configure and publish JSON API forwarding interfaces for this project by directly operating the invoke_info table, refreshing runtime Redis cache through /invokeInfo/refreshCache, and setting up normal /invoke/{name} or streaming /stream/{invokeName}/{activeMethod} endpoints. Use when an agent needs to create, update, verify, or troubleshoot API Configuration and Callable API records for this Node/Egg service.
---

# Invoke Interface Configuration

Configure third-party JSON interfaces and publish callable APIs by operating the project database directly.

## Goal

Use the `invoke_info` table to create two kinds of records:

- `invokeType = '1'`: API Configuration. Describes how to call an upstream third-party interface and how to transform its response.
- `invokeType = '2'`: Callable API. Publishes a new external POST interface under `/invoke/{name}` and links one or more API Configuration records.

After writing database records, call the cache refresh endpoint so the new configuration becomes active.

## Required User Input

Ask the user for the following information before making changes:

```yaml
database:
  host: "<mysql-host>"
  port: 3306
  user: "<mysql-user>"
  password: "<mysql-password>"
  database: "<mysql-database>"
redis:
  host: "<redis-host>"
  port: 6379
  password: "<redis-password-or-empty>"
  db: 0
service:
  base_url: "http://127.0.0.1:7001"
api_configuration:
  systemId: "1"
  name: "<unique_upstream_config_name>"
  description: "<human_readable_description>"
  groupName: "<group_name>"
  method: "GET|POST|PUT|DELETE"
  url: "@baseUrl/path/or/full/upstream/url"
  headers:
    Accept: "application/json"
    Content-Type: "application/json;charset=UTF-8"
  body:
    exampleParam: "@exampleParam"
  parseFun: |
    function paraphraseFun(resObj, resHead, resStatus, reqHead, reqBody, url) {
      return resObj;
    }
  enableLog: "0"
callable_api:
  name: "<published_api_name>"
  description: "<human_readable_description>"
  groupName: "<group_name>"
  parseFun: |
    function paraphraseFun(obj, reqBody) {
      return this.defaultValue(obj);
    }
```

Use the real values supplied by the user at execution time. Do not hard-code production credentials in this file.

## Table Schema

The main table is `invoke_info`.

```sql
CREATE TABLE invoke_info (
  id int(4) NOT NULL AUTO_INCREMENT,
  systemId varchar(20) DEFAULT NULL,
  name varchar(100) DEFAULT NULL,
  descrption varchar(200) DEFAULT NULL,
  method varchar(10) DEFAULT NULL,
  url varchar(200) DEFAULT NULL,
  head text DEFAULT NULL,
  body text DEFAULT NULL,
  parseFun text DEFAULT NULL,
  orginalResult longtext DEFAULT NULL,
  next varchar(50) DEFAULT NULL,
  invokeType char(1) DEFAULT NULL,
  groupName varchar(50) DEFAULT NULL,
  enableLog varchar(2) DEFAULT NULL,
  PRIMARY KEY (id)
);
```

Important field rules:

- `name` must be globally unique.
- `descrption` is intentionally misspelled in the schema; use this column name exactly.
- `head` and `body` are JSON strings.
- `parseFun` is a JavaScript function string.
- `next` stores comma-separated `invoke_info.id` values, not names.
- `enableLog = '1'` records calls in `invoke_log`; `enableLog = '0'` disables logging.
- `@baseUrl` is replaced from `config.systemInfo` according to `systemId`.
- `@paramName` placeholders in `url`, `head`, and `body` are replaced from the request body when invoked.

## Configure An API Configuration

Create or update an upstream API Configuration with `invokeType = '1'`.

Example insert:

```sql
INSERT INTO invoke_info
  (systemId, name, descrption, method, url, head, body, parseFun, orginalResult, next, invokeType, groupName, enableLog)
VALUES
  (
    '1',
    'transform_city',
    'Query city list and normalize response',
    'POST',
    '@baseUrl/invoke/mock_city',
    '{"Accept":"application/json","Content-Type":"application/json;charset=UTF-8"}',
    '{"provinceId":"@provinceId","requestField":"@requestField"}',
    'function paraphraseFun(resObj, resHead, resStatus, reqHead, reqBody, url) { return resObj.map(function (o) { return { id: o.id, name: o.name, requestField: reqBody.requestField }; }); }',
    NULL,
    NULL,
    '1',
    'example',
    '0'
  );
```

For an existing record, update by `name`:

```sql
UPDATE invoke_info
SET
  systemId = '1',
  descrption = 'Query city list and normalize response',
  method = 'POST',
  url = '@baseUrl/invoke/mock_city',
  head = '{"Accept":"application/json","Content-Type":"application/json;charset=UTF-8"}',
  body = '{"provinceId":"@provinceId","requestField":"@requestField"}',
  parseFun = 'function paraphraseFun(resObj, resHead, resStatus, reqHead, reqBody, url) { return resObj; }',
  next = NULL,
  invokeType = '1',
  groupName = 'example',
  enableLog = '0'
WHERE name = 'transform_city';
```

## Publish A Callable API

Create or update a Callable API with `invokeType = '2'`. Its `next` field links to one or more API Configuration IDs.

First resolve linked configuration IDs:

```sql
SELECT id, name FROM invoke_info WHERE name IN ('transform_city', 'transform_district');
```

Then insert the Callable API:

```sql
INSERT INTO invoke_info
  (systemId, name, descrption, method, url, head, body, parseFun, orginalResult, next, invokeType, groupName, enableLog)
VALUES
  (
    '1',
    'transform_data',
    'Published API for normalized city or district data',
    'POST',
    '',
    '{}',
    '{}',
    'function paraphraseFun(obj, reqBody) { return this.defaultValue(obj); }',
    NULL,
    '101,102',
    '2',
    'example',
    '0'
  );
```

After this record is active, callers can use:

```bash
curl -X POST 'http://127.0.0.1:7001/invoke/transform_data' \
  -H 'Content-Type: application/json' \
  -d '{"activeMethod":"transform_city","provinceId":"500000","requestField":"some value"}'
```

Notes:

- If `activeMethod` is omitted, all records listed in `next` are called.
- If `activeMethod` is a string, only the matching API Configuration name is called.
- If `activeMethod` is an array, matching API Configuration records are called in parallel.
- The Callable API parse function receives the combined result object and can use helper functions on `this`.

## Parse Function Contracts

API Configuration parse function signature:

```js
function paraphraseFun(resObj, resHead, resStatus, reqHead, reqBody, url) {
  return resObj;
}
```

Callable API parse function signature:

```js
function paraphraseFun(obj, reqBody) {
  return this.defaultValue(obj);
}
```

Available helpers in Callable API parse functions:

- `this.defaultValue(obj, keyName)`: returns the first result value, or the first key starting with `keyName`.
- `this.keyList(obj, keyName)`: flattens all result arrays whose keys start with `keyName`.
- `this.preciseMultiply(num1, num2)`: multiplies decimal numbers while avoiding common floating-point precision issues.

Available helpers in API Configuration parse functions:

- `this.addToParent(childName)`: when assembling nested interfaces, attach the current result to the parent object under `childName`.
- `this.preciseMultiply(num1, num2)`: same decimal multiplication helper.

## Configure Streaming AI Interfaces

The project also supports streaming AI gateway calls through `aiStream.js`.

Streaming routes:

```text
POST /stream/:invokeName/:activeMethod
POST /stream/:invokeName/:activeMethod/v1/chat/completions
POST /stream/:invokeName/:activeMethod/v1/messages
```

Route meaning:

- `invokeName`: the Callable API name. This record must have `invokeType = '2'` and a non-empty `next`.
- `activeMethod`: the API Configuration name selected from the Callable API `next` records.
- The selected API Configuration provides the upstream `url`, `method`, `head`, `body`, `parseFun`, `systemId`, and `enableLog`.

Typical database layout:

```text
Callable API: name = anthropic, invokeType = '2', next = '<openai_config_id>,<other_config_id>'
API Configuration: name = minimax, invokeType = '1', url = '@baseUrl/v1/chat/completions'
```

Then callers use:

```bash
curl -N -X POST '<service.base_url>/stream/anthropic/minimax/v1/messages' \
  -H 'Content-Type: application/json' \
  -d '{"model":"example-model","messages":[{"role":"user","content":"hello"}]}'
```

The stream service builds the upstream request this way:

- It loads the Callable API by `invokeName` from Redis.
- It loads all records listed in `callerEntity.next`.
- It selects the API Configuration whose `name` equals `activeMethod`.
- It replaces `@xxx` placeholders in `url`, `head`, and `body`.
- If `body` is exactly `{}`, it forwards the caller request body as the upstream body.
- It injects `stream: true` into the upstream body automatically.
- It removes internal `baseUrl` before sending the upstream request.
- If `requestBody.system` is an Anthropic-style text block array, it converts it into a newline-joined string.
- It removes `output_config`, because the current MiniMax upstream handling does not support that Anthropic-specific field.

Streaming API Configuration example:

```sql
INSERT INTO invoke_info
  (systemId, name, descrption, method, url, head, body, parseFun, orginalResult, next, invokeType, groupName, enableLog)
VALUES
  (
    '1',
    'minimax',
    'MiniMax OpenAI-compatible streaming endpoint',
    'POST',
    '@baseUrl/v1/chat/completions',
    '{"Authorization":"Bearer @apiKey","Content-Type":"application/json"}',
    '{}',
    NULL,
    NULL,
    NULL,
    '1',
    'ai',
    '0'
  );
```

Streaming Callable API example:

```sql
INSERT INTO invoke_info
  (systemId, name, descrption, method, url, head, body, parseFun, orginalResult, next, invokeType, groupName, enableLog)
VALUES
  (
    '1',
    'anthropic',
    'Anthropic-compatible streaming gateway',
    'POST',
    '',
    '{}',
    '{}',
    NULL,
    NULL,
    '<minimax_config_id>',
    '2',
    'ai',
    '0'
  );
```

For streaming routes, the Callable API `parseFun` is not used by `aiStream.js`; transformation is applied with the selected API Configuration `parseFun`.

Streaming parse function signature:

```js
function transformStreamChunk(chunk, resHead, resStatus, reqHead, reqBody, url) {
  return chunk;
}
```

Streaming parse function behavior:

- The function is called once for every parsed upstream SSE `data: ...` JSON chunk.
- `this` is a persistent per-request state object, so the function can store cross-chunk state such as block indexes or accumulated flags.
- Return `null` or `undefined` to skip the current chunk.
- Return one object to write one `data: <json>` SSE event.
- Return an array to write multiple SSE events.
- If a returned item has a `type` field, the service also writes `event: <type>` before its `data` line.
- When the upstream sends `data: [DONE]`, the service forwards `data: [DONE]`.

OpenAI-to-Anthropic streaming conversion:

- The helper file [openai2anthropic.js](/Users/syu/project/node/rest/svc/app/parseFuns/openai2anthropic.js:1) contains a parse function for converting OpenAI streaming chunks to Anthropic streaming events.
- Store `openai2anthropic.toString()` in the selected API Configuration `parseFun` field.
- This is useful when `/stream/anthropic/:activeMethod/v1/messages` should expose an Anthropic-compatible stream while the upstream is OpenAI-compatible.

Streaming logs:

- If the selected API Configuration has `enableLog = '1'`, the service writes one row to `invoke_log` at stream end.
- By default, the log response is a merged final message parsed from stream chunks.
- If request headers include `"rawLog": true` in the configured `head`, the log response stores raw chunk objects instead.
- Log `key` comes from `requestHead.logKey`, so configure `"logKey":"@someRequestField"` when searchable logs are needed.

## Assemble Multiple Interfaces

To chain upstream interfaces, put child API Configuration IDs in the parent API Configuration `next` field.

Example:

```sql
UPDATE invoke_info
SET next = '202'
WHERE name = 'assemble_province';

UPDATE invoke_info
SET next = '203'
WHERE name = 'assemble_city';

UPDATE invoke_info
SET next = '201'
WHERE name = 'assemble_all';
```

The chaining behavior only continues when the current parsed result is an array. For each array item, the service copies request parameters from matching fields in that item into the child request.

Example parent parse function that prepares a child parameter:

```js
function paraphraseFun(resObj, resHead, resStatus, reqHead, reqBody, url) {
  return resObj.map(function (o) {
    return Object.assign({ provinceId: o.id }, o);
  });
}
```

## Refresh Runtime Cache

The service reads `invoke_info` into Redis at startup:

- Redis string key: `invokeEntityKeyMap`
- Redis hash key: `invokeEntitys`

When the agent writes directly to MySQL, it must refresh Redis by calling the backend refresh endpoint:

```bash
curl -X POST '<service.base_url>/invokeInfo/refreshCache'
```

The endpoint deletes the old Redis cache, reloads all rows from `invoke_info`, rebuilds `invokeEntityKeyMap`, and writes every row into the `invokeEntitys` hash.

Expected response:

```json
{
  "success": true,
  "total": 3,
  "names": ["transform_city", "transform_district", "transform_data"]
}
```

## Verification

After creating or updating records:

1. Confirm the row exists:

```sql
SELECT id, name, invokeType, next, groupName, enableLog
FROM invoke_info
WHERE name IN ('transform_city', 'transform_data');
```

2. Confirm the published endpoint exists by calling the Callable API:

```bash
curl -X POST '<service.base_url>/invoke/<callable_api.name>' \
  -H 'Content-Type: application/json' \
  -d '<request-json>'
```

3. For streaming APIs, confirm the stream endpoint:

```bash
curl -N -X POST '<service.base_url>/stream/<callable_api.name>/<api_configuration.name>' \
  -H 'Content-Type: application/json' \
  -d '<request-json>'
```

4. If `enableLog = '1'`, confirm logs:

```sql
SELECT id, name, groupName, `key`, code, date
FROM invoke_log
WHERE name = '<api_configuration.name>'
ORDER BY date DESC
LIMIT 10;
```

## Agent Checklist

Before writing:

- Confirm database and Redis connection details.
- Confirm whether to insert new records or update existing records.
- Confirm unique `name` values.
- For streaming APIs, confirm the Callable API `next` contains the selected API Configuration ID.
- Validate that `head` and `body` are valid JSON strings.
- Validate that `parseFun` is a complete JavaScript function expression.

After writing:

- Resolve and verify IDs used in `next`.
- Call `POST <service.base_url>/invokeInfo/refreshCache`.
- Call the published `/invoke/{name}` endpoint.
- Report the created or updated names, IDs, endpoint URL, and test result.
