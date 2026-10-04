---
name: higgsfield-skills
description: >
  Higgsfield AI 视频/图片技能包的安装器：把上游 AKCodez/higgsfield-claude-skills 的 19 个
  skill（15 个 Seedance 2.0 风格提示词生成器 + 4 个用 Playwright 自动操作 higgsfield.ai
  的 UGC 流水线 skill）装到用户的 ~/.claude/skills/，并配好 Playwright MCP。适用于
  "安装 Higgsfield 技能"、"用 Seedance 2.0 做视频"、"做 UGC 广告视频"等请求，
  装完后由上游 skill 接管。
  Use when the user wants the Higgsfield / Seedance 2.0 skill pack installed or
  asks to make Higgsfield videos and the pack is not yet installed.
---

# Higgsfield 技能包安装器

上游项目：<https://github.com/AKCodez/higgsfield-claude-skills>（作者 AKCodez）。

**上游仓库没有 LICENSE 文件**，所以本仓库不复制它的内容（19 个 skill 共约 1.1 MB），只负责把
它安装到用户本机。装好的文件留在用户自己的 `~/.claude/skills/`，不要提交进任何仓库。

## 铁律

1. **固定版本。** 默认检出已审阅过的提交 `f6698ab7a87223b67a76ce748ca1b936a8b5d399`。
   用户明确要求更新时才用最新 `main`，并先看一眼 diff。
2. **不覆盖已有 skill。** 目标目录里已经有同名文件夹时，先列出来问用户，不要直接覆盖。
3. **生成前先确认。** 在 Higgsfield 上点 Generate 会消耗积分，每次都先问用户（上游 skill
   本身也这样要求）。登录由用户自己在浏览器里完成，不经手账号密码。
4. **AI 人物广告要标注。** UGC 流水线生成的是看起来像真人的 AI 人物"使用感言"。提醒用户：
   发布时按平台规则打上 AI 生成标签（TikTok、Instagram、YouTube 都有要求），不要把它当成
   真实顾客的评价来宣传。

## 步骤

### 1. 前置条件

```bash
git --version && node --version && npx --version
```

用户还需要一个 Higgsfield 账号（<https://higgsfield.ai>）。

### 2. 克隆并固定版本

```bash
TMP="$(mktemp -d)"
git clone -q https://github.com/AKCodez/higgsfield-claude-skills "$TMP/hf"
git -C "$TMP/hf" checkout -q f6698ab7a87223b67a76ce748ca1b936a8b5d399
```

### 3. 检查冲突并复制

默认装到用户级目录 `~/.claude/skills/`。如果用户只想在某个项目里用，就改成那个项目的
`.claude/skills/`。

```bash
DEST="${HIGGSFIELD_SKILLS_DEST:-$HOME/.claude/skills}"
mkdir -p "$DEST"
for d in "$TMP/hf"/*/; do
  n="$(basename "$d")"; [ -e "$DEST/$n" ] && echo "已存在: $n"
done
# 没有冲突（或用户确认覆盖）后：
for d in "$TMP/hf"/*/; do cp -R "$d" "$DEST/"; done
rm -rf "$TMP"
```

### 4. 安装 Playwright MCP

4 个自动化 skill 需要它；只用提示词生成器的话可以跳过。

```bash
claude mcp list | grep -q playwright || claude mcp add playwright npx @playwright/mcp@latest
```

### 5. 交接

告诉用户**重启 Claude Code**（新 skill 和 MCP 在新会话里才会加载），然后就能用下表里的命令。
第一次跑自动化 skill 时，Playwright 打开的浏览器里需要用户自己登录 Higgsfield。

## 装好后的 skill

| 类别 | 命令 | 作用 |
|---|---|---|
| UGC 流水线 | `/ugc-hot-girl`、`/higgsfield-image-auto`、`/ugc-video-auto` | AI 人物图片提示词 → 在 Soul 2.0 上出图 → 生成视频 |
| 视频自动化 | `/seedance-auto-generate` | 用 Playwright 在 Higgsfield 上提交 Seedance 2.0 视频任务 |
| 创意风格 | `/01-cinematic`、`/02-3d-cgi`、`/03-cartoon`、`/04-comic-to-video`、`/05-fight-scenes`、`/08-anime-action` | 电影感、3D、卡通、漫画转视频、打斗、动漫 |
| 商业 | `/06-motion-design-ad`、`/07-ecommerce-ad`、`/09-product-360`、`/11-social-hook`、`/12-brand-story` | 软件广告、电商、产品 360°、短视频开头、品牌故事 |
| 行业 | `/10-music-video`、`/13-fashion-lookbook`、`/14-food-beverage`、`/15-real-estate` | 音乐视频、时装、餐饮、房产 |

15 个风格 skill 只输出提示词，不调用任何服务；需要 Playwright 和 Higgsfield 账号的只有 4 个
自动化 skill。

## 卸载

```bash
DEST="${HIGGSFIELD_SKILLS_DEST:-$HOME/.claude/skills}"
cd "$DEST" && rm -rf 01-cinematic 02-3d-cgi 03-cartoon 04-comic-to-video 05-fight-scenes \
  06-motion-design-ad 07-ecommerce-ad 08-anime-action 09-product-360 10-music-video \
  11-social-hook 12-brand-story 13-fashion-lookbook 14-food-beverage 15-real-estate \
  higgsfield-image-auto seedance-auto-generate ugc-hot-girl ugc-video-auto
```
