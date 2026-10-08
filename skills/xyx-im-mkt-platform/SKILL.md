---
name: xyx-im-mkt-platform
license: MIT
description: >
  为 XYX（福建鑫源欣纺织科技）组建 MKT 团队，并为 IM 业务线（默认指 Intimates
  贴身衣物/内衣面料）搭建"线上营销 + 分销"平台。基于 marketing-engineer-starter
  大脑文件夹：先定范围与证据，再按闸门逐步上线人岗、agent、渠道伙伴和归因表。
  适用于"建 MKT 团队"、"做内衣面料线上获客"、"招代理商/分销商"、"搭伙伴门户"、
  "渠道冲突和归因"等请求。Use to stand up a marketing team and an online
  marketing + partner distribution system for a B2B fabric business line, with
  draft-only agents and human approval on send, spend, price and partner terms.
---

# XYX IM 线上营销与分销平台（XYX IM MKT Platform）

结论先行：**第一阶段的"平台"是一个大脑文件夹 + 两张表 + 一个样品申请页，
不是一套要开发的软件。** 先证明一条渠道能把样品变成订单（program），再决定
要不要建门户。顺序反过来，就是先花钱建系统，再去找能装进系统的证据。

本 Skill 叠加在 `marketing-engineer-starter/` 之上（START-HERE、brand、company、
decisions、workflows 01–06 原样沿用），只补 IM 业务线和"分销"这一层。

## 铁律

1. **范围先确认。** "IM" 默认指 Intimates（内衣/贴身面料）。若用户指的是别的
   （某事业部代号、即时通讯渠道等），停下来问，不要按默认推下去。
2. **一个大脑只管一门生意。** IM 是 B2B 面料大脑里的一条产品线，可以共用；
   日本 Rakuten / TikTok Shop 消费者业务不进这个大脑。
3. **Agent 只起草、只暂停。** 不发邮件、不发布页面、不开广告、不签伙伴、
   不报价。发送令牌、广告激活令牌、合同模板的签署权不在 agent 环境里。
4. **伙伴说的话 = 我们说的话。** 代理商/分销商对外的任何宣称，只能来自
   `company/offers.md` 的 Allowed claim。伙伴资料包同样走审批。
5. **每一单都要能追到渠道。** 没有 `campaign_id` 或 `partner_id` 的线索不进
   业绩统计，只进"未归因"桶，并在周报里单列。
6. **决定权在人。** 招谁、签谁、给多少佣金、哪块区域给谁，人拍板。

## 流程

### 第 0 步：确认范围（必须问清，不猜）

产出 `im/SCOPE.md`，回答：

- IM 的确切定义：哪些品类（文胸、内裤、塑身、家居服、泳衣是否算）、哪些面料
  （经编弹力、无缝、蕾丝、腰带/肩带窄幅？）。
- 目标市场：欧美品牌为主，还是也做国内内衣品牌/工厂？两者渠道完全不同。
- "分销"指什么（三选一或组合，见第 3 步的伙伴类型）。
- 现有资源：谁已在跑 IM 客户、CRM 里有多少 IM 线索、有没有现成代理关系。
- 决策人和预算上限（人头、工具、样品、展会）。

任何一项答不上来，标记"未知"，不要用假设填平。

### 第 1 步：补 IM 证据（人做，agent 不做）

- 在 `company/customer-fit.md` 增加 IM 段：IM 买家的岗位、规模、他们失败过的
  测试、他们在意的手感词（贴肤、无痕、回弹、洗后变形等——以真实通话为准）。
- 在 `company/offers.md` 增加 IM 专属 Offer 行（如 IM 样品套、窄幅/腰带样卡），
  每条带 Allowed claim 和需审批项。
- 贴身品类的合规要求（如 OEKO-TEX 等级、REACH、加州 Prop 65、各品牌 RSL）
  **由人核实后写入**，agent 不得自行声称"已通过"任何认证。
- 向 `evidence/calls/` 放入至少 20 份 IM 相关的原始对话。少于 20 份，第 2 步
  的结果只当参考，不当依据。

### 第 2 步：组队——人岗与 agent 同时设计

用 `templates/team/org.md`。原则：**每个人岗对应一组 agent，人负责判断，
agent 负责起草与核对。** 不要先招满人再找事做。

最小编制（建议，需按预算调整）：

| 角色 | 人数 | 负责 | 搭配 agent |
|---|---|---|---|
| MKT 负责人（大脑主人） | 1 | 维护 company/brand/decisions，审批队列，周一决策 | 06 performance |
| 内容与搜索 | 0.5–1 | IM 页面、样卡照片、案例素材 | 01 customer-language、03 search-pages、04 creative |
| 渠道/分销经理 | 1 | 伙伴招募、条款、区域、伙伴培训 | 07 partner-scout、08 partner-enablement |
| 销售运营（可由销售兼） | 0.5 | CRM 字段、报备、归因、样品间记录 | 05 closed-lost、09 channel-attribution |

上线顺序沿用 starter：01 → 05 → 06，然后才是 07/08/09，最后 03/04。

### 第 3 步：选分销模式（一次只试一种，最多两种）

| 模式 | 适合 | 主要风险 | 第一阶段做法 |
|---|---|---|---|
| A. 区域佣金代理（欧/美） | 有品牌开发经理人脉、能跑样品的人 | 代理只拿首样、手感漂移后丢单（创始人观点："贸易商赢首样、输项目"） | 佣金只在**第二个订单**或项目确认后结算 |
| B. 现货/小批量线上店（自营样卡店或 B2B 平台店铺） | 小品牌、设计师、补样 | 吸引纯比价买家；与项目价冲突 | 只卖样卡和现货色，不挂项目价 |
| C. 指定工厂/成衣厂转介 | 品牌指定的 CMT/成衣厂 | 工厂只要低价，品牌方不知情 | 转介必须带品牌名和款号才登记 |

选模式的判断标准：**哪种模式离"第三次打样仍在线程上的品牌开发经理"最近。**

### 第 4 步：搭平台（四层，按闸门加）

1. **大脑层**：starter 文件夹 + `im/` 子目录，放在 Git 里，人改 company/brand，
   agent 只写 evidence/ 和 drafts/。
2. **触达层（线上营销）**：
   - 一个样品申请页（字段：品牌、款号/品类、失败过的测试、目标交期、来源
     `campaign_id`/`partner_id`）。这是全平台唯一必须先有的"页面"。
   - 每月一个 IM 买家会收藏的页面（03 agent 起草，例如"内衣弹力面料打样前
     该问工厂的 10 个问题"），数字只取自 offers.md。
   - 外联邮件、LinkedIn 消息：只起草，人发。
3. **分销层**：`templates/schemas/partners.csv`（伙伴台账）、
   `templates/guardrails/channel-rules.md`（报备、区域、价格、宣称）、
   伙伴资料包（08 agent 起草，人审）。**不先做伙伴门户**。
4. **数据层**：`schemas/campaigns.csv` 增加 `partner_id`、`business_line` 两列
   （见模板），让"花费 → 样品 → 项目 → 退货/取消"能按渠道拆开。

升级到"真正的系统"（伙伴门户、CRM 渠道模块、线上店铺）的闸门，见第 6 步。

### 第 5 步：周循环（沿用 starter，加两行）

- 周一：06 写周报，**按渠道**（直销 / 每个 partner_id / 未归因）分行，每行以
  keep / kill / change / test 结尾。
- 周三：09 跑报备冲突检查，列出同一品牌被两方报备的情况，交人裁决。
- 周五：渠道经理把伙伴反馈原话放进 `evidence/calls/partners/`。

### 第 6 步：90 天闸门（人在每个闸门签字）

| 时间 | 必须达到 | 未达到时 |
|---|---|---|
| 第 2 周 | SCOPE.md 完整；IM 的 fit/offer 写完；≥20 份原始对话 | 不启动任何 agent |
| 第 6 周 | 01 的报告人认可（约 70% 正确后修正过 3 轮）；样品申请页上线；伙伴候选 5–10 家（07 起草，人筛） | 不签伙伴 |
| 第 12 周 | 至少 1 条渠道产出带 ID 的样品申请，且有进入第二次打样的记录 | 停止该渠道，写入 decisions/failed-campaigns.md |
| 之后 | 活跃伙伴 ≥3 家且台账维护成本明显上升 | 才评估伙伴门户/CRM 渠道模块 |

以上阈值是起点假设，不是行业标准；第一次周报后按真实数据改。

## 产出物

- `im/SCOPE.md`、`im/90-day-plan.md`
- 从 `templates/` 复制到大脑：`team/org.md`、`guardrails/channel-rules.md`、
  `schemas/partners.csv`、`schemas/campaigns.csv`（加列版）、
  `workflows/07-09/AGENT.md`
- 给决策人的一页摘要：选的分销模式、编制、预算、第一个闸门日期、反方意见。

## 反方评审（每次交付前必须写）

至少回答这三条，写进一页摘要：

1. **渠道会不会伤害项目？** 代理/分销是不是正是创始人说的"赢首样、输项目"的
   那类人？佣金结构有没有把激励放在第二单之后？
2. **线上营销会不会拉来错的人？** "eco elastic" 式标题吸引贸易商的教训
   （failed-campaigns.md）在 IM 页面上是否会重演？
3. **是不是在用平台替代证据？** 如果 evidence/calls 少于 20 份，任何"平台"
   建设都应暂停。

## 常见错误

| 错误 | 正确做法 |
|---|---|
| 先招 5 个人再想做什么 | 先跑通 01，再按 agent 需要的人工判断补人 |
| 先开发伙伴门户 | 先用表格跑 3 家伙伴，台账真的维护不动了再建 |
| 伙伴自写宣传资料 | 资料包只用 offers.md 的 Allowed claim，人审后下发 |
| 佣金按首单/首样结算 | 按项目确认或复购结算，抑制"只赢首样" |
| 线下展会线索不打 ID | 展会也是 campaign，统一用 campaigns.csv 的 ID |
| 把 IM 合规要求写成营销卖点 | 合规只写"可提供某批次某报告"，带批次号和报告路径 |
