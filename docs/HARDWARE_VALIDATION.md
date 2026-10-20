# VS Code 插件硬件验证规范与记录模板

本文件用于规范目标板在真实硬件环境下的烧录验证流程，统一记录环境参数与测试结果。

---

## 1. 验证目标与测试状态

在提交涉及复位时序、串口传输、协议握手或扩展宿主环境的关键变更时，须按此规范在真实硬件上执行回归测试。

### 历史测试与待回归清单
| 硬件环境 | MCU 型号 / Bootloader | 串口芯片及电路 | 测试状态 | 说明 |
| --- | --- | --- | --- | --- |
| macOS 14+ | STM32F103 (MD, PID `0x0410`, BL `0x22`) | CH340C 经典外围电路 | 待插件回归 | 历史 CLI 测试通过；待插件环境实测 |
| macOS 14+ | STM32F103 (CAN2RS485 板, PID `0x0413`, BL `0x31`) | CH340X 直连电路 | 待插件回归 | 历史 CLI 测试通过；待插件环境实测 |
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
- **执行选项**：Erase [`x`] / Verify [`x`] / Run [`x`] / ClosePort [`x`]

### 验证步骤与结果
1. 执行 `SerialFlash: Run Diagnostics`，确认宿主环境与串口可见；
2. 执行 `SerialFlash: Flash Latest Firmware`（或在面板点击 Flash）；
3. 检查 Output 日志并确认以下指标：
   - [ ] 芯片成功进入 Bootloader，读取到 Bootloader 版本与芯片 PID；
   - [ ] Flash 擦除成功完成；
   - [ ] 固件分包写入成功；
   - [ ] 读回逐字节校验通过；
   - [ ] 自动复位生效，开发板成功运行新固件；
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
[SerialFlash] Reset and run
[SerialFlash] Done
```
