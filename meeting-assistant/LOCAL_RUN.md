# 本地一键运行说明

## 启动

双击：

```text
start.bat
```

或在 PowerShell 中运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

启动脚本会依次处理：

1. 检查并启动 Ollama
2. 启动 WSL2 ASR 服务：`http://127.0.0.1:8000`
3. 启动 Node Local Agent：`http://127.0.0.1:3001`
4. 打开本地页面：`http://127.0.0.1:3001`

默认纪要整理模型为：

```text
qwen3.5:9b
```

如需临时换用其他已安装模型：

```powershell
$env:OLLAMA_MODEL='已安装的模型名'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

## 停止

双击：

```text
stop.bat
```

或在 PowerShell 中运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-local.ps1 -ForcePorts
```

默认停止 Node Local Agent 和 ASR。Ollama 默认不关闭，因为模型已经通过 `keep_alive=0s` 自动释放。

如果也想关闭 Ollama：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-local.ps1 -ForcePorts -StopOllama
```

## 状态检查

```powershell
curl.exe http://127.0.0.1:3001/api/local/health
curl.exe http://127.0.0.1:8000/health
curl.exe http://127.0.0.1:11434/api/tags
```

## 日志

日志目录：

```text
logs\
```

常用文件：

```text
logs\node.log
logs\node.err.log
logs\asr.log
logs\asr.err.log
```

## 笔记本远程使用

如果通过远程控制在台式机上打开本地系统，直接使用：

```text
http://127.0.0.1:3001
```

如果笔记本和台式机在同一局域网，可以用台式机 IP：

```text
http://台式机IP:3001
```

如果不在同一局域网，需要 Cloudflare Tunnel、Tailscale 或其他安全通道。
