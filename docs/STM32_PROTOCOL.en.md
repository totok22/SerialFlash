# STM32 USART Bootloader Protocol Reference

[简体中文](STM32_PROTOCOL.md)

This document describes the core subset of the STM32 system ROM USART bootloader protocol implemented by this project, following the ST [AN3155](https://www.st.com/resource/en/application_note/an3155-usart-protocol-used-in-the-stm32-bootloader-stmicroelectronics.pdf) specification.

---

## 1. Serial Communication Parameters

- **Baud Rate**: Default `115200` (MCU bootloader auto-detects baud rate via the sync byte)
- **Data Bits**: `8`
- **Parity**: `Even` (Required by STM32 USART bootloader protocol)
- **Stop Bits**: `1`
- **Flow Control**: `None`

---

## 2. Control Bytes & Responses

| Byte Name | Value | Meaning |
| --- | --- | --- |
| **Sync** | `0x7F` | Handshake and autobaud initialization byte |
| **ACK** | `0x79` | Operation acknowledged / successful |
| **NACK** | `0x1F` | Operation rejected or checksum failure |

---

## 3. Packet Formats & Checksums

- **Command Frame**: `[CMD, CMD ^ 0xFF]` (2 bytes: Command byte followed by its bitwise inverted checksum)
- **Address Frame**: 4-byte big-endian network order address + 1-byte XOR checksum (`Addr[0] ^ Addr[1] ^ Addr[2] ^ Addr[3]`)
- **Data Write Frame**: `[N, Data[0] ... Data[N], Checksum]`
  - `N` is the number of data bytes minus 1 (e.g. For 256 bytes, `N = 0xFF`)
  - Data payload is 4-byte aligned (padded with `0xFF` if necessary)
  - `Checksum` is `N ^ Data[0] ^ ... ^ Data[N]`

---

## 4. Supported Command Set

| Opcode | Command Name | Description |
| --- | --- | --- |
| `0x00` | **GET** | Retrieves bootloader version and list of supported commands |
| `0x02` | **GET ID** | Reads MCU Product ID (PID) |
| `0x11` | **READ MEMORY** | Reads memory at specified address (used for post-flash verification) |
| `0x21` | **GO** | Requests execution using the application vector table at the given address; ACK does not prove execution |
| `0x31` | **WRITE MEMORY** | Programs flash memory blocks (up to 256 bytes per packet) |
| `0x43` | **ERASE** | Standard page or full chip erase (older STM32 families) |
| `0x44` | **EXTENDED ERASE** | Extended erase (2-byte sector index or `0xFFFF` mass erase) |
| `0x92` | **READOUT UNPROTECT** | Removes readout protection (triggers full Flash mass erase) |

---

## 5. Interaction Flow

0.2.2 pre-release: the flash workflow adds `runMode`, defaulting to `hardware-reset`. With `go`, it checks the GET list for `0x21` before erase and aborts if absent. `runAfterWrite=false` skips the run step; manual reset mode with `hardware-reset` also skips automatic execution and logs that manual reset is required.

```text
Host                                  STM32 ROM Bootloader
  |                                            |
  |--- DTR/RTS Reset Sequence to Bootloader -->|
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
  |    (GO run mode) Check GET for GO support    |
  |                                            |
  |--- (Optional) ERASE / EXTENDED ERASE ----->|
  |<-- ACK (Up to 60s timeout) ----------------|
  |                                            |
  |--- WRITE MEMORY (Address + Data packets) ->|
  |<-- ACK ------------------------------------|
  |                                            |
  |--- (Optional) READ MEMORY (Verification) ->|
  |<-- ACK + Memory Data ----------------------|
  |                                            |
  |--- (Optional) Hardware reset or GO request >|
```

## 6. GO Address and ACK Limits (0.2.2 pre-release)

GO sends `[0x21, 0xDE]`, waits for ACK, sends the four-byte address plus XOR checksum, then waits for ACK. The [AN3155 Go command description](https://www.st.com/resource/en/application_note/an3155-usart-protocol-used-in-the-stm32-bootloader-stmicroelectronics.pdf) requires an application vector-table base containing the initial stack pointer and reset-handler address; the application must configure its vector table correctly.

The extension sends the resolved flash address: explicit `flashAddress` first, otherwise the HEX base or BIN default `0x08000000`. A valid vector table must exist there. An address override neither relocates firmware nor validates its vector table.

Before sending GO, `prepareForGo()` requests `(DTR, RTS) = (false, true)` for classic CH340C, or `boot0Low` with reset deasserted for generic presets and custom mappings. Both wait 100 ms. `ch340x` requests `(RTS, DTR) = (true, false)` and waits 250 ms, keeping RTS at its entry-end state without a reset pulse. `none` keeps control lines unchanged; the user manages boot conditions. CH340X entry and reset waits are retained; final reset now holds DTR and pulses RTS; see [Hardware Notes](CH340_HARDWARE.en.md).

Logs confirm only GO acknowledgment or transmission of a hardware-reset sequence, not application execution. GO failure does not automatically fall back to hardware reset. Driver- and circuit-dependent pin states after port closure guarantee neither startup nor prevention of a jump. Observe application behavior separately and record it in the [hardware validation template](HARDWARE_VALIDATION.md).

