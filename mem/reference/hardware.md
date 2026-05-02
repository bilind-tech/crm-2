---
name: Hardware Setup (Pi 5)
description: Raspberry Pi 5 (8 GB) mit USB-SSD, Pi-OS-Lite, Imager-Setup für mycleancenter
type: reference
---

# Hardware Setup

## Geräte
- **Raspberry Pi 5**, 8 GB RAM
- **USB-SSD** (mind. 256 GB, idealerweise SATA-SSD im USB-3-Gehäuse) — für `/var/lib/mycleancenter/`
- 27W USB-C Netzteil (offiziell)
- Aktiv-Kühler empfohlen (Puppeteer-PDF-Render belastet CPU)
- Optional: Gehäuse, Ethernet-Kabel (LAN bevorzugt vor WLAN)

## OS
**Pi-OS-Lite (64-bit, arm64)**, headless. Kein Desktop.

## Imager-Setup (vor erstem Boot)
- Hostname: `mycleancenter`
- SSH aktivieren mit Key-Auth (kein Passwort)
- User: `mcc` (sudo-fähig)
- WLAN-Country, Locale, Timezone (Europe/Berlin)

## Mounts
- USB-SSD nach `/mnt/data` mounten (fstab mit `noatime,errors=remount-ro`)
- Symlink `/var/lib/mycleancenter → /mnt/data/mycleancenter`
- ext4, regelmäßig fstrim

## Netzwerk
- mDNS via avahi → erreichbar als `mycleancenter.local`
- Statische LAN-IP optional via Router-DHCP-Reservation

## Software-Stack (von Step 11)
- Node.js 20 LTS (NodeSource)
- nginx als Reverse-Proxy auf Port 80 → 8787
- systemd-Unit `mycleancenter.service`
- logrotate, fail2ban, ufw
