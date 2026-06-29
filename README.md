# 远程英语听写房间

一个面向家长和孩子的远程英语听写 Web 应用。家长可以上传学校单词表、随机创建听写房间，孩子用平板打开链接作答；系统会自动判分、记录错词，并在后续听写中按比例混入易错词。

## 功能概览

- 上传并解析学校单词表，支持 `.docx`、文字型 `.pdf`、`.txt`、`.csv`
- 支持旧版 Word `.doc` 的专用导入脚本
- 创建听写房间，生成孩子答题链接和家长监控链接
- 三种题型混合随机：
  - 听英文，填写词性、英文、中文意思
  - 看英文，填写词性、中文意思
  - 看中文意思，填写词性、英文
- 孩子端适配平板，支持英文发音 voice 选择和语速调节
- 英文和词性自动判分
- 中文释义自动初判，家长可手动改判
- 听写结束后统一展示答案
- 错词按错误次数、错误字段、连续答对情况进入后续抽题权重
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

第一版已经预留 Supabase 远程数据库结构。要真正异地长期使用，建议部署到 Vercel，并接入 Supabase。

1. 在 Supabase 创建项目
2. 执行建表脚本：

```text
supabase/schema.sql
```

3. 配置环境变量：

```bash
NEXT_PUBLIC_APP_URL=https://你的域名
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service role key
```

4. 部署到 Vercel

配置 Supabase 后，词库、房间、答题记录、错词统计都会写入远程数据库。

## 常用命令

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

## 注意事项

- 扫描版 PDF 暂不支持 OCR。
- 浏览器发音质量取决于设备内置英文语音；iPad/Mac 上建议选择高质量英文 voice。
- 本地文件存储适合开发和试用；正式异地使用建议改用 Supabase。
- `.env.local`、`.next`、`node_modules` 等不会提交到 GitHub。
