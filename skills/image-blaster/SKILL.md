---
name: image-blaster
license: MIT
description: >
  一张图生成可探索的 3D 场景：用上游开源项目 neilsonnn/image-blaster（World Labs Marble +
  FAL 上的 Hunyuan 3D / nano-banana / ElevenLabs SFX），从单张图片生成静态环境的高斯泼溅
  （.spz）、可移动物体的 3D 模型（.glb/.obj）以及环境音和物体音效（.mp3）。本 Skill 是启动器：
  负责把上游工程克隆到本地、固定版本、配置 API key，然后在那个目录里用它自带的 8 个
  image-blast-* skill 跑流程。适用于"把这张图变成 3D 场景"、"IMAGE-BLAST 一下"、
  "给游戏/Blender/Three.js 生成场景资产"等请求。
  Use when the user wants to turn an image into a 3D environment, meshes, and
  SFX with image-blaster; sets up the upstream workspace and hands off to its
  bundled image-blast-* skills.
---

# Image Blaster 启动器

上游项目：<https://github.com/neilsonnn/image-blaster>（MIT，作者 Neilson Koerner-Safrata）。

它不是单个 skill，而是一整套工程：`.claude/` 里有 8 个 skill、6 个子 agent、Node 脚本、
两个 hook，外加一个 React 3D 查看器（`app/`）。skill 里的路径都是相对工程根目录写死的
（`.claude/scripts/…`、`input/`、`worlds/`），**必须在克隆下来的目录里启动 Claude Code**
才能正常工作。本 Skill 只负责把这一步搭好并交接。

## 铁律

1. **不在当前项目里跑上游 skill。** 上游脚本会在工作目录下读写 `input/`、`worlds/`、
   `.env`，在别的仓库里运行会写乱目录。
2. **固定版本。** 默认检出已审阅过的提交 `4acb43ba126a12358f71838d1b1a05e856b10eaf`。
   用户明确要求更新时才切到最新 `main`，并先看一眼 `.claude/` 的变更。
3. **API key 只写进上游目录的 `.env`。** 不写进任何会提交的文件，不回显完整 key。
4. **会花钱的调用先确认。** World Labs 和 FAL 都按次计费，生成世界、3D 模型、音效前
   都先跟用户确认（上游 README 也建议说 "blast it and confirm each step with me"）。

## 步骤

### 1. 检查前置条件

```bash
git --version && node --version   # 脚本只用 Node 内置模块，Node 18+ 即可
bun --version                     # 仅本地 3D 查看器需要；没有就跳过查看器
```

### 2. 克隆并固定版本

默认位置 `~/image-blaster`；已存在则复用，不要覆盖用户的 `worlds/`。

```bash
DIR="${IMAGE_BLASTER_DIR:-$HOME/image-blaster}"
if [ ! -d "$DIR/.git" ]; then
  git clone https://github.com/neilsonnn/image-blaster "$DIR"
fi
git -C "$DIR" fetch -q origin
git -C "$DIR" checkout -q 4acb43ba126a12358f71838d1b1a05e856b10eaf
```

### 3. 配置 API key

需要两个 key，让用户自己去拿：

| 变量 | 用途 | 获取 |
|---|---|---|
| `WORLD_LABS_API_KEY` | 生成 3D 环境（Marble） | <https://platform.worldlabs.ai/> |
| `FAL_KEY` | 3D 模型、音效、图像编辑 | <https://fal.ai/> |

```bash
cd "$DIR" && [ -f .env ] || cp .env.example .env
# 然后把用户给的 key 填进 .env 对应行
```

### 4. 放入图片并交接

1. 把用户的图片复制到 `$DIR/input/`。
2. 告诉用户在那个目录里启动新会话：

   ```bash
   cd ~/image-blaster && claude
   ```

   然后说：`blast it and confirm each step with me`。
3. 启动时上游的 SessionStart hook 会检查 key 并列出已有的 world；之后的流程由上游 skill 接管。

### 5. （可选）本地查看器

```bash
cd "$DIR" && bun install && bun run dev
```

## 上游自带的 skill（在 `$DIR` 里可用）

| Skill | 作用 |
|---|---|
| `image-blast-project` | 创建/查看 `worlds/<slug>` 项目，其他 skill 之前先用 |
| `image-blast-uncover` | 分析图片、列出可拆分的物体候选，等用户确认 |
| `image-blast-plate` | 去掉前景物体，生成干净背景图 |
| `image-blast-world` | 用 World Labs 从背景图生成静态环境（.spz） |
| `image-blast-3d` | 用 Hunyuan 3D 生成单个物体模型，可调 `--face-count` 等参数 |
| `image-blast-sfx` | 生成环境循环音和物体音效 |
| `image-blast-image-edit` | 通用图像编辑（nano-banana / gpt-image-2） |
| `image-blast-wildcard` | 调用任意 FAL 模型的兜底入口 |

## 产出

全部在 `$DIR/worlds/<slug>/output/` 下：物体 `.glb`/`.obj`、环境 `.spz`、音效 `.mp3`。
可以导入 Unity / Unreal / Godot、Blender / Maya，或 Three.js 应用。
