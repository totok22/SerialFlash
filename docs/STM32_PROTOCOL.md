# STM32 USART Bootloader 协议说明

[English](STM32_PROTOCOL.en.md)

本项目实现了 STM32 系统存储区 ROM USART Bootloader 协议的核心子集，通信格式遵循 ST [AN3155](https://www.st.com/resource/en/application_note/an3155-usart-protocol-used-in-the-stm32-bootloader-stmicroelectronics.pdf) 规范。

---

## 1. 串口通信参数

- **波特率**：默认 `115200`（支持 Bootloader 自动波特率探测）
- **数据位**：`8`
- **校验位**：`Even`（偶校验，STM32 USART ISP 协议要求）
- **停止位**：`1`
- **流控**：`None`（无硬件流控）

---

## 2. 控制字节与应答

| 字节名 | 编码 | 含义 |
| --- | --- | --- |
| **Sync** | `0x7F` | 握手与自动波特率初始化字节 |
| **ACK** | `0x79` | 操作成功应答 |
| **NACK** | `0x1F` | 操作拒绝或校验错误应答 |

---

## 3. 数据包格式与校验

- **命令帧**：`[CMD, CMD ^ 0xFF]`（命令字节与其按位取反校验字节，共 2 字节）
- **地址帧**：4 字节大端网络序地址 + 1 字节异或校验码（`Addr[0] ^ Addr[1] ^ Addr[2] ^ Addr[3]`）
- **数据写入帧**：`[N, Data[0] ... Data[N], Checksum]`
  - `N` 为传输字节数减 1（例如传输 256 字节时 `N = 0xFF`）
  - 数据块须按 4 字节对齐，不足处以 `0xFF` 填充
  - `Checksum` 为 `N ^ Data[0] ^ ... ^ Data[N]`

---

## 4. 支持的命令集

| 命令码 | 命令名称 | 功能描述 |
| --- | --- | --- |
| `0x00` | **GET** | 获取 Bootloader 版本及所支持的全部命令列表 |
| `0x02` | **GET ID** | 读取 MCU 产品 ID (PID) |
| `0x11` | **READ MEMORY** | 从指定地址读回数据（用于固件写入后校验） |
| `0x21` | **GO** | 请求从指定应用向量表启动代码；ACK 不证明应用已运行 |
| `0x31` | **WRITE MEMORY** | 分块写入数据至 Flash（单包最大 256 字节） |
| `0x43` | **ERASE** | 标准全片或按页擦除（用于部分较老型号） |
| `0x44` | **EXTENDED ERASE** | 扩展擦除（双字节扇区索引或 `0xFFFF` 特殊全片擦除） |
| `0x92` | **READOUT UNPROTECT** | 解除读保护（触发全片 Flash 擦除） |

---

## 5. 交互时序流程

0.2.2 预发布：烧录流程新增 `runMode`。默认 `hardware-reset`；`go` 在擦除前检查 GET 返回的命令列表是否包含 `0x21`，不支持时终止。`runAfterWrite=false` 跳过运行；手动复位模式配合 `hardware-reset` 时也跳过自动运行，并提示手动复位。

```text
Host                                  STM32 ROM Bootloader
  |                                            |
  |--- DTR/RTS 复位时序进入 Bootloader ------->|
  |                                            |
  |--- 0x7F (Sync) --------------------------->|
  |<-- 0x79 (ACK) -----------------------------|
  |                                            |
  |--- GET (0x00, 0xFF) ---------------------->|
  |<-- ACK + Version + Supported Commands -----|
  |                                            |
  |--- GET ID (0x02, 0xFD) ------------------->|
  |<-- ACK + PID ------------------------------|
  |                                            |
  |    (GO 运行模式) 检查 GET 的 GO 支持情况     |
  |                                            |
  |--- (可选) ERASE / EXTENDED ERASE ---------->|
  |<-- ACK (等待最多 60s) ----------------------|
  |                                            |
  |--- WRITE MEMORY (地址包 + 数据包) --------->|
  |<-- ACK ------------------------------------|
  |                                            |
  |--- (可选) READ MEMORY 读回校验 ------------>|
  |<-- ACK + Memory Data ----------------------|
  |                                            |
  |--- (可选) 硬件复位时序或 GO 请求 ---------->|
```

## 6. GO 地址与应答边界（0.2.2 预发布）

GO 的帧顺序为 `[0x21, 0xDE]`、ACK、4 字节地址加异或校验、ACK。按 [AN3155 的 Go command 说明](https://www.st.com/resource/en/application_note/an3155-usart-protocol-used-in-the-stm32-bootloader-stmicroelectronics.pdf)，目标地址应是应用向量表基址，包含初始栈指针与复位处理函数地址；应用须正确配置向量表。

插件发送本次解析后的烧录地址：显式 `flashAddress` 优先，否则使用 HEX 基地址或 BIN 默认 `0x08000000`。该处必须有有效向量表；设置覆盖地址不会重定位固件，也不等于已验证向量表有效。

发送前，`prepareForGo()` 对 CH340C 经典预设请求 `(DTR, RTS) = (false, true)`；对通用预设及自定义映射请求 `boot0Low` 和复位释放态，均等待 100 ms。`ch340x` 请求 `(RTS, DTR) = (true, false)`，等待 250 ms；RTS 保持入口结束状态，不发复位脉冲。`none` 保持控制线，启动条件由用户管理。CH340X 入口及硬件复位等待时间保留，结束复位改为固定 DTR 并切换 RTS，详见[硬件说明](CH340_HARDWARE.md)。

日志仅确认 GO 已应答或硬件复位时序已发送，不能证明应用已执行。GO 失败不自动回退到硬件复位；关闭串口后的引脚状态取决于驱动和电路，也不保证应用启动或阻止跳转。须另行观察应用行为，按[硬件验证模板](HARDWARE_VALIDATION.md) 记录。
