# 用 HTTP 和 WebSocket 调用会话

PI WEB 页面上的新建会话、发消息、流式输出和中断，都走同一套 HTTP / WebSocket。外层脚本使用这套接口即可，不必再启动 `pi --mode rpc`。

浏览器地址里的查询参数就是调用所需的身份。例如：

```text
http://localhost:3419/?project=<project-id>&workspace=<workspace-id>&session=<session-id>&view=chat
```

- `project` 是项目 id。
- `workspace` 是当前 Branch 的 workspace id。
- `session` 是已有会话 id。新建会话时先不要用它。

开发时打开的是 Vite 端口 `3419`，`/api` 会代理到 Web/API 端口 `3418`。正式运行时界面和 API 在同一个地址上。下面的例子统一用浏览器里打开的那个地址，并写成 `http://localhost:3419`。

会话接口在本机机器下的前缀是 `/api/machines/local`。每次会话请求都要带该 Branch 的目录路径 `cwd`，不能只带 workspace id。

## 1. 取出当前 Branch 的目录

```sh
curl -s "http://localhost:3419/api/machines/local/projects/<project-id>/workspaces"
```

在返回的 `workspaces` 里找到 `id` 等于 `<workspace-id>` 的那一项，使用它的 `path`。后面用 `$CWD` 表示这个路径。

## 2. 在这个 Branch 下新建会话

```sh
curl -s -X POST "http://localhost:3419/api/machines/local/sessions" \
  -H 'content-type: application/json' \
  -d "{\"cwd\":\"$CWD\"}"
```

成功时响应里有新会话的 `id`。把浏览器地址中的 `session` 换成这个 id，即可在页面上打开它。

## 3. 先连接事件流

`POST /prompt` 只表示请求已被接受，回复文字从 WebSocket 推送。要收到这一轮的完整输出，先连接，再发问题。

```text
ws://localhost:3419/api/machines/local/sessions/<session-id>/events?cwd=<百分号编码后的 $CWD>
```

每条消息是一个 JSON 对象。和这次调用直接相关的类型：

| `type` | 含义 |
| --- | --- |
| `message.append` | 用户消息已进入会话 |
| `agent.start` | 这一轮开始 |
| `assistant.thinking.delta` | 思考文本增量 |
| `assistant.delta` | 回复文本增量，把 `text` 依次拼起来 |
| `agent.end` | 这一轮结束 |
| `session.error` | 这一轮失败 |

结束后也可以读取完整记录。查询参数里的 `cwd` 需要做百分号编码：

```sh
curl -s "http://localhost:3419/api/machines/local/sessions/<session-id>/messages?cwd=<百分号编码后的 $CWD>&limit=20"
```

## 4. 发送第一个问题

```sh
curl -s -X POST "http://localhost:3419/api/machines/local/sessions/<session-id>/prompt" \
  -H 'content-type: application/json' \
  -d "{\"cwd\":\"$CWD\",\"text\":\"你是谁？请只用一句话回答。\"}"
```

成功响应是 `{"accepted":true}`。然后等待 WebSocket 上的 `assistant.delta`，直到 `agent.end`。

## 5. 在同一会话里追问

上一轮已经结束时，再向同一个地址 POST 一次即可：

```sh
curl -s -X POST "http://localhost:3419/api/machines/local/sessions/<session-id>/prompt" \
  -H 'content-type: application/json' \
  -d "{\"cwd\":\"$CWD\",\"text\":\"你刚才那句话里，你的名字是什么？请只用一句话回答。\"}"
```

上一轮仍在运行时，在 JSON 里加上 `streamingBehavior`：

- `followUp`：排到当前这一轮后面。
- `steer`：插入当前正在运行的这一轮。

## 6. 中断当前运行

```sh
curl -s -X POST "http://localhost:3419/api/machines/local/sessions/<session-id>/abort" \
  -H 'content-type: application/json' \
  -d "{\"cwd\":\"$CWD\"}"
```

成功响应是 `{"aborted":true}`。

## 一次可复制的顺序

1. 从页面 URL 取出 `project` 和 `workspace`。
2. `GET .../projects/<project-id>/workspaces`，得到当前 Branch 的 `path`。
3. `POST .../sessions`，body 为 `{ "cwd": "<path>" }`，保存返回的 `id`。
4. 连接 `.../sessions/<id>/events?cwd=...`。
5. `POST .../sessions/<id>/prompt`，body 为 `{ "cwd": "<path>", "text": "..." }`。
6. 拼接 `assistant.delta`，直到 `agent.end`。
7. 再次 POST `/prompt` 进行追问。
8. 需要停止时 POST `/abort`。
