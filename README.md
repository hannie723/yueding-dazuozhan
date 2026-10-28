# 请帮我制作一个名为 约定计划 的中文手机优先网页应用 用于朋友之间互相监督学习任务 产品定位 支持 2 5 人的小组 成员可以给自己创建任务 也可以给其他成员布置任务...

请帮我制作一个名为「约定计划」的中文手机优先网页应用，用于朋友之间互相监督学习任务。

产品定位：支持 2–5 人的小组，成员可以给自己创建任务，也可以给其他成员布置任务。执行者提交文字或截图作为证据，由指定验收人审核（或多人投票审核）。每个人需要完成自己收到的所有任务（每人每天任务总数上限3个），完成任务可以获得虚拟金币，未完成任务可能扣除约定金币，并记录连续达标天数。

第一轮只实现前端交互原型，使用模拟数据，不接入数据库，不实现真实身份验证。

页面需要包括：

1. 小组首页：展示成员、金币余额、今日任务、待验收任务和连续达标天数。

2. 创建任务页面：填写任务名称、达标标准、执行人、验收人、截止时间、金币奖励和惩罚。

3. 任务详情页面：展示任务状态、提交说明、截图占位、验收通过和退回操作。

4. 个人记录页面：展示金币流水、历史任务和本周达标情况。

交互要求：

- 所有按钮都必须有实际的前端交互效果。

- 可以创建任务、切换任务状态、模拟提交和验收。

- 手机端布局优先，兼容桌面浏览器。

- 使用清晰的中文文案，状态要容易区分。

- 采用简洁、温暖、轻松的视觉风格，避免复杂装饰。

开发要求：

- 先检查并说明所采用的技术方案。

- 暂时不要接入后端，不要实现个人小屋、商城、排行榜、或真实支付，但可以留下借口方便后续加入新功能。

- 将任务、提交记录和金币逻辑分成清晰的模块，方便后续接入 Supabase。

- 完成后列出已实现的功能、尚未实现的功能和需要测试的交互。

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9fc6c2d6-154b-4f0d-8cf7-aa5c956c8272).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
