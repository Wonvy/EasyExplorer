# EasyExplorer - Tauri 版本

这个项目已从 Electron 迁移到 Tauri + Rust。

## 项目结构

```
EasyExplorer/
├── src-tauri/           # Rust 后端代码
│   ├── src/
│   │   └── main.rs      # 主程序入口
│   ├── Cargo.toml       # Rust 依赖配置
│   ├── tauri.conf.json  # Tauri 配置
│   └── build.rs         # 构建脚本
├── index.html           # 主页面
├── settings.html        # 设置页面
├── renderer.js          # 前端逻辑
├── tauri-adapter.js     # Electron API 到 Tauri API 的适配器
├── css/                 # 样式文件
├── js/                  # JavaScript 文件
└── package.json         # Node.js 依赖配置
```

## 前置要求

1. **Rust** (推荐使用 rustup 安装)
   - 访问 https://rustup.rs/ 下载安装
   
2. **Node.js** (用于前端依赖管理)
   - 访问 https://nodejs.org/ 下载安装

3. **Windows 构建工具** (Windows 平台)
   - Visual Studio Build Tools 或 Visual Studio

## 安装依赖

```bash
# 安装 npm 依赖
npm install

# Rust 依赖会在构建时自动安装
```

## 开发模式运行

```bash
npm run dev
```

或者直接使用 Tauri CLI:

```bash
cargo tauri dev
```

## 构建生产版本

```bash
npm run build
```

或者直接使用 Tauri CLI:

```bash
cargo tauri build
```

构建完成后，可执行文件将在 `src-tauri/target/release` 目录中。

## 主要变化

### 从 Electron 迁移到 Tauri 的主要改动：

1. **后端重写为 Rust**
   - 所有文件系统操作现在由 Rust 处理
   - 更好的性能和更小的包体积
   - 更安全的系统调用

2. **API 变化**
   - 使用 `tauri-adapter.js` 适配器来兼容原有的 Electron API 调用
   - 所有 IPC 通信改为使用 Tauri 的 `invoke` 系统
   - 文件系统操作使用 Tauri 的安全 API

3. **包体积显著减小**
   - Electron 版本: ~100-200 MB
   - Tauri 版本: ~5-15 MB

## Tauri API 说明

### 可用的后端命令

- `read_directory(path)` - 读取目录内容
- `copy_file(source, destination)` - 复制文件/文件夹
- `delete_file(path)` - 删除文件/文件夹
- `create_directory(path)` - 创建目录
- `rename_file(oldPath, newPath)` - 重命名文件/文件夹
- `get_drives()` - 获取磁盘驱动器列表
- `show_in_explorer(path)` - 在资源管理器中显示
- `open_with_default(path)` - 用默认程序打开文件
- `open_with_dialog(path)` - 打开"打开方式"对话框
- `path_exists(path)` - 检查路径是否存在

## 已知限制

由于 Tauri 的安全限制，以下功能可能需要调整：

1. **文件图标提取**: Tauri 不直接支持提取 Windows 文件图标，需要使用替代方案
2. **某些 Node.js 库**: 一些依赖 Node.js 原生模块的库无法直接使用，需要在 Rust 端实现或寻找替代方案

## 故障排除

### 编译错误

如果遇到 Rust 编译错误，请确保：
- Rust 工具链已正确安装
- Windows 上安装了 Visual Studio Build Tools
- 所有依赖包都是最新版本

### 运行时错误

如果应用无法启动：
1. 检查 `tauri.conf.json` 中的路径配置
2. 确保所有前端资源文件（HTML、CSS、JS）在正确的位置
3. 查看控制台输出的错误信息

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT

