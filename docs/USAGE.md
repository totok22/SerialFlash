# SerialFlash 使用手册

本手册说明 VS Code 插件的命令、设置、命名配置、任务和排查方法。
安装与首次烧录见 [中文首页](../README.zh-CN.md)，电路与时序见 [CH340_HARDWARE.md](CH340_HARDWARE.md)。

## 版本与运行环境

扩展市场标识为 `totok22.serialflash-stm32`，已发布版本为 0.2.0。
中英文面板和 CMake 编译器检查产物过滤属于未发布改动，详见 [CHANGELOG.md](../CHANGELOG.md)。
面板按 VS Code 显示语言选择中英文：中文使用中文，其他语言使用英文。
命令名称在下文统一按命令面板中的英文标题列出。

插件需要 VS Code Desktop 1.90 或更高版本，并在扩展宿主（Extension Host）中加载 Node `serialport`。
安装包包含生产依赖，开发源码需要先安装依赖。USB-UART 驱动和设备访问权限由操作系统提供。
macOS、Windows 和 Linux 是运行目标，不代表全部组合均已完成硬件验证。

Remote SSH、WSL 和 Dev Containers 中只能访问实际扩展宿主上的串口。
用 `Run Diagnostics` 查看宿主、原生依赖和可见设备。`vscode.dev`、`github.dev` 不支持此插件的串口烧录。
USB-C 接口需要连接 USB-UART 桥及指定 USART；STM32 原生 USB 下载不在本插件的串口流程内。

## 界面与常用操作

Activity Bar 中的 SerialFlash 侧边栏显示当前固件、端口、复位模式、动作和最近历史。
点击当前项可以重新选择；状态栏空闲时打开面板，烧录中打开 Output。

面板顶部显示固件、端口、复位模式和执行状态。
参数、硬件复位、项目与自动化、维护操作放在折叠区域内。
配置和维护按钮在烧录中禁用，取消、输出和诊断仍可用。
面板日志显示最近 18 行，完整日志请打开 SerialFlash Output。

历史最多保存 20 条，侧边栏和面板显示最近 8 条。
相同固件、端口和复位模式的新记录会替换旧记录。历史记录包含成功或失败状态，不代表所有尝试均会保留。

在资源管理器或编辑器标签页右键 `.hex`、`.bin`，可烧录、校验、设为当前固件或查看文件信息。
默认烧录快捷键为 macOS `Cmd+Alt+F`、Windows/Linux `Ctrl+Alt+F`。

## 命令参考

按 `Cmd/Ctrl+Shift+P` 打开命令面板，输入 `SerialFlash:`。
下表省略该前缀。

| 命令 | 作用 |
| --- | --- |
| `Flash Latest Firmware` | 优先烧录已配置文件，否则自动发现或提示选择 |
| `Flash Current File` | 将当前文件或右键文件设为固件，并烧录 |
| `Select Firmware` | 从工作区候选中选文件，保存为当前固件 |
| `Set as SerialFlash Firmware` | 将右键文件设为当前固件，不烧录 |
| `Show Firmware Info` | 查看格式、字节数、文件基地址、修改时间和路径 |
| `Select Serial Port` | 从枚举结果选择串口，显示厂家、序列号、VID/PID |
| `Select Reset Mode` | 选择复位预设或自定义模式 |
| `Open Flasher Panel` | 打开图形面板 |
| `Reset To Bootloader` | 只发送控制线时序，不执行 Bootloader 握手验证 |
| `Reset And Run` | 只发送复位运行时序，不验证应用程序是否运行 |
| `Cancel Flash` | 请求取消当前烧录，等待流程检查点处理 |
| `Show Output` | 打开完整日志 |
| `Run Diagnostics` | 检查扩展宿主、`serialport` 加载和串口枚举 |
| `Erase Chip` | 确认后连接 Bootloader，整片擦除 |
| `Verify Firmware` | 连接 Bootloader，读回并比较当前或右键固件 |
| `Unlock Read Protection` | 确认后发送解除读保护命令，会整片擦除 |
| `Close Port` | 释放插件在成功烧录后保留的连接 |
| `Clear Remembered Device` | 清除成功配置的全局记忆和当前端口设置，其他设置见下文 |
| `Create Project Config` | 将当前状态合并写入首个工作区文件夹的 `.vscode/settings.json` |
| `Create Tasks` | 合并生成首个工作区文件夹的 `.vscode/tasks.json` |
| `Create Project Profile` | 保存当前烧录设置为命名配置，同名配置会替换 |
| `Select Project Profile` | 将所选配置中的字段应用到当前设置 |
| `Clear Flash History` | 清空历史记录 |
| `Refresh` | 刷新侧边栏及面板状态 |

`Show Firmware Info` 中的基地址来自文件，不包含显式 `flashAddress` 覆盖。
实际使用的地址以烧录 Output 中的 `Flash address` 为准。
`Run Diagnostics` 不会连接 Bootloader，也不会读取 MCU 的版本和 PID；这些信息来自握手日志。

取消在阶段之间检查，当前写入、读回或等待请求可能仍需完成或超时。
取消不能恢复已擦除或写入的内容。

## 固件选择与地址

`Flash Latest Firmware` 先读取 `serialFlash.firmware`，为空时再使用成功烧录后记住的路径。
只要该路径存在，就复用该文件，不比较其他产物的新旧。
手动选择固件和成功烧录都可能将固件路径写入设置。
更换构建目标时，应重新选择文件或修改配置。

已配置固件不存在时，若 `autoDiscoverFirmware` 为 `true`，插件扫描工作区：

1. 按 `firmwareGlobs` 查找文件，用 `excludeGlobs` 排除路径并去重。
2. 只保留 `.hex` 和 `.bin`，排除 `CMakeFiles` 目录中的编译器检查产物。
3. 根据修改时间、HEX/BIN 格式、`build`/`debug`/`release` 路径、`cmake-build-` 目录名、工作区名称匹配和记忆路径评分。小于 1,024 字节的 BIN 降低评分。
4. 只有一个候选或首位领先至少 35 分时自动选择，否则打开候选列表。

这套评分不能判断文件是否适合你的板卡。首次烧录前请核对候选名称、格式和地址。
`CMakeFiles` 过滤仅作用于自动发现；已明确配置的现有路径仍有优先权。
关闭 `autoDiscoverFirmware` 后，仍可运行 `Select Firmware` 手动挑选。

| 文件格式 | 地址规则 |
| --- | --- |
| `.hex` | 未显式配置地址时，使用 Intel HEX 中最低的数据地址 |
| `.bin` | 未显式配置地址时，使用 `0x08000000` |
| 任一格式 | 显式 `serialFlash.flashAddress` 覆盖文件基地址或 BIN 默认地址 |

HEX 会校验记录长度、校验和和 EOF，并将地址间隙填为 `0xFF`。
有引导程序或偏移应用区时，请核对链接地址与写入地址。
插件不直接提供 ELF 烧录入口，需由构建系统导出 `.hex` 或 `.bin`。

相对路径以首个工作区文件夹为基准；也可使用绝对路径。
多根工作区可扫描多个文件夹，但配置文件生成和相对路径解析以首个文件夹为准。
需要稳定区分目标时，使用明确的固件路径或命名配置。

## 设置参考

所有键均以 `serialFlash.` 开头。下表省略前缀。
设置可在 VS Code 用户或工作区设置中修改，主要烧录参数也可在面板内修改。

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| `firmware` | `""` | 相对或绝对固件路径，空值回退到成功记忆 |
| `port` | `""` | 如 `/dev/tty.usbserial-10`、`COM3`，空值回退到成功记忆 |
| `baudRate` | `115200` | 串口波特率 |
| `parity` | `"even"` | `even` 或 `none`；数据位 8、停止位 1 固定 |
| `resetMode` | `"dtr-low-rts-high"` | 按实际电路选择，见下一节 |
| `customReset.boot0High` | `"dtr-false"` | 自定义模式下建立 BOOT 条件的控制线状态 |
| `customReset.boot0Low` | `""` | 空值表示与 `boot0High` 相反 |
| `customReset.resetAssert` | `"rts-true"` | 自定义模式下触发复位的控制线状态 |
| `flashAddress` | 自动判定，见说明 | 显式地址覆盖 HEX/BIN 自动地址 |
| `packetSize` | `256` | 包大小，允许 1～256 字节；通常保持默认值 |
| `timeout` | `2000` | 普通串口读取超时，单位为 ms |
| `eraseBeforeWrite` | `true` | 写入前整片擦除 |
| `verifyAfterWrite` | `true` | 写入后读回比较 |
| `runAfterWrite` | `true` | 成功后发送复位运行时序 |
| `closePortAfterWrite` | `true` | 成功后关闭连接 |
| `unlockReadProtection` | `false` | 擦除收到 NACK 时尝试解除读保护，会整片擦除 |
| `autoDiscoverFirmware` | `true` | 已配置固件不存在时自动查找 |
| `firmwareGlobs` | `["**/*.hex", "**/*.bin"]` | 自动发现包含范围 |
| `excludeGlobs` | `["**/{node_modules,.git,dist}/**"]` | 自动发现排除范围 |
| `projects` | `[]` | 命名配置数组，见后文 |

manifest 将 `flashAddress` 的显示默认值声明为 `0x08000000`。
运行时会检查用户、工作区和文件夹是否显式设置地址；均未设置时，HEX 使用文件地址。
面板地址留空同样恢复自动地址，BIN 仍默认 `0x08000000`。
地址可写成十六进制字符串或十进制字符串。

`timeout` 不改变复位时序中的固定等待时间。
整片擦除 ACK 另有 60 秒等待，解除读保护的后续 ACK 等待为 15 秒。
只有确认 MCU 和电路要求后才调整参数。

关闭 `closePortAfterWrite` 会让成功连接由插件继续持有，并不会自动接入串口终端。
其他串口工具使用前请执行 `Close Port`。烧录流程失败时，即使该选项关闭也会释放连接。
`none` 模式不发送硬件复位，因此 `runAfterWrite` 不能替你手动复位板卡。

以下设置适用于工作区根目录下有 `build/Debug/app.hex` 的示例工程：

```json
{
  "serialFlash.firmware": "build/Debug/app.hex",
  "serialFlash.port": "/dev/tty.usbserial-10",
  "serialFlash.resetMode": "dtr-low-rts-high",
  "serialFlash.baudRate": 115200,
  "serialFlash.parity": "even",
  "serialFlash.firmwareGlobs": ["build/**/*.hex", "build/**/*.bin"],
  "serialFlash.excludeGlobs": ["**/{node_modules,.git,dist}/**"]
}
```

按实际系统修改端口。此例未固定地址，因此 HEX 保留文件基地址。

## 复位模式

| 模式 | 适用方式 |
| --- | --- |
| `dtr-low-rts-high` | 图示 CH340C 经典自动下载电路，插件默认 |
| `ch340x` | 历史实测 CH340X 板卡的预设，需核对实际控制线映射 |
| `dtr-high-rts-low` | 通用 DTR 高电平复位、RTS 低电平 BOOT 预设 |
| `none` | 用户手动满足启动条件并复位，插件不驱动控制线 |
| `custom` | 按实际电路自定义映射 |

项目内部约定 `true` 为低电平，`false` 为高电平。
`src/node-serial-transport.js` 负责取反为 Node `serialport` 语义，配置时不要再次取反。
可选状态为 `dtr-true`、`dtr-false`、`rts-true` 和 `rts-false`。
这些值描述桥接控制线状态，板上三极管可能再次改变 MCU 引脚电平。

```json
{
  "serialFlash.resetMode": "custom",
  "serialFlash.customReset.boot0High": "dtr-false",
  "serialFlash.customReset.boot0Low": "",
  "serialFlash.customReset.resetAssert": "rts-true"
}
```

此例仅展示配置格式，不能作为任意板卡的通用接法。
CH340X 参考图用 RTS# 接 RESET、增强 DTR# 接 BOOT0，与现有预设历史描述中的控制线名称有差异。
不要直接按芯片型号套用；请先核对实际拓扑和引脚电平，详见硬件说明。
各 STM32 的启动条件和 USART 引脚以
[ST AN2606](https://www.st.com/resource/en/application_note/an2606-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf)
中对应型号为准。电路、固定等待和历史 CLI 记录见 [CH340_HARDWARE.md](CH340_HARDWARE.md)。

## 配置文件与记忆

`Create Project Config` 要求已打开文件夹，将当前烧录状态合并到首个文件夹的 `.vscode/settings.json`。
已有其他设置值会保留，同名 SerialFlash 设置更新为当前值。
读取支持注释和尾逗号，写回采用格式化 JSON，因此原注释和排版不会保留。
此命令写入发现范围，但不会导出 `serialFlash.projects` 数组。

面板编辑或选择操作有工作区时写入工作区设置，没有工作区时写入用户设置。
成功烧录会更新全局记忆，并将固件路径和复位模式写入设置。
全局记忆可能跨工作区复用；显式设置和所选目标仍需核对。

`Clear Remembered Device` 清除全局保存的端口、固件、复位模式和波特率，并移除当前层级的端口设置。
该命令不清除显式固件、复位模式、波特率或命名配置，也不关闭连接。
如需恢复自动发现，请另外清空 `serialFlash.firmware`；如需释放连接，请执行 `Close Port`。

## 命名配置

用 `Create Project Profile` 保存当前状态，输入名称；同名配置会替换。
用 `Select Project Profile` 将配置中的字段应用到当前设置。
手写的部分配置只覆盖列出的字段，未列出的值继续沿用。
自动发现开关和 globs 不属于命名配置的应用字段。

```json
{
  "serialFlash.projects": [
    {
      "name": "can2rs485-debug",
      "firmware": "build/Debug/CAN2RS485.hex",
      "port": "/dev/tty.usbserial-10",
      "resetMode": "ch340x",
      "flashAddress": "",
      "baudRate": 115200,
      "parity": "even",
      "eraseBeforeWrite": true,
      "verifyAfterWrite": true,
      "runAfterWrite": true,
      "closePortAfterWrite": true,
      "unlockReadProtection": false
    }
  ]
}
```

`flashAddress` 留空可在切换配置时清除旧的显式地址，恢复 HEX/BIN 自动地址。
端口路径取决于运行扩展宿主的系统；多人共用配置前请检查设备差异。

## VS Code 任务

`Create Tasks` 在首个工作区文件夹生成 3 个 `serialFlash` 类型任务。
合法 `action` 为 `flashLatest`、`bootloader` 和 `run`。
命令会保留其他任务，并替换与生成任务同名的条目。
读取支持 JSON 注释和尾逗号，写回会移除注释并重排格式。
任务使用当前设置，不会自动编译固件。

已有 `Build firmware` 任务时，可按下面的方式顺序执行构建和烧录。
先把该名称替换为你的实际构建任务标签，并保留原任务定义：

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "SerialFlash: Flash Latest Firmware",
      "type": "serialFlash",
      "action": "flashLatest",
      "problemMatcher": []
    },
    {
      "label": "Build and flash",
      "dependsOrder": "sequence",
      "dependsOn": ["Build firmware", "SerialFlash: Flash Latest Firmware"],
      "problemMatcher": []
    }
  ]
}
```

任务仍遵循已配置固件优先规则。构建任务应生成该文件，或用命名配置明确目标。
以 SerialFlash Output 的写入、校验结果判断是否成功，不能仅凭任务终端结束判断硬件状态。

## 故障排查

先运行 `Show Output` 读取完整日志，再用 `Run Diagnostics` 核对扩展宿主、依赖和端口。
保存的端口名称不代表设备当前已连接；只看到蓝牙或调试端口时，应先检查 USB 数据线、驱动和板卡连接。

| 现象 | 检查方法 |
| --- | --- |
| 找不到固件 | 先构建，确认导出 `.hex`/`.bin`，检查工作区和 globs；CMake 编译器检查产物不会作为候选 |
| 烧录了旧文件 | 查看 `serialFlash.firmware` 和记忆路径，重新选择正确目标；“Latest”不代表只按时间选文件 |
| 串口占用或拒绝访问 | 关闭串口监视器和其他下载工具；插件持有连接时执行 `Close Port` |
| `EACCES` 或 `EPERM` | 检查设备权限和用户组；Linux 按发行版配置串口设备访问权限 |
| 收不到 Bootloader ACK | 按具体 MCU 核对 USART 引脚、BOOT 条件、NRST、电路预设和默认 `115200 8E1` |
| 持续收到用户程序输出 | 先用 `none` 配合手动启动确认 ROM Bootloader 可达，再排查自动复位电路 |
| 返回 NACK | 检查命令支持、读保护、地址和擦除状态，不要直接开启解除读保护 |
| 校验失败 | 核对固件目标、链接地址、显式写入地址和擦除选项，保存第一个不匹配地址 |
| HEX 解析失败 | 检查构建导出、校验和、记录长度和 EOF，确认文件完整 |
| `serialport` 加载失败 | 检查宿主平台和架构；源码运行先安装依赖，安装版可重装适配的 VSIX，再运行诊断 |
| Remote 中找不到本机串口 | 核对扩展实际运行位置，确保设备对该宿主可见 |
| 写入后程序没有运行 | 检查 BOOT 条件是否退出、NRST 时序和应用固件；`none` 需要手动复位 |

同步逻辑会忽略 ACK 前的噪声字节，但不能替代正确进入 Bootloader。
若全片擦除耗时较长，协议层会等待最多 60 秒，普通 `timeout` 不控制这段等待。

`Erase Chip` 和 `Unlock Read Protection` 有独立确认。
常规烧录默认也会整片擦除；自动解除读保护开关仅在擦除返回 NACK 时启用补救流程。
解除读保护会清空芯片内容，且是否允许解除取决于 MCU 当前保护状态。

反馈问题时请提供系统、VS Code 与插件版本、扩展宿主、板卡、MCU、桥接芯片、复位模式和固件格式。
诊断报告只包含主机与串口信息；握手成功后再从 Output 补充 Bootloader 版本、PID 和首个失败阶段。
实机结果按 [HARDWARE_VALIDATION.md](HARDWARE_VALIDATION.md) 记录，历史 CLI 成功记录不能替代当前插件测试。
