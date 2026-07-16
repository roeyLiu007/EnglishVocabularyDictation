# 远程英语听写房间

一个面向家长和孩子的远程英语听写 Web 应用。家长可以上传学校单词表、随机创建听写房间，孩子用平板打开链接作答；系统会自动判分、记录错词，并在后续听写中按比例混入易错词。

## 功能概览

- 按固定 Excel / CSV 模板上传单词表，可下载模板后填写
- 模板字段包含类型、英文/词组、音标、词性、中文意思、阶段词表、单元、标签、备注，其中音标选填，词组可不填词性
- 支持旧版 Word `.doc` 的专用导入脚本
- 上传后可选择“仅作为本次上传词库”或“更新到基础词汇表”
- 支持按阶段基础词汇表管理：初中、高中、四级、六级、考研、雅思
- 创建听写房间，生成孩子答题链接和家长监控链接
- 创建听写时可规定完成时间；计时从学生第一次打开听写链接开始，超时后系统自动交卷，学生不能再修改答案
- 教师任务管理支持查看当前与历史听写、汇总结果、复制链接和关闭未完成任务
- 创建听写时可选择全部词库、某个基础词汇表或最近一次上传
- 三种题型混合随机：
  - 听英文，填写词性、英文、中文意思
  - 看英文，填写词性、中文意思
  - 看中文意思，填写词性、英文
- 创建听写时可分别设置三种题型的出题比例
- 创建听写时必须填写听写人，错词记录可按听写人筛选
- 词组会混合进听写，支持听英文词组写词组和中文、看英文词组写中文、看中文写英文词组；词组不要求填写词性
- 多词性单词会拆成多行填空，每行只填写一种词性及对应中文意思
- 孩子端适配平板，支持英文发音 voice 选择和语速调节
- 孩子端支持必填校验、Enter 快捷提交和暂时跳过，完成后先展示成绩再查看答案解析
- 听写页可按题号自由切换并覆盖修改；全部答完后先检查，确认交卷锁定后才可查看答案解析
- 英文和词性自动判分
- 词性统一保存为“英文缩写 + 中文”，例如 `n 名词`、`vt 及物动词`、`vi 不及物动词`、`vlink 系动词`、`aux_v 助动词`、`aux_v 情态动词`；来源词表里的泛用 `v` 会按单词语法清洗为更具体的动词类型，孩子填写英文缩写或中文都算对
- 中文释义自动初判，家长可手动改判
- 听写结束后先展示成绩，再由孩子打开答案解析
- 教师确认所有待判定释义后，可手动将本次错误记录到错题本
- 教师提前结束时只记录已提交题中的错误；学生正式交卷后，错误题和未提交题都会计入错题本
- 错词按错误次数、错误字段、连续答对情况进入后续抽题权重
- 错词按 1、3、7、14、30 天间隔安排复习，并显示学习中、待巩固、已掌握等熟练度
- 错词本支持家长端直接修改单词内容、逐个移除错词记录、一键清空全部错词
- 词库支持分页浏览，并复用百度云语音与 Supabase Storage 缓存播放单词读音
- 词库支持按阶段筛选、选择音色与 0.5～1.5 倍播放速度（默认男声、1 倍速）；未登录教师账号时保持只读
- 根网址固定进入学生权限，可访问首页、词库和只读错词本；教师从 `/teacher` 输入密码进入教师权限
- 词库播放后会标识“Supabase 缓存”“百度云生成”或“浏览器备用”，便于确认本次是否调用百度接口
- 词库和错词本将词性与中文意思合并为“释义”列，长单词、长释义可自动换行；错词本不显示音标，提供与词库相同的音色、语速、缓存来源和播放逻辑，操作列固定在右侧
- 未配置 Supabase 时使用本地文件持久化，不会因为重启开发服务丢词库

## 技术栈

- Next.js 14
- React 18
- TypeScript
- Supabase 预留远程数据库方案
- 浏览器 SpeechSynthesis 英文朗读
- 本地开发持久化：`data/local-store.json`

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开：

```text
http://localhost:3000
```

如果 `3000` 被占用，Next.js 会自动切到其他端口。

## 页面说明

- `/`：首页
- `/library`：词库页，上传、预览、查看单词
- `/create`：创建听写房间
- `/tasks`：教师听写任务管理
- `/parent/[roomId]?token=...`：家长监控页
- `/child/[roomId]?token=...`：孩子答题页
- `/mistakes`：错词本

## 基础词库

当前项目已经内置一份“中考英语大纲1600词”基础词库，存储在：

```text
data/local-store.json
```

当前清洗后有效词条数为 `1588` 条。

这个文件会被提交到仓库，方便本地启动后直接使用。如果以后不想提交本地数据，可以把它移出版本管理，并改用 Supabase。

## 模板上传

在词库页点击“下载 Excel 模板”，填写后上传。模板列为：

```text
类型 | 英文/词组 | 音标 | 词性 | 中文意思 | 阶段词表 | 单元 | 标签 | 备注
```

必填列：

```text
类型、英文/词组、中文意思
```

选填列：

```text
音标、词性、阶段词表、单元、标签、备注
```

上传解析后，保存时可选择：

```text
仅作为本次上传词库
更新到基础词汇表
```

## 旧版 `.doc` 词表导入

旧版 Word `.doc` 需要先转成纯文本，再使用专用脚本导入。

示例：

```bash
textutil -convert txt /path/to/中考英语大纲1600词汇.doc -output /tmp/zhongkao_1600_words.txt
node scripts/import-legacy-word-text.mjs /tmp/zhongkao_1600_words.txt http://localhost:3000
```

只检查解析结果、不写入应用：

```bash
node scripts/import-legacy-word-text.mjs /tmp/zhongkao_1600_words.txt http://localhost:3000 --dry-run
```

## 远程使用方案

第一版已经预留 Supabase 远程数据库结构。要真正异地长期使用，建议部署到 EdgeOne Makers，并接入 Supabase。

1. 在 Supabase 创建项目
2. 执行建表脚本：

```text
supabase/schema.sql
```

3. 配置环境变量：

```bash
NEXT_PUBLIC_APP_URL=https://你的 EdgeOne 站点域名
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service role key
SUPABASE_TTS_BUCKET=tts-audio
DICTATION_ADMIN_PASSWORD=教师任务管理密码
BAIDU_SPEECH_API_KEY=百度语音应用的 API Key
BAIDU_SPEECH_SECRET_KEY=百度语音应用的 Secret Key
BAIDU_SPEECH_CUID=english-exercise-server
```

`NEXT_PUBLIC_APP_URL` 可先不填；系统会自动使用当前请求域名生成听写链接。绑定自定义域名后再填成正式域名即可。这里请填带 `https://` 的站点根地址，例如 `https://example.com`，不要填 `/child/...` 或 `/parent/...` 页面路径。

`DICTATION_ADMIN_PASSWORD` 用于保护 `/tasks` 教师管理页，请使用独立强密码，不要添加 `NEXT_PUBLIC_` 前缀。登录成功后浏览器会保存 7 天的 HttpOnly 会话；修改密码会让旧会话立即失效。

4. 在 EdgeOne Makers 控制台选择 `Create project` -> `Import Git repository`，导入 GitHub 仓库
5. EdgeOne 构建设置：

```bash
Build command: npm run build
Install command: npm install
Output directory: .next
Node version: 20.18.0
```

仓库已经包含 `edgeone.json`，EdgeOne 会按这个配置构建 Next.js 应用。

配置 Supabase 后，词库、房间、答题记录、错词统计都会写入远程数据库。

## 云端英文发音

听力题优先使用百度智能云短文本在线语音合成生成 MP3，并缓存到 Supabase Storage。默认提供基础英文女声和英文男声；同一个单词和音色只生成一次，语速由浏览器播放器调整。云端配置不可用时会自动回退到浏览器 TTS。

1. 在百度智能云语音技术控制台创建应用并开通短文本在线合成，取得 API Key 和 Secret Key。
2. 在 EdgeOne 中配置 `BAIDU_SPEECH_API_KEY`、`BAIDU_SPEECH_SECRET_KEY` 和可选的 `BAIDU_SPEECH_CUID`。
3. 保持 `SUPABASE_TTS_BUCKET=tts-audio`，首次生成时服务端会自动创建公开 Bucket；MP3 使用不可逆文本哈希命名，不公开原始单词。
4. 不要给百度密钥添加 `NEXT_PUBLIC_` 前缀，也不要提交 `.env.local`。

部署后第一次播放某个单词时会等待云端生成，后续播放会直接使用 Supabase CDN 缓存。

## 常用命令

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

## 注意事项

- 扫描版 PDF 暂不支持 OCR。
- 云端英文发音需要同时配置百度语音和 Supabase Storage；配置缺失时会回退到设备浏览器发音。
- 本地文件存储适合开发和试用；正式异地使用建议改用 Supabase。
- `.env.local`、`.next`、`node_modules` 等不会提交到 GitHub。
