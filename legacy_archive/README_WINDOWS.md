# YBB Platform - Windows Development Guide

For **Windows** users, we have provided a PowerShell script `Manage.ps1` that replicates the functionality of the standard `Makefile`.

## Prerequisites
1. **Docker Desktop for Windows** (with WSL2 backend recommended).
2. **PowerShell** (Pre-installed on Windows).

## How to Use
Instead of running `make <command>`, you will run `.\Manage.ps1 <command>`.

### Common Commands

| Linux/Mac Command | Windows Command | Description |
|-------------------|-----------------|-------------|
| `make dev` | `.\Manage.ps1 dev` | Start development environment |
| `make stop` | `.\Manage.ps1 stop` | Stop all services |
| `make restart` | `.\Manage.ps1 restart` | Restart all services |
| `make logs` | `.\Manage.ps1 logs` | View all logs |
| `make setup` | `.\Manage.ps1 setup` | Initial project setup |
| `make build` | `.\Manage.ps1 build` | Rebuild Docker images |
| `make clean` | `.\Manage.ps1 clean` | Remove containers & volumes |

### Database Commands

| Windows Command | Description |
|-----------------|-------------|
| `.\Manage.ps1 migrate` | Run API database migrations |
| `.\Manage.ps1 seed-db` | Seed database with sample data |
| `.\Manage.ps1 db-shell` | Open PostgreSQL shell |

### Tips
- You can tab-complete the script name: `.\Man` + `Tab` -> `.\Manage.ps1`.
- If you get a "script cannot be loaded because running scripts is disabled" error, run PowerShell as Administrator and execute:
  ```powershell
  Set-ExecutionPolicy RemoteSigned
  ```
