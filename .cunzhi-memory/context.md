# 项目上下文信息

- ## MonoExpire iOS 应用开发进度

### 已完成
- ✅ Capacitor iOS 项目配置
- ✅ 顶部安全区域适配 (safe-area-inset-top)
- ✅ 禁用页面缩放 (viewport meta)
- ✅ 应用图标 (黑底白M)
- ✅ 手机端卡片布局优化 (2列网格，更紧凑)
- ✅ 统计区域改为3列一排
- ✅ 安装了 @capacitor/clipboard, @capacitor/share, @capacitor/filesystem 插件

### 待继续
- ⏳ iOS 导出功能：需要使用 Filesystem 插件直接保存文件到本地（用户想要下载文件而不是复制到剪贴板）
- 已安装 @capacitor/filesystem，但尚未实现代码

### 当前状态
- iOS 项目刚重建，需要在 Xcode 中重新配置签名 (Team)
- 数据存储使用 localStorage（本地存储，不需要登录）
