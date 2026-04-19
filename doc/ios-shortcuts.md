# haodown iOS 快捷指令搭建文档

这份文档对应仓库里的 source spec：

- `public/shortcuts/haodown-ios.shortcut-spec.json`

目标是手动搭出一个 iPhone 快捷指令，完成下面这条完整链路：

1. 启动后读取本地配置。
2. 请求 `GET /api/shortcut/meta` 检查版本和鉴权模式。
3. 如果支持 Token，首次运行时引导输入 Token 并校验。
4. 从分享面板、剪贴板或手动输入中拿到分享文本。
5. 提取第一条 URL，调用 `POST /api/extract`。
6. 按返回结果把视频或图集保存到系统相册。

如果你只是想先搭出可用版，建议先按本文做 `v1`，不要一开始就做太多花活。

## 先决条件

开始前先确认下面几件事：

- 你的服务已经部署好，并且能访问 `https://你的域名/api/platforms`。
- 如果你要启用 Token 模式，项目已经按 `README.md` 配好了 Supabase。
- iPhone 已开启 iCloud Drive，并允许“快捷指令”访问 iCloud Drive。
- 你已经能在 haodown 首页看到自己的 API Token。

建议先在浏览器里手动验证这两个地址：

- `https://你的域名/api/shortcut/meta?currentVersion=1.0.0`
- `https://你的域名/shortcut`

## 这条快捷指令最终长什么样

建议你最终做出 1 个主快捷指令：

- 名称：`haodown iOS 下载`

如果你愿意，也可以多做 1 个辅助快捷指令：

- 名称：`haodown 重设 Token`

主快捷指令建议打开：

- `在共享表单中显示`
- `接收`：`文本`、`URL`

这样它既能从抖音/小红书分享菜单里直接触发，也能单独打开运行。

## 先准备好本地配置文件

本地配置文件固定放这里：

- `iCloud Drive/Shortcuts/haodown/config.json`

默认内容如下：

```json
{
  "shortcutVersion": "1.0.0",
  "baseUrl": "https://your-domain.example.com",
  "apiToken": "",
  "anonymousSessionId": "这里放 UUID"
}
```

建议快捷指令里统一维护这 4 个字段：

- `shortcutVersion`
- `baseUrl`
- `apiToken`
- `anonymousSessionId`

## 建议先创建这些变量

在快捷指令里，建议统一使用下面这些变量名，后面步骤都会直接引用：

- `Config File`
- `Config JSON`
- `Config`
- `Base URL`
- `Shortcut Version`
- `API Token`
- `Anonymous Session ID`
- `Meta Response`
- `Resolved Input`
- `Input Source`
- `First URL`
- `Extract Request Body`
- `Extract Response`
- `Saved Count`

## 第 1 步：创建并读取 `config.json`

这是整个快捷指令最先执行的一段。

### 1.1 检查文件是否存在

依次添加下面这些动作：

1. `获取文件`
2. 路径填写：`Shortcuts/haodown/config.json`
3. 关闭“如果未找到则报错”
4. 把结果命名为 `Config File`

### 1.2 如果文件不存在，就自动创建

紧接着加一个 `如果`：

- 条件：`Config File` `没有任何值`

在“如果”为真分支里放这些动作：

1. `获取 UUID`
2. `文本`
3. 文本内容填：

```json
{
  "shortcutVersion": "1.0.0",
  "baseUrl": "https://your-domain.example.com",
  "apiToken": "",
  "anonymousSessionId": "__UUID__"
}
```

4. `替换文本`
5. 把 `__UUID__` 替换成上一步得到的 UUID
6. `存储文件`
7. 保存到：`Shortcuts/haodown/config.json`
8. 开启“若文件已存在则替换”

这样首次运行时，配置文件会自动落到 iCloud Drive。

### 1.3 读取并拆出配置字段

在 `如果` 结束后，继续添加：

1. `获取文件`
   - 路径：`Shortcuts/haodown/config.json`
2. `获取文件内容`
3. `从输入中获取字典`
4. 结果命名为 `Config`

然后分别取值：

1. `从字典获取值`
   - Key：`baseUrl`
   - 结果命名：`Base URL`
2. `从字典获取值`
   - Key：`shortcutVersion`
   - 结果命名：`Shortcut Version`
3. `从字典获取值`
   - Key：`apiToken`
   - 结果命名：`API Token`
4. `从字典获取值`
   - Key：`anonymousSessionId`
   - 结果命名：`Anonymous Session ID`

## 第 2 步：检查快捷指令版本和鉴权模式

这一段对应：

- `GET /api/shortcut/meta`

### 2.1 发起版本检查请求

添加这些动作：

1. `文本`
2. 内容填：

```text
{Base URL}/api/shortcut/meta?currentVersion={Shortcut Version}
```

如果你在快捷指令里不方便直接拼字符串，也可以用 `URL` + `添加查询参数` 的方式来做。

3. `获取 URL 内容`
   - 方法：`GET`
4. `从输入中获取字典`
5. 结果命名为 `Meta Response`

### 2.2 读取关键字段

从 `Meta Response` 里至少拿这几个值：

- `latestVersion`
- `updateAvailable`
- `installPageUrl`
- `sourceSpecUrl`
- `authModes`

### 2.3 如果发现有新版本，提示是否查看更新

加一个 `如果`：

- 条件：`updateAvailable` `是`

分支里放：

1. `从菜单中选择`
2. 选项一：`继续使用当前版本`
3. 选项二：`查看更新`

在 `查看更新` 分支里：

1. `打开 URL`
2. URL 使用 `installPageUrl`

这里不要结束快捷指令，继续往下跑就行。

## 第 3 步：按 `authModes` 决定是否启用 Token 引导

这个点很重要。

`/api/shortcut/meta` 返回的 `authModes` 会告诉你当前服务支不支持 Token 鉴权：

- 有 `bearer-token`：支持 Token
- 只有 `anonymous-session`：只走匿名模式

所以不要写死“必须输入 Token”，建议按下面的逻辑做。

### 3.1 判断当前环境是否支持 Token

先从 `Meta Response` 里拿到 `authModes`，然后判断它是否包含：

- `bearer-token`

如果快捷指令里判断数组包含不顺手，也可以偷懒一点：

1. `获取字典的 JSON`
2. `如果` 文本里 `包含` `bearer-token`

### 3.2 只有在支持 Token 且本地 Token 为空时，才弹输入框

建议条件写成：

- `支持 bearer-token`
- 并且 `API Token` 为空

满足时再走输入引导。

### 3.3 Token 引导动作链

在条件分支里添加：

1. `从菜单中选择`
2. 选项一：`保存并继续`
3. 选项二：`跳过，使用匿名模式`

如果用户选择 `保存并继续`：

1. `询问输入`
2. 提示语：

```text
请输入 haodown 首页展示的 API Token
```

3. 输入结果命名为 `Candidate Token`

### 3.4 校验 Token

继续添加：

1. `文本`
2. 内容：

```text
{Base URL}/api/shortcut/verify-token
```

3. `获取 URL 内容`
   - 方法：`POST`
   - Header 新增一项：`Authorization`
   - Header 值：`Bearer {Candidate Token}`

4. `从输入中获取字典`
5. 结果命名为 `Verify Response`

### 3.5 校验成功才写回本地配置

如果 `Verify Response.ok` 为 `true`：

1. 把 `Config` 字典里的 `apiToken` 更新成 `Candidate Token`
2. `获取字典的 JSON`
3. `存储文件`
   - 保存到：`Shortcuts/haodown/config.json`
   - 开启“若文件已存在则替换”

写回后，最好顺手把变量 `API Token` 也更新成 `Candidate Token`，免得后面还拿到旧值。

### 3.6 校验失败时怎么处理

如果接口返回失败，推荐给两个分支：

- `重试`
- `跳过匿名模式`

不要把错误 Token 写进 `config.json`。

## 第 4 步：决定输入来源

输入来源顺序固定为：

1. 分享面板输入
2. 剪贴板
3. 手动输入

### 4.1 优先取快捷指令输入

加一个 `如果`：

- 条件：`快捷指令输入` `有任何值`

为真时：

- `Resolved Input = 快捷指令输入`
- `Input Source = share-sheet`

### 4.2 否则取剪贴板

在否则分支里：

1. `获取剪贴板`
2. 再加一个 `如果`
   - 条件：剪贴板内容 `有任何值`

为真时：

- `Resolved Input = 剪贴板内容`
- `Input Source = clipboard`

### 4.3 再否则就手动输入

如果剪贴板也没值：

1. `询问输入`
2. 提示语：

```text
请粘贴或输入抖音 / 头条 / 小红书分享文案或链接
```

3. `Resolved Input = 用户输入`
4. `Input Source = manual`

## 第 5 步：本地先提取第一条 URL

这一步是为了提前挡掉垃圾输入，避免白打一枪请求。

推荐正则：

```text
https?://[^\s<>"'`]+
```

### 5.1 提取 URL

添加：

1. `匹配文本`
   - 输入：`Resolved Input`
   - 正则使用上一节的表达式
2. 取第一个匹配结果
3. 结果命名为 `First URL`

### 5.2 没提取到就直接结束

加一个 `如果`：

- 条件：`First URL` `没有任何值`

分支里：

1. `显示结果`
2. 文案：

```text
未发现有效分享链接
```

3. `停止并输出`

## 第 6 步：请求 `/api/extract`

这一段对应：

- `POST /api/extract`

### 6.1 组装请求体

先用 `字典` 动作组出这个 JSON：

```json
{
  "text": "Resolved Input",
  "anonymousSessionId": "Anonymous Session ID",
  "options": {
    "preferUnwatermarked": true,
    "preferHighestQuality": true
  },
  "client": {
    "shortcutVersion": "Shortcut Version",
    "inputSource": "Input Source"
  }
}
```

注意两点：

- `text` 传原始分享文本，不是只传 `First URL`
- 匿名模式也照样传 `anonymousSessionId`

### 6.2 请求头怎么带

如果 `API Token` 有值：

- `Content-Type: application/json`
- `Authorization: Bearer {API Token}`

如果 `API Token` 没值：

- 只带 `Content-Type: application/json`

### 6.3 发请求

添加：

1. `文本`
2. 内容：

```text
{Base URL}/api/extract
```

3. `获取 URL 内容`
   - 方法：`POST`
   - 请求体：上一步字典转 JSON
   - Header 按上一节规则设置
4. `从输入中获取字典`
5. 结果命名为 `Extract Response`

## 第 7 步：处理接口异常

建议优先看：

- `ok`
- `code`
- `message`

### 7.1 `UNAUTHORIZED`

如果 `code = UNAUTHORIZED`：

推荐提示：

```text
当前 Token 无效或已失效
```

然后给两个选项：

- `重设 Token`
- `继续匿名模式`

### 7.2 `QUOTA_EXCEEDED`

如果 `code = QUOTA_EXCEEDED`：

直接显示接口返回的 `message` 即可。

### 7.3 其他异常

统一显示：

- `message`

如果没有 `message`，就显示一个兜底文案：

- `解析失败，请稍后重试`

## 第 8 步：按内容类型保存到相册

接口成功时，关键字段包括：

- `platform`
- `title`
- `contentType`
- `video.best.url`
- `images[].url`

### 8.1 保存视频

当 `contentType = video`：

1. 取 `video`
2. 再取 `best`
3. 再取 `url`
4. `获取 URL 内容`
5. `存储到照片相簿`
6. `Saved Count = 1`

### 8.2 保存图集

当 `contentType = gallery`：

1. 取 `images`
2. `将数字设为`
   - 值：`0`
   - 命名：`Saved Count`
3. `重复每一项`
4. 每次循环里：
   - 取当前项的 `url`
   - `获取 URL 内容`
   - `存储到照片相簿`
   - `将数字增加`

当前版本先只保存静态图片。

也就是说：

- 如果图片项里还有 `motionUrl`
- 暂时忽略，不做 Live Photo

## 第 9 步：结束时给一个成功提示

建议最后用 `文本` 拼一个结果，然后 `显示结果`：

```text
已保存完成
平台：{platform}
标题：{title}
数量：{Saved Count}
```

如果你更喜欢轻一点的提示，也可以改成：

- `显示通知`

## 可选：做一个“重设 Token”快捷指令

你可以复制主快捷指令，删掉下载流程，只保留下面几步：

1. 读取 `config.json`
2. 把 `apiToken` 改成空字符串
3. 写回 `config.json`
4. 重新走一遍“Token 引导”和“Token 校验”

这样以后 Token 失效时不用改主流程。

## 推荐你实际搭建时的顺序

如果你不想一口气全做完，按这个顺序最稳：

1. 先做“读取配置”
2. 再做“输入来源 + URL 提取”
3. 再做“`/api/extract` 请求”
4. 确认视频和图集都能存到相册
5. 最后补“版本检查”
6. 最后再补“Token 校验”

这样每一步都能单独验证，不容易卡死在长链路里。

## 接口对照表

- 版本检查：`GET /api/shortcut/meta`
- Token 校验：`POST /api/shortcut/verify-token`
- 内容提取：`POST /api/extract`

## 对照当前仓库实现时要注意的点

- 推荐快捷指令 ID：`haodown-ios`
- 推荐版本号：`1.0.0`
- 安装页路径：`/shortcut`
- source spec 路径：`/shortcuts/haodown-ios.shortcut-spec.json`
- 当前支持的平台 host 会由 `/api/shortcut/meta` 动态返回

## 排错建议

如果你搭完后发现跑不通，优先检查下面 6 件事：

1. `Base URL` 末尾不要多写 `/`
2. `config.json` 是否真的写到了 `iCloud Drive/Shortcuts/haodown/config.json`
3. `Resolved Input` 里是否真的包含完整分享文案
4. `First URL` 是否成功匹配出第一条链接
5. `Authorization` Header 是否错误地带了空值
6. 相册权限是否已经授权给“快捷指令”

## 备注

- 当前仓库里的 `shortcuts` CLI 只能 `run / list / view / sign`，还不能直接生成完整快捷指令文件。
- 所以目前最现实的交付方式仍然是：
  - 服务端接口
  - 安装页
  - source spec
  - 这份手动搭建文档
