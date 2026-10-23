<div align="center">

# 码上取 · MashangQu iOS

**一个 App，取遍所有驿站。**

拼多多 · 淘宝菜鸟 · 京东 · 顺丰 · 如意邻里 —— 身份码与快递信息一站式聚合

[![Platform](https://img.shields.io/badge/platform-iOS%2015.0%2B-000000?logo=apple&logoColor=white)](#)
[![Architecture](https://img.shields.io/badge/architecture-ARM64-4285F4)](#)
[![Version](https://img.shields.io/badge/version-1.0.0-F57C00)](https://github.com/xzd11/mashangqu-ios-/releases)
[![License](https://img.shields.io/badge/license-MIT-34A853)](LICENSE)

</div>

---

> **社区编译版本，使用 AI 编写。仅在 iPhone 15 上验证使用，其他机型尚未验证。**
>
> 本版本基于 [njpemo/mashangqu](https://github.com/njpemo/mashangqu) 的业务逻辑移植，为非官方 iOS 社区版本。

## ✨ 核心特性

| | 特性 | 说明 |
|:---:|---|---|
| 🎫 | **五平台身份码聚合** | 集中展示与切换淘宝／菜鸟、拼多多、京东、顺丰、如意邻里的身份码 |
| 🔎 | **条形码大屏展示** | 主页条形码横向全屏放大，旋转屏幕时调整布局，过期时停止展示 |
| 📦 | **快递列表聚合** | 支持平台筛选及相同运单合并；京东暂不支持快递列表 |
| 🔢 | **菜鸟取件码查询** | 输入快递运单号查询，或点击卡片上的「通过菜鸟查询取件码」，结果显示在卡片中并注明来源 |
| 🔄 | **前台自动刷新** | 可配置自动刷新；主界面关闭双击、捏合缩放，减少误操作 |
| 🔐 | **本机凭据保存** | 登录凭据和应用缓存保存于本机钥匙串，业务请求直连各平台 |

## 📲 下载安装

从 [**Releases**](https://github.com/xzd11/mashangqu-ios-/releases) 下载 iOS 安装包：

> [mashangqu-ios-v1.0.0.ipa](https://github.com/xzd11/mashangqu-ios-/releases/download/v1.0.0/mashangqu-ios-v1.0.0.ipa)

1. 下载 `.ipa` 文件，无需解压。
2. 使用自己的签名工具重新签名后安装。
3. 打开应用，登录所需平台后使用。

| 项目 | 说明 |
|---|---|
| 版本 | 1.0.0（构建 9） |
| 架构 | ARM64 真机 |
| 最低系统配置 | iOS／iPadOS 15.0 |
| 已验证设备 | **仅 iPhone 15** |
| Bundle ID | `ink.mashangqu.ios` |
| 更新方式 | 下载新版 IPA，沿用同一签名身份和 Bundle ID 覆盖安装 |

最低系统配置不代表所有系统及机型已完成兼容性验证。安装包需要自行签名。

<details>
<summary><b>取件码查询说明</b></summary>

- 需要先登录淘宝／菜鸟账户。
- 查询使用的是快递运单号，不是购物订单号。
- 查询范围以当前登录账户可访问的数据为准。
- 已取件、查无结果或仅返回脱敏信息时会明确提示；无法从脱敏信息还原完整取件码。

</details>

## 🛡️ 隐私与架构

应用使用 UIKit／WKWebView 容器与本地网页界面。原生桥接负责网络请求、钥匙串存储和二维码／条形码生成。账户登录通过对应平台页面完成，业务请求直接访问平台接口。

平台接口和登录流程可能变化，相关功能届时可能需要更新。

<details>
<summary><b>从源码构建</b></summary>

源码位于 [`ios/`](ios/)，构建方法见 [`ios/README.md`](ios/README.md)。

Linux 环境安装 `ios/requirements.txt` 并准备 LLVM `ld64.lld` 后，在 `ios/` 目录执行：

```bash
python build_native.py
python package_ipa.py
```

构建生成供自行签名的 IPA。版本为 iOS 1.0.0，不与上游 Android 版本号同步。

</details>

<details>
<summary><b>发布文件与校验</b></summary>

- Release 标签：`v1.0.0`。
- 安装包：`mashangqu-ios-v1.0.0.ipa`。
- 校验文件：`SHA256SUMS`。
- 更新记录：[`docs/releases/v1.0.0.md`](docs/releases/v1.0.0.md)。

安装包使用与上游类似的带版本号命名方式，发布到本仓库 Releases。

</details>

## 🗂️ 项目结构

| 路径 | 内容 |
|---|---|
| `ios/native/` | 原生容器、网络桥接、钥匙串和码图生成 |
| `ios/web/` | 本地界面与平台适配逻辑 |
| `ios/assets/` | 应用图标 |
| `ios/Info.plist` | iOS 版本与应用配置 |
| `docs/releases/` | iOS 更新记录与校验文件 |
| `app/`、`server/`、`update/` | 保留的上游 Android 工程与相关文件 |

## 📝 更新记录

**v1.0.0 · 首个 iOS 社区正式版**

- 修复启动闪退，调整拼多多、顺丰和京东登录页面布局。
- 完善身份码刷新，菜鸟使用条形码展示。
- 新增菜鸟运单取件码查询及快递列表一键查码。
- 主页条形码改为横向全屏放大，关闭双击误缩放。
- 移除界面测试标识。

## 🤝 开源与致谢

原项目：[njpemo/mashangqu](https://github.com/njpemo/mashangqu)，原作者 **njpemo**。本 iOS 移植版保留原作者署名，遵循 [MIT License](LICENSE)。

原项目 Android 说明另存于 [`docs/README-upstream.md`](docs/README-upstream.md)，其中 Android 专属功能不代表 iOS 功能。

---

<div align="center">

**码上取** — 少装几个 App，快一点取到快递

</div>
