# 平台与媒体类型接入指南

这份文档用于统一指导 `haodown` 后续新增平台或新增媒体类型时的接入方式。目标不是写“概念说明”，而是沉淀一套能直接照着落代码、补测试、上线验证的项目内规范。

当前已接入矩阵：

| 平台 | 视频 | 图文 | Live Photo |
| --- | --- | --- | --- |
| 今日头条 | 已支持 | 已支持 | 不适用 |
| 抖音 | 已支持 | 已支持 | 不适用 |
| 小红书 | 已支持 | 已支持 | 作为图集增强形态支持 |

## 1. 核心原则

1. 对外只有一个统一提取入口：`POST /api/extract`。
2. 平台差异收敛在 provider 层，不要把平台分支散落到路由、前端或鉴权层。
3. 所有成功响应都遵循统一数据模型，客户端尽量只依赖通用字段。
4. 新平台优先复用现有抽象：`match -> resolve -> extract`。
5. 新媒体类型如果会影响公共返回结构，先补模型，再补 provider，再补前端。

## 2. 当前代码结构

平台接入相关的核心目录如下：

```text
lib/models.ts
lib/providers/types.ts
lib/providers/index.ts
lib/providers/toutiao/
lib/providers/douyin/
lib/providers/xiaohongshu/
app/api/extract/route.ts
tests/
```

职责划分：

- `lib/models.ts`
  定义统一平台、媒体类型、成功响应、错误码、平台能力等公共模型。
- `lib/providers/types.ts`
  定义 `Provider` 接口和 `ExtractionContext`。
- `lib/providers/index.ts`
  平台注册中心，负责 provider 列表和 URL 到 provider 的分发。
- `lib/providers/{platform}/`
  平台自己的匹配、跳转、解析、提取逻辑。
- `app/api/extract/route.ts`
  负责请求校验、统一鉴权/配额、调用 provider。
- `tests/`
  放 provider 注册、平台能力、媒体提取和 live case 的测试。

## 3. 统一接入模型

每个平台都必须实现这个接口：

```ts
export interface Provider {
  readonly descriptor: PlatformDescriptor;
  match(input: URL): boolean;
  resolve(input: URL): Promise<ResolvedMediaTarget>;
  extract(context: ExtractionContext): Promise<ExtractSuccessResult>;
}
```

三个阶段的职责边界：

- `match(input)`
  只判断“这个 URL 是否应该由我处理”，不要做网络请求。
- `resolve(input)`
  把短链、分享链、落地页统一解析成项目内部标准目标：
  - `platform`
  - `canonicalUrl`
  - `contentType`
  - `id`
- `extract(context)`
  真正提取视频或图文资源，输出统一成功响应。

## 4. 新增平台的标准步骤

以新增 `kuaishou` 或 `bilibili` 为例，建议按下面顺序走。

### 4.1 补模型

先在 [lib/models.ts](/Volumes/Data/CodexProjects/VideoDl/lib/models.ts) 中补平台枚举：

```ts
export type SupportedPlatform = "toutiao" | "douyin" | "kuaishou";
```

如果只是新增平台，通常不需要改 `ContentType`。  
如果平台能力不同，要同步考虑：

- `PlatformCapabilities`
- `PlatformDescriptor`
- `limitations`

### 4.2 新建 provider 目录

建议目录结构统一为：

```text
lib/providers/kuaishou/
  index.ts
  shared.ts
  extract-video.ts
  extract-gallery.ts
```

建议职责：

- `shared.ts`
  放 host 列表、跳转跟随、URL 归一化、能力描述、通用常量。
- `index.ts`
  负责组装 provider。
- `extract-video.ts`
  负责视频提取。
- `extract-gallery.ts`
  负责图文提取。

如果平台只有一种媒体类型，也建议预留结构，避免后面再拆。

### 4.3 实现 `shared.ts`

至少应该提供这些能力：

- `HOSTS`：平台 host 列表
- `isXxxHost(hostname)`：判断 URL 是否归属平台
- `followRedirects(input)`：短链跳转
- `normalizeXxxTarget(finalUrl)`：识别媒体类型、提取作品 ID、产出 canonical URL
- `CAPABILITIES`
- `LIMITATIONS`

`normalizeXxxTarget` 的目标是把平台原始 URL 归一化成：

```ts
{
  canonicalUrl: "...",
  contentType: "video" | "gallery",
  id: "..."
}
```

### 4.4 实现 `index.ts`

参考现有头条和抖音 provider，结构保持一致：

```ts
export const xxxProvider: Provider = {
  descriptor: { ... },
  match(input) { ... },
  resolve: resolveXxxUrl,
  extract: extractXxx,
};
```

`extract(context)` 一般只做一层媒体类型分发：

```ts
if (context.contentType === "video") {
  return extractXxxVideo(context);
}

return extractXxxGallery(context);
```

### 4.5 注册到平台中心

在 [lib/providers/index.ts](/Volumes/Data/CodexProjects/VideoDl/lib/providers/index.ts) 中：

1. 引入新的 provider
2. 注册到 `providers` 数组

例如：

```ts
const providers: Provider[] = [toutiaoProvider, douyinProvider, kuaishouProvider];
```

注册后，这个平台会自动影响：

- `POST /api/extract`
- `GET /api/platforms`
- provider registry 测试

## 5. 新增媒体类型的标准步骤

如果未来不是新增平台，而是新增媒体类型，比如：

- `audio`
- `article`
- `live`
- `album`

则要走另一条线。

### 5.1 先判断是否真的需要新 `ContentType`

优先规则：

- 如果只是“图文页多了封面、正文、作者信息”，仍然归到 `gallery`
- 如果只是“视频返回多了字幕、封面、音轨”，仍然归到 `video`
- 只有当返回结构和使用方式明显不同，才新增 `ContentType`

### 5.2 修改公共模型

在 [lib/models.ts](/Volumes/Data/CodexProjects/VideoDl/lib/models.ts) 中：

1. 扩展 `ContentType`
2. 设计对应 payload
3. 扩展 `ExtractSuccessResult`

例如新增 `audio`：

```ts
export type ContentType = "video" | "gallery" | "audio";

export interface AudioPayload {
  url: string;
  durationSeconds: number | null;
  bitrate: number | null;
}

export interface ExtractSuccessResult {
  ...
  audio?: AudioPayload;
}
```

### 5.3 修改 provider 的 `resolve`

平台的 `normalizeXxxTarget()` 必须能够识别新的落地页类型，并返回新的 `contentType`。

### 5.4 修改 provider 的 `extract`

平台入口分发要识别新的媒体类型：

```ts
switch (context.contentType) {
  case "video":
    return extractXxxVideo(context);
  case "gallery":
    return extractXxxGallery(context);
  case "audio":
    return extractXxxAudio(context);
}
```

### 5.5 修改前端展示

首页批量结果展示目前是按视频/图文两种结构组织的。新增媒体类型后，需要同步检查：

- 结果卡片文案
- 复制按钮
- 预览区域
- 错误提示

如果前端暂时不支持新的媒体类型，后端也不要先返回一套没人能消费的结构。

## 6. 成功响应的统一规范

所有 provider 都应返回同一个成功响应形态：

```json
{
  "ok": true,
  "platform": "douyin",
  "contentType": "video",
  "canonicalUrl": "...",
  "title": "...",
  "id": "...",
  "capabilities": { ... },
  "limitations": [ ... ],
  "video": { ... },
  "images": [ ... ],
  "platformMeta": { ... }
}
```

字段约束：

- `platform`
  必须来自 `SupportedPlatform`
- `contentType`
  必须来自 `ContentType`
- `canonicalUrl`
  必须是归一化后的最终作品页，不要返回短链
- `id`
  必须是平台内部作品 ID
- `capabilities`
  尽量复用 `descriptor.capabilities`
- `limitations`
  写用户视角的限制，不写内部实现细节
- `platformMeta`
  只放平台特有诊断信息或附加字段，不要让客户端依赖它做主流程

## 7. 错误处理规范

统一错误码在 [lib/models.ts](/Volumes/Data/CodexProjects/VideoDl/lib/models.ts) 中维护。

常见使用建议：

- `BAD_REQUEST`
  输入里没有有效 URL，或请求体格式错误
- `UNSUPPORTED_PLATFORM`
  URL 不属于任何已注册平台
- `RESOLVE_FAILED`
  平台识别成功，但短链/长链没有归一化成支持的目标页
- `EXTRACT_FAILED`
  平台目标识别成功，但资源提取失败
- `BROWSER_TIMEOUT`
  明确是浏览器等待超时
- `QUOTA_EXCEEDED`
  鉴权或额度限制

建议：

1. 对用户返回统一、可理解的错误文案。
2. 详细诊断信息只打服务端日志，不直接暴露到页面。
3. 不要把平台内部接口名、签名参数、cookie 细节直接返回给用户。

## 8. 平台能力描述规范

每个平台都要定义 `descriptor`，至少包含：

- `platform`
- `displayName`
- `enabled`
- `supportedUrlHosts`
- `capabilities`
- `limitations`

这样 `GET /api/platforms` 才能自然反映真实支持矩阵。

新增平台后，要同步检查首页文案里“支持平台”是否需要更新。

## 9. 测试要求

每新增一个平台，至少补下面几类测试。

### 9.1 注册测试

参考 [tests/provider-registry.test.ts](/Volumes/Data/CodexProjects/VideoDl/tests/provider-registry.test.ts)：

- provider 能被 host 正确匹配
- `listPlatforms()` 能列出平台

### 9.2 媒体提取单测

按媒体类型至少各一份：

- `tests/{platform}-video.test.ts`
- `tests/{platform}-gallery.test.ts`

重点验证：

- URL 归一化
- 媒体资源过滤
- 最佳清晰度排序
- 响应结构完整性

### 9.3 live test

放在 `tests/live/` 下，默认允许跳过，但要保留真实样例。

建议：

- 一条视频样例
- 一条图文样例
- 尽量选择稳定、公开、长期可访问的内容

## 10. 上线前检查清单

新增平台或媒体类型后，至少完成下面检查：

1. `npm test`
2. `npm run build`
3. 本地真实样例验证
4. Vercel preview 验证
5. production 验证
6. 确认 `GET /api/platforms` 已正确反映新能力
7. 确认首页文案、支持平台说明、结果卡片没有遗漏

## 11. 常见踩坑

### 11.1 把平台分支写进路由

错误做法：

- 在 `app/api/extract/route.ts` 里写 `if (douyin) ... else if (toutiao) ...`

正确做法：

- 路由只做通用流程
- 平台差异全部下沉到 provider

### 11.2 让前端依赖 `platformMeta`

`platformMeta` 只能是附加信息，不能成为主流程依赖。  
前端优先消费：

- `platform`
- `contentType`
- `video`
- `images`

### 11.3 直接返回短链

对用户和前端来说，短链不可控、容易过期，也不利于调试。  
统一返回 canonical 作品页和最终资源地址。

### 11.4 平台能力描述和真实实现不一致

比如：

- `contentTypes` 里写了 `gallery`，但代码没有实现图文
- `unwatermarkedVideo` 写 `best-effort`，但实际拿到的是带水印链接

`descriptor` 不是展示文案，而是能力契约，必须和实现一致。

## 12. 推荐接入顺序

如果以后要接更多平台，建议每次只完成一个最小闭环：

1. 先接 `video`
2. 再补 `gallery`
3. 先保证统一返回结构稳定
4. 再做更高质量直链、更多清晰度、更多附加信息

不要一开始同时做：

- 多平台
- 多媒体类型
- 多种登录态限制
- 多种前端展示

这样更容易定位问题，也更容易回归。

## 13. 建议的新增平台模板

可以直接按这个模板新建：

```text
lib/providers/{platform}/
  index.ts
  shared.ts
  extract-video.ts
  extract-gallery.ts
tests/
  {platform}-video.test.ts
  {platform}-gallery.test.ts
tests/live/
  {platform}.live.test.ts
```

最小落地步骤：

1. 在 `lib/models.ts` 补平台枚举
2. 新建 `shared.ts` 做 URL 识别和归一化
3. 新建 `index.ts` 组装 provider
4. 在 `lib/providers/index.ts` 注册
5. 先完成视频或图文中的一种
6. 补 registry test 和对应媒体 test
7. 跑 build/test
8. Vercel 验证

## 14. 文档维护规则

后续每次有下面任何变更，都应该更新这份文档：

- 新增平台
- 新增媒体类型
- 改动统一响应模型
- 改动 provider 接口
- 改动上线 checklist

如果后面平台数量继续增长，可以再把这份文档拆成：

- `doc/provider-extension-guide.md`
- `doc/platform-matrix.md`
- `doc/media-models.md`

当前阶段先保留一份总文档，方便团队快速对齐。
