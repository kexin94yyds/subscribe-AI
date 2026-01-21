# 会话摘要

## 2025-12-20 00:17
## 2025-12-20 会话摘要

### 主题
iOS 开发者签名问题 - 免费账号 3 app 限制

### 背景
- 用户已经是**付费开发者**（$99/年），账号 mengxin yang，Team ID: UM3Z9G5DNH
- 但 Xcode 仍然报 "free developer profile" 错误
- 手机上有 3 个旧的免费签名 app 占满配额：
  - com.kexin.infofilter
  - com.slashprompter.app
  - com.monoshot.app

### 已完成
1. 确认用户是付费开发者（Apple Developer 网站有 Sales and Trends 等选项）
2. 重新安装了 Pods
3. 用户在 Xcode Accounts 里有 Apple Development Certificate
4. 用户删除了手机上的一个旧 app

### 待继续
1. 让用户重新 Run MonoExpire 到手机
2. 用户询问"另一个 app"怎么办 - 可能是想把其他项目也用付费账号重新签名

### 注意
- Xcode 可能仍然用的是旧的免费 profile，需要确认安装是否成功
- 如果仍然报错，可能需要在 Xcode 重新登录 Apple ID 或手动下载 profiles

## 2025-12-18 14:11
将"刷新周期"相关字段从 lastRefreshDate（上次刷新日期）改为 nextRefreshDate（下次刷新日期），简化了 AccountCard 中的递减计算逻辑。修改涉及 types.ts、App.tsx、AccountCard.tsx。已构建、同步 iOS、推送 GitHub。

