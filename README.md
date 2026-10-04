# TypeSafe Agent Skills

Agent skills for building with [TypeSafe](https://typesafe.ai): typed decisions and probabilities from System One models.

You can [read SKILL.md on GitHub](https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md) or fetch its [raw Markdown](https://raw.githubusercontent.com/typesafe-ai/skills/main/skills/typesafe-ai/SKILL.md).

## Install

### Claude Code plugin

Run in your terminal:

```bash
claude plugin marketplace add typesafe-ai/skills
claude plugin install typesafe@typesafe-ai
```

### Other agents via skills.sh

```bash
npx skills add typesafe-ai/skills --skill typesafe-ai
```

Select your agent when prompted. Installation is project-local by default; add `-g` to install globally.

See the [installation guide](https://docs.typesafe.ai/agent-skill#installation) for a prompt to copy to your agent, manual installation, and updates.

## Use

Ask your agent, for example:

> Use TypeSafe to route incoming support tickets by department, with human review for uncertain decisions.

In Claude Code, you can explicitly invoke the plugin skill with `/typesafe:typesafe-ai`.

| Skill | Purpose |
|---|---|
| [typesafe-ai](skills/typesafe-ai/SKILL.md) | Design TypeSafe workflows, find current docs and cookbooks, and compose typed judgments in code |
| [safe-migration-review](skills/safe-migration-review/SKILL.md) | 迁移前安全评审：备份校验、盘点读写方、找静默失败点、排切换顺序、反方评审，交人决策 |
| [paper-motion-explainer](skills/paper-motion-explainer/SKILL.md) | 纸艺停格风格科普动画：概念 → 七幕分镜 → 转场 → 配音声音 → 1920×1080 成片，珊瑚色像素机器人做旁白 |
| [image-blaster](skills/image-blaster/SKILL.md) | 启动器：克隆并固定 neilsonnn/image-blaster，配好 World Labs / FAL key，交给它自带的 skill 把一张图变成 3D 场景、模型和音效 |

## License

[MIT](LICENSE).
