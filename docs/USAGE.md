# SerialFlash 使用手册

[English](USAGE.en.md)

本手册详细说明 STM32 Serial Flasher 扩展的操作界面、命令、配置项、Tasks 任务链与故障排查方法。

基础安装与快速开始请参阅 [项目首页](../README.zh-CN.md)，硬件电路与控制线时序请参阅 [CH340 硬件说明](CH340_HARDWARE.md)。

---

## 1. 运行环境与交互入口

### 运行环境要求
- **VS Code 版本**：VS Code Desktop 1.90 或更高版本。
- **扩展宿主**：底层通信依赖 Node `serialport` 原生模块，在桌面扩展宿主中运行。
- **远程开发注意**：在 Remote SSH、WSL 或 Dev Container 环境下，枚举和访问的串口归属于**运行扩展宿主的远端系统**。可通过 `SerialFlash: Run Diagnostics` 查看当前宿主环境与可见设备。

### 交互入口
- **Webview 面板**：点击侧边栏或执行 `SerialFlash: Open Flasher Panel` 打开。面板提供固件/串口选择、参数修改、高级操作折叠区及最近 18 行运行日志。
- **Activity Bar 侧边栏**：显示当前目标固件、连接端口、复位模式、快捷动作及最近 8 条烧录历史记录。
- **状态栏**：空闲时显示当前配置的串口，点击可快速打开面板；烧录过程中显示实时百分比进度。
- **文件右键菜单**：在资源管理器或编辑器标签页中右键 `.hex` / `.bin` 文件，可直接触发烧录、校验或设为当前固件。
- **全局快捷键**：
  - macOS: `Cmd+Alt+F`
  - Windows / Linux: `Ctrl+Alt+F`

---

## 2. 命令参考

通过 `Cmd/Ctrl+Shift+P` 打开命令面板，输入 `SerialFlash:` 即可过滤相关命令：

### 烧录与芯片控制
| 命令 | 说明 |
| --- | --- |
| `Flash Latest Firmware` | 核心烧录命令。优先使用已配置/记忆固件，否则触发自动发现；随后执行擦除、写入、校验与复位运行 |
| `Flash Current File` | 将当前活动编辑器或右键选中的 `.hex` / `.bin` 文件设为固件并立即烧录 |
| `Cancel Flash` | 请求中断当前烧录流程（在传输检查点处安全停止） |
| `Verify Firmware` | 连接 Bootloader，读回 Flash 内容并与当前固件逐字节比对 |
| `Erase Chip` | 确认后连接 Bootloader 执行全片擦除 |
| `Unlock Read Protection` | 确认后发送解除读保护指令（**注意：MCU 硬件会自动擦除全部 Flash 内容**） |
| `Reset To Bootloader` | 仅驱动 DTR/RTS 进入 Bootloader 启动状态，不进行协议握手 |
| `Reset And Run` | 仅驱动复位时序以重启并运行芯片内用户程序 |
| `Close Port` | 手动释放当前占用的串口连接 |

### 固件管理
| 命令 | 说明 |
| --- | --- |
| `Select Firmware` | 扫描工作区固件候选，通过 Quick Pick 选择并保存为当前固件 |
| `Set as SerialFlash Firmware` | 将资源管理器或编辑器中右键选中的文件设为当前固件（不立即烧录） |
| `Show Firmware Info` | 查看当前文件的格式、字节大小、文件内基地址、修改时间与绝对路径 |

### 设备与模式配置
| 命令 | 说明 |
| --- | --- |
| `Select Serial Port` | 重新枚举系统可用串口并进行选择（展示厂商、VID/PID 及序列号） |
| `Select Reset Mode` | 选择复位预设（CH340C / CH340X / 手动 / 自定义映射） |
| `Open Flasher Panel` | 打开图形化烧录控制面板 |
| `Show Output` | 打开 VS Code 专用的 SerialFlash 输出日志通道 |
| `Run Diagnostics` | 检查扩展宿主运行平台、`serialport` 加载状态及串口枚举详情 |

### 项目与历史管理
| 命令 | 说明 |
| --- | --- |
| `Create Project Config` | 将当前面板参数合并写入工作区根目录的 `.vscode/settings.json` |
| `Create Tasks` | 在工作区根目录下生成或合并标准 `.vscode/tasks.json` 烧录任务 |
| `Create Project Profile` | 将当前配置保存为一个命名 Profile（多项目/多板卡切换） |
| `Select Project Profile` | 选择已保存的 Profile，将其参数应用到当前环境 |
| `Clear Remembered Device` | 清除成功烧录后全局保存的串口、固件路径与波特率记忆 |
| `Clear Flash History` | 清空历史烧录记录列表 |
| `Refresh` | 手动刷新侧边栏与面板状态 |

---

## 3. 固件发现与地址判定

### 检索与选择优先级
1. **显式配置优先**：若 `serialFlash.firmware` 或上次成功烧录记忆的文件路径存在，优先使用该文件。
2. **自动检索**：若未指定文件或文件不存在，且开启了 `serialFlash.autoDiscoverFirmware`（默认开启）：
   - 根据 `firmwareGlobs` 在工作区内搜索 `.hex` 与 `.bin`；
   - 依据 `excludeGlobs` 排除匹配目录（如 `node_modules`、`.git`、`dist` 等）；
   - **自动过滤**：构建系统的内部测试产物（如 `CMakeFiles/` 下的编译器检查探测文件）会被自动忽略；
   - 综合修改时间、文件类型与构建路径进行优选；若只有一个最佳候选则自动选中，多候选时弹出 Quick Pick 供用户选择。

### Flash 地址判定规则
| 固件格式 | 默认地址 | 说明 |
| --- | --- | --- |
| Intel HEX (`.hex`) | 文件内基地址 | 自动解析 HEX 头部中的扩展线性地址记录（如 `0x08000000`） |
| 原始二进制 (`.bin`) | `0x08000000` | BIN 文件不含地址元数据，采用 STM32 片内 Flash 默认基地址 |

> [!TIP]
> 若应用程序设计了 Bootloader 偏移（例如中断向量表偏移到 `0x08008000`），可通过在设置中显式指定 `serialFlash.flashAddress` 覆盖默认地址。

---

## 4. 设置项说明

所有配置项均以 `serialFlash.` 为前缀。可在 VS Code 用户设置、工作区设置或通过烧录面板进行修改。

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `firmware` | `string` | `""` | 目标固件路径（支持相对工作区的相对路径或绝对路径） |
| `port` | `string` | `""` | 串口路径（如 `/dev/tty.usbserial-10`、`COM3`） |
| `baudRate` | `number` | `115200` | 串口波特率 |
| `parity` | `string` | `"even"` | 校验位（STM32 ROM Bootloader 协议固定要求 `"even"`） |
| `resetMode` | `string` | `"dtr-low-rts-high"` | 自动复位模式预设，可选值见下文 |
| `customReset.boot0High` | `string` | `"dtr-false"` | 自定义模式下触发进入 Bootloader 的控制线状态 |
| `customReset.boot0Low` | `string` | `""` | 自定义模式下恢复正常运行的控制线状态（留空表示反转） |
| `customReset.resetAssert` | `string` | `"rts-true"` | 自定义模式下触发芯片复位的控制线状态 |
| `flashAddress` | `string` | `""` | 显式烧录基地址（留空使用 HEX 内部地址或 BIN 默认地址） |
| `packetSize` | `number` | `256` | 写入数据包大小（1~256 字节，协议上限 256） |
| `timeout` | `number` | `2000` | 常规串口操作超时（毫秒） |
| `eraseBeforeWrite` | `boolean` | `true` | 写入前执行全片擦除 |
| `verifyAfterWrite` | `boolean` | `true` | 写入后读回校验 |
| `runAfterWrite` | `boolean` | `true` | 写入并校验成功后发送复位时序运行程序 |
| `closePortAfterWrite` | `boolean` | `true` | 流程结束后关闭串口（防止 DTR/RTS 持续影响板卡运行） |
| `unlockReadProtection` | `boolean` | `false` | 擦除遇 NACK 时尝试解除读保护（**会清空整片 Flash**） |
| `autoDiscoverFirmware` | `boolean` | `true` | 是否在未指定固件时自动检索工作区 |
| `firmwareGlobs` | `array` | `["**/*.hex", "**/*.bin"]` | 固件检索匹配模式列表 |
| `excludeGlobs` | `array` | `["**/{node_modules,.git,dist}/**"]` | 固件检索排除路径规则 |
| `projects` | `array` | `[]` | 命名 Profile 配置列表 |

### 典型工作区配置示例 (`.vscode/settings.json`)
```json
{
  "serialFlash.firmware": "build/Debug/app.hex",
  "serialFlash.port": "/dev/tty.usbserial-10",
  "serialFlash.resetMode": "dtr-low-rts-high",
  "serialFlash.baudRate": 115200,
  "serialFlash.eraseBeforeWrite": true,
  "serialFlash.verifyAfterWrite": true,
  "serialFlash.runAfterWrite": true
}
```

---

## 5. 复位模式与控制线约定

### 电平极性约定
项目内部定义：
- `true`：**低电平**（Assert / 导通）
- `false`：**高电平**（Deassert / 截止）

> [!NOTE]
> Node `serialport` 原生库的布尔语义相反，适配层 `src/node-serial-transport.js` 会自动处理反转，用户配置时无需额外计算。

### 模式列表
| 模式标识 | 预设含义 | 适用硬件拓扑 |
| --- | --- | --- |
| `dtr-low-rts-high` | DTR 低电平拉复位，RTS 高电平拉 BOOT | 采用经典 NPN/PNP 双三极管的 CH340C/CH340G 下载电路 |
| `ch340x` | 专用 RTS/DTR 脉冲时序 | CH340X 直连电路（RTS# 接 NRST，增强 DTR 接 BOOT0） |
| `dtr-high-rts-low` | DTR 高电平复位，RTS 低电平 BOOT | 部分反向逻辑或光耦隔离的自动下载模块 |
| `none` | 扩展不操作控制线 | 手动按板上 BOOT 键并按复位键，纯串口数据烧录 |
| `custom` | 允许用户指定控制线映射 | 特殊或自定义自动下载电路 |

### 自定义复位配置示例
```json
{
  "serialFlash.resetMode": "custom",
  "serialFlash.customReset.boot0High": "dtr-false",
  "serialFlash.customReset.boot0Low": "dtr-true",
  "serialFlash.customReset.resetAssert": "rts-true"
}
```

---

## 6. Profile 命名配置管理

对于需要维护多款开发板或区分 Debug/Release 固件的工程，可使用 Profile 机制。

执行 `SerialFlash: Create Project Profile`，输入配置名称（如 `board-f103-debug`），扩展将把当前配置写入 `.vscode/settings.json` 的 `serialFlash.projects` 数组：

```json
{
  "serialFlash.projects": [
    {
      "name": "board-f103-debug",
      "firmware": "build/Debug/app.hex",
      "port": "/dev/tty.usbserial-10",
      "resetMode": "dtr-low-rts-high",
      "flashAddress": "0x08000000",
      "baudRate": 115200
    },
    {
      "name": "board-f407-release",
      "firmware": "build/Release/firmware.bin",
      "port": "/dev/tty.usbserial-20",
      "resetMode": "ch340x",
      "flashAddress": "0x08000000",
      "baudRate": 115200
    }
  ]
}
```

切换时执行 `SerialFlash: Select Project Profile`，选中项的参数将自动覆盖工作区当前设置。

---

## 7. VS Code Tasks 自动化集成

执行命令 `SerialFlash: Create Tasks` 可自动在工程目录下创建 `.vscode/tasks.json`。支持的任务动作（`action`）：
- `flashLatest`：执行烧录最新固件
- `bootloader`：仅复位进入 Bootloader
- `run`：仅复位运行用户程序

### 串联编译与烧录任务
可将 SerialFlash 任务配置为依赖项，按顺序执行编译与烧录：

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build Firmware",
      "type": "shell",
      "command": "ninja -C build",
      "problemMatcher": []
    },
    {
      "label": "SerialFlash: Flash Latest Firmware",
      "type": "serialFlash",
      "action": "flashLatest",
      "problemMatcher": []
    },
    {
      "label": "Build & Flash",
      "dependsOrder": "sequence",
      "dependsOn": [
        "Build Firmware",
        "SerialFlash: Flash Latest Firmware"
      ],
      "problemMatcher": []
    }
  ]
}
```

---

## 8. 故障排查

遇到问题时，请先执行 `SerialFlash: Show Output` 查看完整通信日志，或执行 `SerialFlash: Run Diagnostics` 检查串口识别状态。

| 故障现象 | 常见原因 | 排查建议 |
| --- | --- | --- |
| **找不到固件** | 尚未编译或产物不在工作区 | 检查编译输出目录，确认生成了 `.hex` 或 `.bin`；检查 `firmwareGlobs` 设置 |
| **串口占用 / EACCES** | 其他串口终端或监视器占用了端口 | 关闭其他串口助手；在 Linux 下确认当前用户已加入 `dialout` 或 `uucp` 用户组 |
| **收不到 Bootloader ACK (`0x7F` 超时)** | 芯片未成功进入 Bootloader 状态 | 1. 核对硬件原理图引脚与复位模式预设；<br>2. 临时改用 `none` 模式，手动按住 BOOT0 键复位上电，以确认串口接线正常；<br>3. 检查串口 TX/RX 是否反接，是否共地 |
| **持续收到乱码或应用数据** | 复位时序未生效，芯片仍运行原有程序 | 检查自动复位电路三极管/MOS管工作状态，核对 DTR/RTS 信号波形 |
| **返回 NACK (`0x1F`)** | 目标命令不被芯片支持，或处于读保护状态 | 1. 检查目标型号在 [AN2606](https://www.st.com/resource/en/application_note/an2606-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf) 中的协议说明；<br>2. 若开启了读保护，可执行 `Unlock Read Protection`（注意将清空 Flash） |
| **校验失败 (Verify mismatch)** | 写入地址错误或擦除未完成 | 核对链接脚本中的 Flash 起始地址；确认 `eraseBeforeWrite` 为开启状态 |
| **写入完成后程序不运行** | BOOT0 仍被拉高，或未退出复位 | 检查 `closePortAfterWrite` 是否开启；CH340X 直连电路在端口保持开启时可能持续拉低 NRST |
| **Remote 模式下找不到本地串口** | 扩展运行在远程主机，无法枚举本地设备 | 确认 USB 转串口插入的物理机器与 VS Code 扩展宿主一致 |
