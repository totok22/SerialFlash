# VS Code 插件硬件验证规范与记录模板

本文件用于规范目标板在真实硬件环境下的烧录验证流程，统一记录环境参数与测试结果。

---

## 1. 验证目标与测试状态

在提交涉及复位时序、串口传输、协议握手或扩展宿主环境的关键变更时，须按此规范在真实硬件上执行回归测试。

### 历史测试与待回归清单
| 硬件环境 | MCU 型号 / Bootloader | 串口芯片及电路 | 测试状态 | 说明 |
| --- | --- | --- | --- | --- |
| macOS 27.3 arm64 | PDM / STM32F103C8T6（PID `0x0410`，BL `0x22`） | CH340C 经典外围电路 | 本次场景通过 | 开发宿主擦写校验和 GO 自动启动通过；复位对照结果见本次记录 |
| macOS 14+ | STM32F103 (CAN2RS485 板, PID `0x0413`, BL `0x31`) | CH340X 直连电路 | 本次结束复位待回归 | 此前入口及擦写已测（用户说明）；本次复位/GO 终态尚待实测 |
| Windows 11 | STM32F1 / F4 系列 | CH340 自动下载板 | 待回归 | 验证 Windows COM 端口与驱动表现 |
| Linux (Ubuntu) | STM32 系列 | CH340 / CP2102 | 待回归 | 验证 `/dev/ttyUSB*` 设备权限与枚举 |

---

## 2. 硬件测试记录模板

每次硬件验证应完整记录以下信息：

### 测试环境
- **日期**：
- **测试人员**：
- **操作系统与版本**：
- **VS Code 版本**：
- **插件版本**：
- **宿主类型**：Local Desktop / Remote SSH / WSL / Dev Container
- **开发板 / 目标板型号**：
- **MCU 具体型号与封装**：
- **串口芯片与接口**：
- **串口端口号**（如 `/dev/tty.usbserial-10`、`COM3`）：
- **自动复位模式**（`dtr-low-rts-high` / `ch340x` / `custom`）：

### 烧录配置
- **固件路径及格式**：`.hex` / `.bin`
- **固件大小 (Bytes)**：
- **波特率 / 校验位**：默认 `115200 8E1`
- **Flash 基地址**：
- **运行方式**：`hardware-reset` / `go` / 跳过运行
- **执行选项**：Erase [`x`] / Verify [`x`] / Run [`x`] / ClosePort [`x`]

### 验证步骤与结果
1. 执行 `SerialFlash: Run Diagnostics`，确认宿主环境与串口可见；
2. 执行 `SerialFlash: Flash Latest Firmware`（或在面板点击 Flash）；
3. 检查 Output 日志并确认以下指标：
   - [ ] 芯片成功进入 Bootloader，读取到 Bootloader 版本与芯片 PID；
   - [ ] Flash 擦除成功完成；
   - [ ] 固件分包写入成功；
   - [ ] 读回逐字节校验通过；
   - [ ] GO 收到 ACK，或硬件复位时序发送完成（仅证明请求完成）；
   - [ ] 应用实际运行，记录 LED、周期串口输出或其他独立证据；
   - [ ] 串口按预期释放，无端口占用残留。

### 日志输出样例
```text
[SerialFlash] Firmware: build/Debug/app.hex, HEX, 65536 bytes
[SerialFlash] Port: /dev/tty.usbserial-10 @ 115200 8E1
[SerialFlash] Reset: dtr-low-rts-high
[SerialFlash] Entering bootloader via DTR/RTS
[SerialFlash] Bootloader 0x31, PID 0x0413
[SerialFlash] Erase complete (extended)
[SerialFlash] Write 65536 bytes complete
[SerialFlash] Verify complete
[SerialFlash] Hardware reset sequence sent; application execution not confirmed
[SerialFlash] Done
```


### 关闭串口 A/B 对照

保持同一板卡、固件和运行方式，分别测试 `closePortAfterWrite=false` 与 `true`。记录应用在端口保持开启、关闭端口后和重新开启端口后的表现。开关端口可能改变控制线；重新开端口收到应用输出，不足以单独证明 GO 发出后立即运行。

## 3. 2026-11-08：CH340C PDM 验证

本次使用本地未发布开发代码，版本字段保留 `0.2.1`。结果仅适用于下列板卡和环境。

| 项目 | 本次配置 |
| --- | --- |
| 系统 / 宿主 | macOS 27.3 arm64，VS Code 1.144.0，Local Desktop Extension Development Host |
| 板卡 / MCU | 用户提供的 CH340C PDM 板；工程为 STM32F103C8T6，Bootloader `0x22`、PID `0x0410` |
| 端口 | `/dev/tty.usbserial-10`，VID/PID `1a86:7523` |
| 固件 | `PDM/Debug/PDM.hex`，35,136 字节，基地址 `0x08000000` |
| 文件 SHA-256 | `6fb7d83b88f4ca18c934ae69a3802a0c77d215337f38373c425f3dcb95320de2` |
| 串口 / 复位模式 | 烧录 `115200 8E1`，应用输出 `115200 8N1`；`dtr-low-rts-high` |
| 执行配置 | Erase、Verify、Run 开启；GO；完成后关闭串口；解除读保护关闭 |

验证结果：

- 控制线改为状态保持后，直接沿用通用入口时序无法同步。将旧实现的有效双线组合写成 CH340C 独立入口后，GET、GET ID 成功，确认支持 GO。
- GO 准备若保持 `(false, false)`，擦写校验和 GO ACK 均通过，但用户报告 LED 不闪烁，随后应用串口采样为空。该状态未通过启动验证。
- GO 准备改为 `(DTR, RTS) = (false, true)` 后，GO ACK 成功；端口保持开启时收到持续数据，关闭后以 `8N1` 重开可读到周期 `BUS[OK]` / `BAT[OK]` 输出。
- 使用修正后的 `resetToRun()`，保持端口开启，以 `8N1` 收到 `PDM Monitor initialized` 及周期应用输出，确认该次硬件复位启动有效。
- 重新加载最终代码后，在 Extension Development Host 面板完整执行擦除、写入、读回校验和 GO。全部通过，用户确认没有按 RESET，心跳 LED 已自动闪烁；随后以 `8N1` 收到 210 字节周期应用输出，补充确认应用运行。
- 应用输出还包含 CAN 发送队列满提示。本次只验证烧录和启动，没有验证 PDM 的 CAN 总线或传感器测量功能。

软件验证：137 项单元与回归测试通过，darwin/arm64 原生串口加载与枚举通过，VSIX 打包和扩展宿主加载通过。

尚未验证长时间重复烧录、CH340X、其他 MCU、Windows 和 Linux；没有测量 NRST/BOOT0 波形，不能将请求值当作引脚实测电平。


## 4. CH340X 结束复位修正准备

本次没有 CH340X 目标板，仅完成软件修改和 mock 回归。此前已测的进入 Bootloader 组合及 150、150、150、1000 ms 等待时间保留。CH340C PDM 的实测结果不代替 CH340X 回归。

- 硬件复位：DTR 保持运行态，RTS 发复位脉冲。请求 `(RTS, DTR)` 依次为 `(true, false)`、`(false, false)` 和 `(true, false)`，等待仍为 250、250 和 1000 ms。
- GO：入口结束状态为 `(true, true)`；GO 前请求 `(true, false)`，等待 250 ms。RTS 不变，只恢复 DTR 的 BOOT0 运行条件。
- mock 覆盖 GO 前恢复运行条件、GO 与硬件复位互斥、保留端口、自动关闭端口、GO 失败不自动复位和“不运行”不改变入口结束状态。

软件验证：143 项单元与回归测试通过，darwin/arm64 原生串口加载与枚举通过，VSIX 打包通过；扩展开发宿主成功加载面板。本轮未对目标板执行烧录或复位。

后续接板时，使用匹配 MCU 的固件，分别验证硬件复位和 GO。记录 GO ACK、LED 或应用串口输出，并对比端口保持开启与关闭后的运行状态。单独测量 RTS/NRST 与 DTR/BOOT0，核实复位脉冲和最终电平；按上方模板填写实际环境与结果。
