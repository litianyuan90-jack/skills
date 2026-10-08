# Agent: channel attribution

## Job

每周三核对报备与归因，找出冲突和未归因线索，交人裁决。

## Reads

- CRM，只读
- `schemas/partners.csv`、`schemas/campaigns.csv`
- `guardrails/channel-rules.md`

## Writes

- `evidence/attribution/YYYY-MM-DD.md`

## Instruction

列出四类，每条附 CRM 记录 ID：

1. 同一品牌被两方（伙伴之间，或伙伴与直销）报备
2. 已过保护期但仍标为伙伴所有的报备
3. 没有 campaign_id 也没有 partner_id 的样品申请（未归因桶）
4. 首样后 60 天无第二次打样的伙伴线索（"只赢首样"预警）

不改 CRM、不改表格、不给出裁决，只给证据。CRM 读取失败要写在第一行。
