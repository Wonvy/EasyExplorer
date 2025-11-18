/**
 * Tauri API 适配器
 * 将 Electron API 调用转换为 Tauri API
 * 
 * 使用方法: 在 HTML 中先引入此脚本，再引入 renderer.js
 * <script src="tauri-adapter.js"></script>
 * <script src="renderer.js"></script>
 */

// 等待 Tauri API 加载
if (typeof window.__TAURI__ === 'undefined') {
    console.error('Tauri API 未加载！请确保在 Tauri 环境中运行。');
    throw new Error('Tauri API not available');
}

const { invoke } = window.__TAURI__.tauri;
const { open, save, message, ask } = window.__TAURI__.dialog;
const { writeText, readText } = window.__TAURI__.clipboard;
const { open: shellOpen } = window.__TAURI__.shell;

// 模拟 Electron 的 fs 模块
const fs = {
    readFileSync: async (path, encoding) => {
        try {
            const { readTextFile, readBinaryFile } = window.__TAURI__.fs;
            if (encoding) {
                return await readTextFile(path);
            } else {
                return await readBinaryFile(path);
            }
        } catch (error) {
            throw new Error(error);
        }
    },
    writeFileSync: async (path, data) => {
        try {
            const { writeTextFile, writeBinaryFile } = window.__TAURI__.fs;
            if (typeof data === 'string') {
                await writeTextFile(path, data);
            } else {
                await writeBinaryFile(path, data);
            }
        } catch (error) {
            throw new Error(error);
        }
    },
    existsSync: async (path) => {
        return await invoke('path_exists', { path });
    },
    readdirSync: async (path) => {
        const files = await invoke('read_directory', { path });
        return files.map(f => f.name);
    },
    statSync: async (path) => {
        const files = await invoke('read_directory', { path: require('path').dirname(path) });
        const file = files.find(f => f.path === path);
        if (!file) throw new Error('文件不存在');
        return {
            isDirectory: () => file.is_directory,
            isFile: () => !file.is_directory,
            size: file.size,
            mtime: new Date(file.modified * 1000),
            birthtime: new Date(file.created * 1000),
        };
    },
    copyFileSync: async (source, destination) => {
        await invoke('copy_file', { source, destination });
    },
    renameSync: async (oldPath, newPath) => {
        await invoke('rename_file', { oldPath, newPath });
    },
    unlinkSync: async (path) => {
        await invoke('delete_file', { path });
    },
    mkdirSync: async (path) => {
        await invoke('create_directory', { path });
    }
};

// 模拟 Electron 的 path 模块
const path = {
    join: (...args) => {
        return args.join('\\').replace(/\\\\/g, '\\');
    },
    basename: (filepath) => {
        return filepath.split(/[\\/]/).pop();
    },
    dirname: (filepath) => {
        const parts = filepath.split(/[\\/]/);
        parts.pop();
        return parts.join('\\');
    },
    extname: (filepath) => {
        const name = filepath.split(/[\\/]/).pop();
        const idx = name.lastIndexOf('.');
        return idx > 0 ? name.substring(idx) : '';
    },
    resolve: (...args) => {
        return args.join('\\').replace(/\\\\/g, '\\');
    }
};

// 模拟 Electron 的 shell 模块
const shell = {
    openPath: async (path) => {
        await invoke('open_with_default', { path });
    },
    showItemInFolder: async (path) => {
        await invoke('show_in_explorer', { path });
    },
    openExternal: async (url) => {
        await shellOpen(url);
    }
};

// 模拟 Electron 的 clipboard 模块
const clipboard = {
    writeText: async (text) => {
        await writeText(text);
    },
    readText: async () => {
        return await readText();
    },
    // 文件路径相关
    writeFiles: (files) => {
        // Tauri 暂不支持直接写入文件路径到剪贴板，使用文本替代
        const paths = files.map(f => f.path || f).join('\n');
        return writeText(paths);
    },
    readFiles: async () => {
        const text = await readText();
        return text.split('\n').filter(p => p.trim());
    }
};

// 模拟 Electron 的 ipcRenderer 模块
const ipcRenderer = {
    send: (channel, ...args) => {
        console.log('IPC Send:', channel, args);
        // 根据不同的 channel 调用对应的 Tauri 命令
        if (channel === 'show-context-menu') {
            // 右键菜单需要通过 Tauri 的方式处理
            // 这里可以通过自定义事件处理
            window.dispatchEvent(new CustomEvent('tauri-context-menu', { detail: args[0] }));
        } else if (channel === 'open-settings') {
            // 打开设置窗口
            window.location.href = 'settings.html';
        } else if (channel === 'show-favorite-context-menu') {
            window.dispatchEvent(new CustomEvent('tauri-favorite-menu', { detail: args[0] }));
        } else if (channel === 'show-status-bar-menu') {
            window.dispatchEvent(new CustomEvent('tauri-statusbar-menu', { detail: args[0] }));
        } else if (channel === 'perform-paste') {
            const [targetPath, filePaths] = args;
            Promise.all(filePaths.map(async (filePath) => {
                const dest = path.join(targetPath, path.basename(filePath));
                await invoke('copy_file', { source: filePath, destination: dest });
            })).then(() => {
                window.dispatchEvent(new CustomEvent('update-file-list', { detail: targetPath }));
            });
        } else if (channel === 'open-file-dialog') {
            invoke('open_with_dialog', { path: args[0] });
        }
    },
    on: (channel, callback) => {
        console.log('IPC On:', channel);
        // 监听自定义事件
        if (channel === 'menu-item-clicked') {
            window.addEventListener('tauri-menu-clicked', (e) => {
                callback(null, e.detail.action, e.detail.data);
            });
        } else if (channel === 'favorite-menu-item-clicked') {
            window.addEventListener('tauri-favorite-menu-clicked', (e) => {
                callback(null, e.detail.action, e.detail.path);
            });
        } else if (channel === 'status-bar-menu-item-clicked') {
            window.addEventListener('tauri-statusbar-menu-clicked', (e) => {
                callback(null, e.detail.label);
            });
        } else if (channel === 'update-file-list') {
            window.addEventListener('update-file-list', (e) => {
                callback(null, e.detail);
            });
        } else if (channel === 'copy-progress') {
            window.addEventListener('tauri-copy-progress', (e) => {
                callback(e.detail);
            });
        } else if (channel === 'file-icon-result') {
            window.addEventListener('tauri-file-icon', (e) => {
                callback(null, e.detail);
            });
        }
    },
    invoke: async (channel, ...args) => {
        console.log('IPC Invoke:', channel, args);
        if (channel === 'get-file-icon') {
            // Tauri 不直接支持获取文件图标，返回 null
            return null;
        } else if (channel === 'select-file') {
            return await open(args[0]);
        } else if (channel === 'select-folder') {
            return await open({ directory: true });
        }
    }
};

// 模拟 os 模块
const os = {
    platform: () => {
        return navigator.platform.toLowerCase().includes('win') ? 'win32' : 
               navigator.platform.toLowerCase().includes('mac') ? 'darwin' : 'linux';
    },
    homedir: () => {
        // Tauri 中可以通过其他方式获取，这里简化处理
        return 'C:\\Users\\' + (navigator.userAgent.match(/Windows NT [^;)]+/) || [''])[0];
    }
};

// 导出模拟的模块供 renderer.js 使用
// 注意: 由于 renderer.js 使用 require()，我们需要创建全局变量
window.require = function(moduleName) {
    const modules = {
        'fs': fs,
        'path': path,
        'electron': { shell, ipcRenderer, clipboard },
        'os': os,
        'child_process': {
            execSync: () => { console.warn('execSync not implemented in Tauri'); },
            exec: () => { console.warn('exec not implemented in Tauri'); }
        }
    };
    
    if (modules[moduleName]) {
        return modules[moduleName];
    }
    
    console.warn(`Module '${moduleName}' not available in Tauri adapter`);
    return {};
};

console.log('Tauri 适配器已加载');

