# STM32 Serial Flasher

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-STM32%20Serial%20Flasher-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=totok22.serialflash-stm32)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

在 VS Code 中，通过 STM32 的 ROM USART Bootloader 烧录 `.hex` 和 `.bin` 固件。
板载 USB-UART 桥和 BOOT0/NRST 电路适配后，开发板的 USB-C 接口就能完成整个烧录流程。
使用这条连接烧录时，无需 ST-Link。

[English](README.md) · [使用手册](docs/USAGE.md) · [参与开发](CONTRIBUTING.md)

## 为什么做这个项目

我平时使用 macOS，工作流里没有原生的 FlyMCU 应用。
FlyMCU 的界面在我看来也比较老旧。
我已经在 VS Code 中编译固件，因此希望在同一个编辑器里完成烧录。

我的开发板用 USB-C 连接 USB-UART 桥，并配有自动下载电路。
SerialFlash 复用这条连接，完成进入 Bootloader、擦除、写入、校验和复位运行。
这套流程需要电路和 MCU 的启动配置配合。

## 安装

从 [VS Code 扩展市场安装 STM32 Serial Flasher](https://marketplace.visualstudio.com/items?itemName=totok22.serialflash-stm32)，
或执行：

```bash
code --install-extension totok22.serialflash-stm32
```

当前已发布版本为 **0.2.0**。
下图中的中英文面板属于尚未发布的源码改动，扩展市场的 0.2.0 暂不包含这项更新。
发布范围见 [CHANGELOG.md](CHANGELOG.md)。

本地构建请按 [CONTRIBUTING.md](CONTRIBUTING.md) 操作，再用 **Extensions: Install from VSIX** 安装生成的 VSIX。

## 面板预览

![VS Code 中的中文 SerialFlash 面板](docs/assets/vscode-panel.zh-CN.png)

中文面板预览（与插件共用 Webview 代码；配置示例，未执行烧录）。
面板跟随 VS Code 显示语言：中文使用中文，其他语言回退到英文。

## 可以做什么

- 从烧录面板、Activity Bar 侧边栏、命令面板、文件右键菜单或状态栏进入烧录流程。
- 选择 `.hex` 或 `.bin` 构建产物，也可从工作区自动发现候选文件。
- 使用 CH340C/CH340X 复位预设、手动进入 Bootloader，或自定义 DTR/RTS 映射。
- 记住成功烧录时的配置，为不同板卡或固件目标保存命名配置（profile）。
- 在 VS Code 中将现有构建任务与 SerialFlash 任务串联。
- 查看进度、最近历史、完整 Output 日志和主机、串口诊断信息。

## 连接前的准备

需要 VS Code Desktop 1.90 或更高版本，以及能被操作系统识别的 USB-UART 设备。
插件安装包包含 `serialport`，串口芯片所需的驱动仍需按系统情况安装。

STM32 必须引出 ROM Bootloader 支持的 USART。
请按具体型号查阅
[ST AN2606](https://www.st.com/resource/en/application_note/an2606-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf)，
核对串口引脚和启动条件。能否使用取决于 MCU、启动配置、接线和 Bootloader 支持的命令。

仅有 USB-C 接口不足以判断是否适配。
本流程需要接口连接 USB-UART 桥，再接到指定 USART。
如果接口只连接 STM32 原生 USB 外设，就属于另一种下载方式。

## 第一次烧录

1. 编译固件，在 VS Code 中打开工程文件夹。
2. 连接开发板的 USB-UART 接口，关闭占用该串口的其他工具。
3. 在命令面板执行 **SerialFlash: Open Flasher Panel**，也可点击 Activity Bar 的 SerialFlash 图标。
4. 选择 `.hex` 或 `.bin` 文件，以及开发板对应的串口。
5. 根据下一节的实际电路选择复位模式。
6. 核对地址和写入选项，执行 **SerialFlash: Flash Latest Firmware**。
7. 在 Output 日志中查看 Bootloader 版本、PID 和写入、校验结果，再观察板上程序是否运行。

macOS 快捷键为 `Cmd+Alt+F`，Windows/Linux 为 `Ctrl+Alt+F`。
插件默认使用 `115200 8E1`，依次执行写入前擦除、写入后校验、复位运行和关闭串口。
擦除会删除芯片上已有的应用程序和其他 Flash 内容。

成功烧录后，插件会记住串口、固件、复位模式和波特率。
更换板卡或构建目标时，请重新核对这些值。

## 接线与复位模式

USB-UART 桥的 TX 接 Bootloader USART 的 RX，RX 接 TX，并连接公共地。
外接串口模块时，请先核对板卡的供电和信号电压要求。
自动进入 Bootloader 还需要 DTR/RTS 通过适配电路控制 BOOT0 和 NRST。

| 复位模式 | 用途 |
| --- | --- |
| `dtr-low-rts-high` | CH340C 经典自动下载电路，插件默认值 |
| `ch340x` | 为历史实测 CH340X 板卡保留的预设，需核对实际映射 |
| `none` | 手动进入 ROM Bootloader，插件不驱动 DTR/RTS |
| `dtr-high-rts-low` | 通用 DTR 高电平复位、RTS 低电平 BOOT 预设 |
| `custom` | 为其他电路配置控制线映射 |

### CH340C 自动下载电路

![CH340C 自动下载电路](docs/assets/ch340c-auto-download.png)

这套电路在控制线与 BOOT0/RESET 之间加入三极管。
图示电路使用 `dtr-low-rts-high`。选择预设时要看实际接线，不能只看串口芯片型号。

### CH340X 自动下载电路

![CH340X 自动下载电路](docs/assets/ch340x-auto-download.png)

参考图用 RTS# 控制 RESET，增强 DTR# 控制 BOOT0。
这与现有 `ch340x` 预设历史记录中的软件控制线名称存在差异。
选择预设前，请核对实际板卡映射，并阅读[硬件说明](docs/CH340_HARDWARE.md)。

电路图来源：[WCH-SoftGroup 原文说明](https://www.cnblogs.com/WCH-SoftGroup/p/16520720.html)
和 [WCH 官方方案](https://www.wch.cn/application/575.html)。
硬件说明中保留了时序、电路差异和历史 CLI 结果。

## 固件选择与地址

只要已配置的固件路径存在，插件就优先使用它，包括成功烧录后记住的路径。
因此，即使工作区出现更新的产物，**Flash Latest Firmware** 仍可能复用原文件。

已配置文件不存在时，插件会按修改时间、构建路径、文件格式、工作区名称匹配和记忆路径评分。
体积过小的 BIN 会降低评分。只有一个候选或首位明显领先时，插件自动选中；否则由你选择。
自动发现会排除 `CMakeFiles` 中的编译器检查产物，这类文件是构建探测程序，不是板卡固件。

| 固件 | 未显式设置 `serialFlash.flashAddress` 时的地址 |
| --- | --- |
| Intel HEX（`.hex`） | 文件中记录的基地址 |
| 原始二进制（`.bin`） | `0x08000000` |

显式设置 `serialFlash.flashAddress` 会覆盖上述两种默认行为。
插件的固件入口仅提供 `.hex` 和 `.bin`，ELF 产物需要先导出为其中一种格式。
用 **Show Firmware Info** 检查文件信息，再从 Output 日志核对实际烧录地址。

## 桌面、远程主机与验证范围

SerialFlash 在 VS Code 扩展宿主（Extension Host）中使用 Node 和原生串口绑定。
运行目标是 macOS、Windows 和 Linux 桌面宿主，前提是原生依赖能加载，系统能访问串口。

在 Remote SSH、WSL 或 Dev Containers 中，串口属于运行扩展宿主的机器。
执行 **SerialFlash: Run Diagnostics**，检查当前宿主和可见串口。
插件无法在 `vscode.dev` 或 `github.dev` 中烧录。

现有硬件依据是 macOS 下特定 CH340C 和 CH340X 板卡的历史 CLI 测试，见
[CH340_HARDWARE.md](docs/CH340_HARDWARE.md)。当前插件的硬件覆盖仍需按
[HARDWARE_VALIDATION.md](docs/HARDWARE_VALIDATION.md) 模板补充验证。

## 更多文档

| 文档 | 内容 |
| --- | --- |
| [使用手册](docs/USAGE.md) | 命令、设置、命名配置、任务与故障排查 |
| [硬件说明](docs/CH340_HARDWARE.md) | 电路、复位时序和历史测试 |
| [协议说明](docs/STM32_PROTOCOL.md) | STM32 USART Bootloader 协议要点 |
| [参与开发](CONTRIBUTING.md) | 安装依赖、F5 调试、测试与打包 |
| [变更记录](CHANGELOG.md) | 已发布和未发布的改动 |

## 仓库分支

VS Code 插件是项目的主要版本，位于 [`main`](https://github.com/totok22/SerialFlash/tree/main)。
浏览器 Web Serial 页面和 Node CLI 单独维护在 [`web`](https://github.com/totok22/SerialFlash/tree/web)。
浏览器要求和 CLI 命令请按该分支的说明操作。
旧的 `vscode-extension` 分支名仅作为历史记录保留。

## 许可证

[MIT](LICENSE)。
