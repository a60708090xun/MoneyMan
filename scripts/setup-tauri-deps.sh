#!/bin/bash
# 安裝 Tauri v2 所需的 Linux 系統套件 (WSL2/Ubuntu)
set -e

echo "=== 安裝 Tauri v2 Linux 依賴 ==="
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

echo "=== 安裝完成 ==="
