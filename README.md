# AiTest
Loon AI 解锁检测通用脚本：长按节点运行，检测该节点对 ChatGPT / Claude / Gemini / Grok / Perplexity / Copilot 的解锁情况。
## 文件
- `AIUnlockCheck.js`：脚本本体
## 用法
1. Loon → 配置 → 脚本 → 右上角 + → 新建本地脚本
2. 粘贴 `AIUnlockCheck.js` 的内容，类型选「通用」，保存
3. 在「所有节点」页面长按任意节点，选择本脚本运行
也可以直接在 Loon 的远程脚本中引用本仓库的 Raw 地址：
https://raw.githubusercontent.com/liuben1998/AiTest/main/AIUnlockCheck.js
## 注意
只测网页能不能打开，不测账号登录。Claude 对机房 IP 特别严，页面能打开不代表登录一定能过。
