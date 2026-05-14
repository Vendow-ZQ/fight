# 赛博斗蛐蛐 — 技术实现与设计逻辑

## 项目定位

**赛博斗蛐蛐** 是一个基于大语言模型的多 Agent 实时辩论系统。用户输入一个辩题，选择 2-4 位预设的中文互联网 KOL（Key Opinion Leader），系统会驱动这些 AI 人格就该话题展开多轮实时对战。

核心设计理念：**把 LLM 从"你问我答"的工具形态，变成一种可观赏的对抗性内容生产引擎。** 用户不再是提问者，而是一场观点格斗赛的导演和观众。

---

## 架构概览

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                │
│  HomePage → BattlePage → ResultPage                      │
│  SSE Consumer / Streaming Text Renderer                  │
└──────────────────────┬───────────────────────────────────┘
                       │  HTTP + SSE (Server-Sent Events)
                       ▼
┌──────────────────────────────────────────────────────────┐
│                 Backend (FastAPI + Uvicorn)               │
│  /api/battle/start   → 创建 BattleManager 实例           │
│  /api/battle/:id/stream → SSE 流式推送多轮辩论           │
│  /api/battle/:id/inject → 注入用户观点                   │
│  /api/battle/:id/continue → 追加一轮辩论                 │
│  /api/battle/:id/summarize → AI 总结各方观点              │
└──────────────────────┬───────────────────────────────────┘
                       │  Anthropic SDK (streaming)
                       ▼
┌──────────────────────────────────────────────────────────┐
│              Claude API (bedrock-claude-sonnet)           │
│  每个 Agent 独立 system prompt + 共享对话历史             │
└──────────────────────────────────────────────────────────┘
```

前后端分离，Vite 开发服务器通过 proxy 将 `/api` 请求转发到 FastAPI 后端（端口 8000）。

---

## 核心设计决策

### 1. 多 Agent 对话的上帝视角架构

这是整个系统最关键的设计决策。

**问题**：Claude API 是单轮对话模型——每次请求只有一个 `system` + 一组 `messages`。如何让多个"人格"在同一个辩论场中互相感知、互相回应？

**解法**：`BattleManager` 维护一个 **全局共享的 `battle_history`**（上帝视角），但在调用每个 Agent 时，将历史**转译**为该 Agent 的第一人称视角：

```python
# battle_manager.py: build_messages_for()
for turn in self.battle_history:
    if turn["speaker"] == agent_id:
        messages.append({"role": "assistant", "content": turn["text"]})  # 自己说的 → assistant
    elif turn["speaker"] == "__user__":
        messages.append({"role": "user", "content": f"[观众]: {turn['text']}"})  # 观众 → user
    else:
        speaker_name = PERSONAS[turn["speaker"]]["name"]
        messages.append({"role": "user", "content": f"[{speaker_name}]: {turn['text']}"})  # 对手 → user
```

**设计意图**：
- 每个 Agent 看到的对话历史中，自己的发言是 `assistant`，其他所有人的发言（包括对手和观众）都是 `user`。这利用了 Claude 的 assistant/user 角色机制——模型天然会"接着 assistant 的话说"，并"回应 user 的内容"。
- 观众（用户注入的观点）被标记为 `[观众]` 前缀，与对手发言区分。
- 当最后一条消息恰好是当前 Agent 自己的发言时，会追加一条 `"（轮到你回应了）"` 提示，避免模型重复自己。

### 2. Persona 系统：不只是提示词，是认知建模

每个 KOL 的 `system_prompt` 不是简单的"你是XX，请模仿他说话"。而是一套完整的**认知模型文档**，包含：

| 层次 | 内容 | 作用 |
|------|------|------|
| **身份背景** | 籍贯、学历、关键人生节点 | 锚定人格底色 |
| **心智模型** | 3-5 个核心世界观框架 | 决定面对任何话题时的推理路径 |
| **决策启发式** | 具体的判断规则 | 让回答有"条件反射"感 |
| **经典语录库** | 真实出处的原话 | 提供表达锚点，避免漂移 |
| **说话风格DNA** | 句式、语气词、口头禅、节奏 | 控制输出的语言质感 |
| **攻击模式** | 对线时的策略链 | 让辩论有对抗性而非各说各话 |
| **内在矛盾** | 人格的自相矛盾之处 | 增加真实感和戏剧性 |
| **约束规则** | 字数限制、必须包含的要素 | 工程约束，确保输出可控 |

以常熟阿诺为例，甚至建模了其**认知缺陷**（工作记忆容量、注意力持续时间、逻辑能力水平），并设计了**错别字系统**（形似字替换规则）和**情绪触发词机制**。这使得该角色的输出不只是"模仿说话方式"，而是从认知层面复现了一种特定的思维模式。

### 3. 发言长度的动态控制

用户可以选择 `short`/`standard`/`long` 三档篇幅，系统通过**双重控制**实现：

```python
# battle_manager.py
LENGTH_CHAR_LIMITS = {"short": 100, "standard": 200, "long": 400}

def _adjusted_system_prompt(self, agent_id: str) -> str:
    prompt = PERSONAS[agent_id]["system_prompt"]
    return re.sub(r"每次发言不超过\s*\d+\s*字", f"每次发言不超过 {self.char_limit} 字", prompt)
```

- **Prompt 层**：正则替换 system prompt 中的字数约束
- **Token 层**：`max_tokens` 参数同步调整（short=300, standard=600, long=1200）

这是一种务实的策略：LLM 对"不超过200字"的指令遵从度不稳定，但配合 `max_tokens` 硬截断可以兜底。

### 4. SSE 流式传输：逐 Token 推送

辩论过程通过 Server-Sent Events 实时推送，定义了 6 种事件类型：

```
round_start  → 新一轮开始
agent_start  → 某个 Agent 开始发言
token        → 逐 token 流式输出
agent_done   → 某个 Agent 发言完毕（附完整文本）
round_end    → 当前轮结束
battle_end   → 所有轮次结束
```

**设计意图**：
- `token` 事件实现了"打字机效果"的实时体验，用户可以看到每个 Agent 的发言逐字出现
- `agent_done` 事件携带完整文本，用于替换流式拼接的文本（避免 UTF-8 拆字等边界问题）
- 前端使用 `EventSource`（初始流）和 `fetch + ReadableStream`（继续对局）两种方式消费 SSE，因为 `EventSource` 只支持 GET，而 `continue` 接口是 POST

后端的 `_stream_rounds` 是一个同步生成器，直接 `yield` SSE 格式的字符串：

```python
for chunk in bm.agent_speak_stream(agent_id):
    yield sse_event("token", {"agent_id": agent_id, "token": chunk})
```

这依赖 FastAPI 的 `StreamingResponse` 对同步生成器的支持，底层由 Uvicorn 的异步事件循环驱动。

### 5. 用户介入机制：观众席投石

辩论进行中，用户可以通过 `inject` 接口投入自己的观点：

```python
def inject_user_opinion(self, text: str):
    self.battle_history.append({"speaker": "__user__", "text": text})
```

用户观点被追加到全局历史后，下一轮所有 Agent 都会在各自的 `messages` 中看到 `[观众]: xxx`，并据此调整回应。这让用户从旁观者变成参与者——你可以挑衅某个 Agent，或者抛出新的论据改变辩论走向。

### 6. 对局后 AI 总结

`/summarize` 接口为每个 Agent 单独生成观点总结：

```python
system="你是一个中立的观点总结助手。请把以下辩手的所有发言总结成简洁的 bullet point 观点列表。"
```

这是一个独立的 LLM 调用，使用中立的 system prompt（而非辩手人格），确保总结客观。通过 `asyncio.run_in_executor` 在线程池中执行阻塞的 Anthropic SDK 调用，避免阻塞 FastAPI 的事件循环。

---

## 前端技术实现

### 页面流转

```
HomePage  ──[Let Them Fight!]──▸  BattlePage  ──[结束对局]──▸  ResultPage
                                      │                           │
                                      ◂───────[返回对局]──────────┘
                                      │
              ◂───────[返回首页]───────┘
```

使用 React `useState` 驱动的手动路由（非 react-router），三个页面通过 `page` 状态切换。`BattlePage` 挂载后不卸载（`display: contents/none`），保持 SSE 连接和滚动位置。

### 流式文本渲染（StreamingText 组件）

```tsx
// 核心思路：增量 DOM 操作，避免 React re-render
useEffect(() => {
    const newChars = text.slice(prev)
    const span = document.createElement('span')
    span.textContent = newChars
    span.style.animation = 'token-fade 0.15s ease-out'
    el.insertBefore(span, cursor)
}, [text])
```

直接操作 DOM 而非依赖 React 的 virtual DOM diff，避免高频 token 事件导致的渲染性能问题。每个新 token 创建独立的 `<span>` 并附加淡入动画。

### KOL 选择卡片轮播（KolCarousel）

扇形排列的卡片，通过预定义的位置矩阵实现：

```tsx
const ROT    = [-20, -10,  0,  10,  20]    // 旋转角度
const X_OFF  = [-320, -160,  0,  160,  320] // 水平偏移
const Y_SINK = [180,  100,  60,  100,  180] // 下沉量
const SCALE  = [0.75, 0.87, 1.0, 0.87, 0.75] // 缩放
```

选中的卡片显示玩家编号（1P/2P/3P/4P）和对应颜色的发光边框，最多支持 4 人同台。

### 自定义光标系统（CursorEffects）

全局隐藏原生光标（`cursor: none !important`），替换为十字准星 + 粒子拖尾：

- **十字准星**：由水平线、垂直线、中心点、悬停环组成，hover 交互元素时缩小并发光
- **粒子拖尾**：25 个粒子对象池，每 20ms 回收一个粒子到鼠标位置，通过 `requestAnimationFrame` 驱动衰减动画
- 粒子不使用 React 状态管理，全部通过 `ref` + 直接 DOM 操作实现，保证 60fps

### 话题气泡无限滚动（TopicStrip）

预设话题列表三倍复制实现伪无限滚动：

```tsx
const tripled = [...topics, ...topics, ...topics]
```

滚动到边界时跳转到中间副本（`clampScroll`），支持鼠标拖拽和滚轮操作。拖拽时通过 `moved` 标志区分拖拽和点击，避免误触。

### Reaction 按钮（emoji 粒子爆炸）

点击反应按钮时，在按钮位置创建 6-10 个 emoji DOM 元素，通过 CSS 变量 + `@keyframes` 驱动随机方向的飞散动画，750ms 后自动移除。

---

## 数据流

```
用户点击 "Let Them Fight!"
    │
    ▼
POST /api/battle/start
    → 创建 BattleManager，生成 battle_id
    → battles[battle_id] = bm（内存存储）
    │
    ▼
GET /api/battle/{id}/stream
    → StreamingResponse + SSE
    → 每轮依次调用每个 Agent:
        → build_messages_for(agent_id)  // 转译为该 Agent 视角
        → client.messages.stream(...)    // Claude streaming API
        → yield token events             // 逐 token 推送
    │
    ▼
用户输入观点
    │
    ▼
POST /api/battle/{id}/inject
    → battle_history.append(user_opinion)
    │
    ▼
POST /api/battle/{id}/continue
    → 追加一轮 SSE 流
    │
    ▼
POST /api/battle/{id}/summarize
    → 为每个 Agent 独立调用 Claude 生成观点总结
    → 返回 JSON
```

---

## 技术栈

| 层 | 技术 | 选型理由 |
|----|------|----------|
| **LLM** | Claude (bedrock-claude-sonnet) via Anthropic SDK | 原生 streaming 支持，中文质量好 |
| **后端** | FastAPI + Uvicorn | 原生 SSE/StreamingResponse 支持，async 能力 |
| **前端框架** | React 19 + TypeScript | — |
| **构建工具** | Vite 8 + Tailwind CSS 4 | 开发热更新 + API 代理 |
| **字体** | Orbitron + Rajdhani + Noto Sans SC | 科幻感英文 + 可读性中文 |

---

## 项目结构

```
fight/
├── server.py              # FastAPI 入口，路由定义，SSE 事件流
├── battle_manager.py      # 核心对战引擎：历史管理、视角转译、流式调用
├── battle.py              # CLI 版本（终端交互式对战，开发调试用）
├── personas/              # KOL 人格定义
│   ├── __init__.py        # 人格注册表
│   ├── hu_chenfeng.py     # 户晨风 — 消费主义 / 苹果安卓二元论
│   ├── zhang_xuefeng.py   # 张雪峰 — 学历现实主义 / 就业倒推法
│   ├── da_bing.py         # 大冰 — 底盘优先 / 低谷重建
│   ├── feng_ge.py         # 峰哥 — "这是好事啊" / 性压抑驱动论
│   └── changshu_arnold.py # 常熟阿诺 — 认知缺陷建模 / 错别字系统
├── requirements.txt       # Python 依赖
├── .env                   # API Key 配置
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # 页面路由状态机
│   │   ├── api/battle.ts      # API 客户端 + SSE 消费
│   │   ├── data/kols.ts       # KOL 元数据（颜色、标签）
│   │   ├── pages/
│   │   │   ├── HomePage.tsx   # 主页：话题输入 + KOL 选择 + 参数配置
│   │   │   ├── BattlePage.tsx # 对战页：实时流式对话 + 用户介入
│   │   │   └── ResultPage.tsx # 结果页：AI 观点总结 + 笔记
│   │   └── components/
│   │       ├── KolCarousel.tsx   # 扇形卡片轮播
│   │       ├── KolCard.tsx       # 单张 KOL 卡片
│   │       ├── CursorEffects.tsx # 自定义光标 + 粒子拖尾
│   │       ├── TopicBubbles.tsx  # 话题气泡
│   │       └── HistoryDrawer.tsx # 历史记录侧边栏
│   ├── index.html
│   └── vite.config.ts
├── skills/                # KOL 参考素材（语料包）
└── Ref/                   # UI 参考设计图
```

---

## 设计取舍与局限

1. **内存存储**：`battles` 字典存在内存中，服务重启即丢失。这是有意为之——对战是一次性的娱乐内容，不需要持久化。如果需要历史回放，可以在 `battle_end` 时将 `battle_history` 序列化到数据库。

2. **同步流式生成器**：`_stream_rounds` 是同步函数，在 Uvicorn 的线程池中执行。这意味着每个活跃的对战流会占用一个线程。对于当前规模（少量并发用户）这完全可接受，如果需要高并发，应改用 `async` 生成器 + `AsyncAnthropic` 客户端。

3. **Persona 维护成本**：每个 KOL 的 system prompt 长达 2000-4000 字，是人工精心编写的认知模型。添加新 KOL 需要大量的语料研究和提示工程。`skills/` 目录下的语料包是这个过程的输入素材。

4. **无身份验证**：API 完全开放，适合本地使用或演示环境。生产部署需要加 API Key 或 OAuth。

5. **前端手动路由**：没有使用 react-router，而是用 `useState` 管理三个页面。这限制了 URL 深链接和浏览器前进/后退，但对于一个单流程的娱乐应用来说足够简洁。
