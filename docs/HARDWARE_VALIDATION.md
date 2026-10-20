# VS Code 插件硬件验证记录模板

每次实机验证都按此模板记录，避免只留下“能烧”的口头结论。

## 当前验证范围

下表是历史 CLI 记录，不是当前 VS Code 插件的实机测试结果。本次文档和图片更新没有连接硬件。原始记录和接线参考见 [CH340 硬件说明](CH340_HARDWARE.md)。

| 日期 | 历史验证对象 | 已记录结果 | 当前 VS Code 插件状态 |
| --- | --- | --- | --- |
| 2026-06-01 | CH340C 经典电路，STM32F10xxx Medium-density，Bootloader `0x22`，PID `0x0410` | CLI 擦除、烧录和校验完成；入口另用 `stm32flash` 验证 | 待实机回归 |
| 2026-06-05 | CH340X CAN2RS485 板，macOS `/dev/tty.usbserial-10`，Bootloader `0x31`，PID `0x0413` | CLI 擦除、写入和读回校验完成 | 待实机回归 |

历史 CH340X 记录的“RTS BOOT / DTR RESET”命名与 WCH 参考图的引脚映射不同。回归时记录芯片脚号、板上网络和实际电平，不要仅凭芯片型号判断预设。

## 环境

- 日期：
- OS：
- VS Code 版本：
- 插件版本：
- 运行环境：VS Code Desktop 本地 / Remote SSH / WSL / Dev Container
- 串口芯片：
- 端口：
- 板卡：
- MCU：
- ROM Bootloader 支持的 USART / TX / RX 引脚（核对 AN2606）：
- 串口 I/O 电压 / MCU 电压 / 共地：
- USB 接口实际连接：USB 转串口 / MCU 原生 USB / 仅供电
- DTR/RTS 芯片脚号 → 板上网络 → BOOT / NRST 的映射与有效电平：
- BOOT 上下拉 / BOOT1 / 启动选项字节：
- 目标板供电方式：
- 固件路径：
- 固件格式：HEX / BIN
- reset mode：
- custom reset mapping（如适用）：
- baud/parity/timeout：
- flash address：
- erase / verify / run / close：

## 操作

1. 打开包含固件的工作区。
2. 执行 `SerialFlash: Select Serial Port`。
3. 执行 `SerialFlash: Select Reset Mode`。
4. 执行 `SerialFlash: Flash Latest Firmware` 或在面板点击 `Flash`。
5. 保存 Output Channel 日志中的关键信息。

## 结果

- Bootloader version：
- PID：
- 擦除结果：
- 写入结果：
- 校验结果：
- 运行结果：
- 串口是否释放：
- 是否出现同步噪声忽略日志：
- 失败时下一步排查：

## 必测矩阵

- macOS + CH340C 经典电路。
- macOS + CH340X 直连电路。
- Windows + CH340。
- Linux + `/dev/ttyUSB*` 或 `/dev/ttyACM*`。

## 日志格式示例

以下日志仅演示记录格式，不是新增实机验证记录。

```text
[SerialFlash] Firmware: build/Debug/CAN2RS485.hex, HEX, 65536 bytes
[SerialFlash] Port: /dev/tty.usbserial-10 @ 115200 8E1
[SerialFlash] Reset: ch340x
[SerialFlash] Entering bootloader via DTR/RTS
[SerialFlash] Bootloader 0x31, PID 0x0413
[SerialFlash] Erase complete (extended)
[SerialFlash] Verify complete
[SerialFlash] Reset and run
[SerialFlash] Done
```
