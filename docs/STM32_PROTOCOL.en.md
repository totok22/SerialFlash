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
| `0x21` | **GO** | Starts code execution from specified memory address |
| `0x31` | **WRITE MEMORY** | Programs flash memory blocks (up to 256 bytes per packet) |
| `0x43` | **ERASE** | Standard page or full chip erase (older STM32 families) |
| `0x44` | **EXTENDED ERASE** | Extended erase (2-byte sector index or `0xFFFF` mass erase) |
| `0x92` | **READOUT UNPROTECT** | Removes readout protection (triggers full Flash mass erase) |

---

## 5. Interaction Flow

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
  |--- (Optional) ERASE / EXTENDED ERASE ----->|
  |<-- ACK (Up to 60s timeout) ----------------|
  |                                            |
  |--- WRITE MEMORY (Address + Data packets) ->|
  |<-- ACK ------------------------------------|
  |                                            |
  |--- (Optional) READ MEMORY (Verification) ->|
  |<-- ACK + Memory Data ----------------------|
  |                                            |
  |--- Reset & Run (DTR/RTS or GO command) --->|
```

