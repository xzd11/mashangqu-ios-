# 1.2.0 灵动岛与桌面小组件

这是新增 Widget 扩展的开发版本，须使用 macOS／Xcode 完整构建。社区编译，使用 AI 编写；此前正式版仅在 iPhone 15 上获得用户验证。新扩展尚待真机验证，不应将模拟测试或编译成功视为设备验证。

## 使用方式

- 在应用中登录并刷新「快递」。长按桌面 → 编辑 → 添加小组件 → 码上取，可添加小号或中号「待取包裹」。
- 小组件显示待取数量和驿站，默认隐藏取件码。「我的 → 灵动岛与桌面小组件」可显式开启明码；只有最小展示字段写入 App Group，不共享 Cookie、Token、手机号、完整运单号和身份码。
- 在包裹卡片点「开始取件 · 灵动岛」，在 App 前台手动开始实时活动。展开灵动岛或查看锁屏卡片，可看所选驿站与取件码。开始活动意味着同意在应用外显示该取件码。
- 灵动岛收起时显示图标与待取数量；点击活动或桌面小组件打开快递页。在 App 中标记所选包裹「已取」后结束活动；「我的」也可手动结束。
- 撤销已取不会重新启动实时活动，也不会恢复已删除的旧取件码。
- 切换／删除账户时清理对应展示内容。重新启动 App 会重新同步，并结束未重新选择包裹的旧活动。

## 刷新与失效

内容来自上次应用内刷新，不是后台持续联网查询。应用保存包裹／账户／显示设置后，将最小快照同步到共享容器，并请求 WidgetKit 刷新；实际刷新时机受系统调度。快照超过 15 分钟不再显示旧取件码，请打开 App 刷新。实时活动同样使用 staleDate 和失效提示；ActivityKit 的系统时长限制仍适用。不包含推送服务或后台轮询平台接口。

主 App 保留 iOS 15.0 最低配置；Widget 扩展和实时活动要求 iOS 16.2+。灵动岛界面需要有灵动岛的设备，无灵动岛设备使用锁屏实时活动。暂未提供小组件内直接「已取」按钮，点击后进入 App 操作。

## 构建

安装 Xcode 和官方 Homebrew 包 `xcodegen` 后：

```bash
bash ios/build_xcode.sh
```

该脚本生成图标与 Xcode 工程，同时编译主 App 和 `MashangquWidgets.appex`，验证版本、App Group、扩展嵌入和网页资源，然后生成：

`deliverables/Mashangqu-iOS-1.2.0-widgets-self-sign.ipa`

构建产物没有分发签名。旧 Linux ABI 打包方式不能生成 WidgetKit／SwiftUI 扩展，因此 `package_ipa.py` 不允许生成缺少扩展的 1.2.0 安装包。

GitHub Actions `Build iOS widgets` 在 `feature/ios-widgets` 分支完成界面检查和 macOS 构建；产物是可下载、待自签的 IPA，不会自动发布 Releases。

## 签名要求

- 主 App：`ink.mashangqu.ios`；扩展：`ink.mashangqu.ios.widgets`，必须使用同一开发团队签名并嵌入匹配描述文件。
- 两者共享 App Group：`group.ink.mashangqu.ios`。证书与描述文件必须授权该组；仅在 plist 中写一个组名不能获得权限。
- 如签名工具改写标识符，需要让主 App 和扩展中的 `MSQAppGroup` 值、两者 entitlement 中的组名、实际授权的组名完全一致。Xcode 构建可通过 `MSQ_APP_GROUP` 设置实际组名。
- 自签工具必须保留并签名 `PlugIns/MashangquWidgets.appex`。去掉扩展或丢弃共享组权限，不能视作支持小组件；应用设置页会检查共享容器是否可用。
- 实时活动还受系统「允许实时活动」开关控制，启动失败会显示明确提示。没有可用 App Group 时，桌面小组件不能获得共享数据；主 App 的钥匙串存储不因此失败。

## 官方依据

- [ActivityKit 与实时活动](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)
- [WidgetKit 刷新机制](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)
- [App Groups 配置](https://developer.apple.com/documentation/xcode/configuring-app-groups)


## 1.2.1 自签适配

优先使用 `MSQAppGroup` 配置的组。当该组不可访问时，读取主 App 与本应用 Widget 扩展描述文件的共同组，按固定顺序选择系统实际允许访问的组。仅提取共享组和应用标识字段，不导出描述文件、设备列表或证书信息。读取配置不等同于验证描述文件签名；实际共享容器权限始终由 iOS 强制检查。

设置页新增扩展缺失、扩展描述文件与 Bundle ID 不匹配提示；实时活动错误保留错误域和错误码，供定位。匹配共享组不能替代正确的扩展签名；主 App 和扩展仍需有效且匹配的签名配置。

新增 `test_widget_profiles.swift`，使用合成配置测试嵌入 XML、共同组筛选、精确／通配符应用标识和异常输入。不包含任何用户实际描述文件数据。
