# CH340 硬件与复位时序说明

[English](CH340_HARDWARE.en.md)

本文件说明基于 CH340 系列 USB-UART 桥接芯片的自动下载电路设计、控制线电平约定与复位时序。

---

## 1. 硬件连接规范

STM32 通过其系统存储区内置的 ROM USART Bootloader 进行串口烧录。目标板与 USB-UART 模块连接时须满足以下条件：

- **串口信号**：USB-UART 的 TXD 接 STM32 Bootloader USART 的 RX，RXD 接 TX，双方需共地（GND）。
- **逻辑电平**：确认串口模块的 I/O 电平与 STM32 芯片电压（通常为 3.3V）匹配，避免将 5V 或 RS-232 高压电平接入 MCU 引脚。
- **启动与复位引脚**：自动下载电路须通过 DTR/RTS 信号驱动 STM32 的 BOOT0（或相应启动配置引脚）和 NRST。BOOT1（若有）通常接地，启动配置规范以 ST [AN2606](https://www.st.com/resource/en/application_note/an2606-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf) 为准。
- **接口属性**：板载 USB-C 接口需连接至 USB-UART 桥接芯片及相关启动控制电路。仅连接 STM32 原生 USB 外设的接口无法走 USART ISP 流程。

---

## 2. 软件电平极性约定

项目内部逻辑对 Modem 控制信号统一约定为：
- `true`：**低电平**（Assert / 导通）
- `false`：**高电平**（Deassert / 截止）

> [!NOTE]
> Node.js `serialport` 库原生接口的布尔语义与上述约定相反。适配层 `src/node-serial-transport.js` 统一负责极性取反，配置文件和核心代码中使用统一的高层约定。

---

## 3. CH340C 经典外围电路 (`dtr-low-rts-high`)

该电路通过一对晶体管（NPN + PNP）配合阻容网络，将 DTR 与 RTS 信号转化为 BOOT0 与 NRST 所需的电平：

- **复位控制**：DTR# 经基极限流电阻驱动 NPN 管 Q1，下拉 NRST 产生复位脉冲。
- **启动控制**：RTS# 配合 PNP 管 Q2 控制 BOOT0 电平。
- **状态逻辑**：
  - DTR 与 RTS 处于相同逻辑状态时，三极管截止，MCU 引脚由板载上下拉电阻维持正常状态。
  - DTR 与 RTS 状态相异时，电路分别触发复位或将 BOOT0 拉高。

![CH340C 自动下载参考电路](assets/ch340c-auto-download.png)

*原始电路参考：[WCH-SoftGroup 原文说明](https://www.cnblogs.com/WCH-SoftGroup/p/16520720.html)。*

### 验证时序参数
Bootloader 进入流程（`dtr-low-rts-high`）：
1. RTS 低电平，DTR 低电平；
2. DTR 产生高电平跳变；
3. 延时等待约 800 ms，等待 MCU 稳定上电并进入 Bootloader；
4. 发送 `0x7F` 同步字节。

---

## 4. CH340X 直连参考电路 (`ch340x`)

CH340X 具备专用的 Modem 控制特性，可省去外部三极管，直接通过引脚网络连接 MCU：

| CH340X 引脚 | 芯片功能 | MCU 连接目标 | 说明 |
| --- | --- | --- | --- |
| 8 脚 | TXD | MCU RXD | 串口数据发送 |
| 9 脚 | RXD | MCU TXD | 串口数据接收 |
| 4 脚 | RTS# | RESET (NRST) | 复位控制输出 |
| 6 脚 | TNOW / DTR# | BOOT0 | 启动配置控制输出 |
| 6 脚外接 R4 | 4.7 kΩ 下拉 | GND | 配置为增强 DTR 输出并提供 BOOT0 下拉 |

![CH340X 自动下载参考电路](assets/ch340x-auto-download.png)

*电路参考：[WCH 官方应用说明](https://www.wch.cn/application/575.html)。*

### 时序状态机
在 `src/core/reset-timing.js` 中，CH340X 的时序定义如下：

- **进入 Bootloader**：
  - 状态依次为：`(RTS, DTR) = (false, true) → (true, true) → (true, false) → (true, true)`
  - 稳定延时约 1000 ms，随后发送同步字节 `0x7F`。
- **复位运行用户程序**：
  - 状态依次为：`(false, false) → (false, true) → (false, false)`
  - 释放 NRST，MCU 从 Flash 启动执行。

---

## 5. 关键调试与排查要点

- **同步字节超时 (`0x7F` Timeout)**：
  - 通常是 MCU 未能成功进入 Bootloader。首先检查供电、共地以及 BOOT0/NRST 引脚接线。
  - 若使用非标准电路，建议先切到 `none` 模式，手动按住开发板 BOOT 键并按 RST 键进行排查。
- **收到持续乱码或用户程序输出**：
  - 说明自动下载电路未能打断用户程序运行，需用示波器或逻辑分析仪测量复位脉冲与 BOOT0 电平保持时间。
- **烧录完成后板卡不运行**：
  - CH340X 直连电路在串口连接持续打开时，控制引脚可能维持在复位或 BOOT 状态。插件默认开启 `closePortAfterWrite`，在烧录完成后自动关闭端口释放引脚。
- **全片擦除长等待**：
  - 大容量 STM32（如 High-density / XL-density）全片擦除耗时可能达到数十秒。协议层为此设置了 60 秒的专用超时窗口。
