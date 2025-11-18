/**
 * EasyExplorer - Tauri 版本渲染器
 * 
 * 这个文件是 renderer.js 的 Tauri 适配版本
 * 将 Electron/Node.js API 调用替换为 Tauri API
 */

// 全局变量声明
let invoke, openDialog, saveDialog, message, ask, confirm;
let writeText, readText;
let shellOpen;
let readTextFile, writeTextFile, readBinaryFile, writeBinaryFile, readDir, removeFile, removeDir, createDir, renameFile, exists;
let appDir, homeDir, documentDir, downloadDir, pictureDir;

// PDF 预览相关（不再需要 PDF.js）
// 使用系统原生 PDF 查看器，性能最优

let currentPath = '';
let history = [];
let historyIndex = -1;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let selectedFiles = [];
let currentView = 'icon-view';
let sortBy = 'name';
let sortOrder = 'asc';
let clipboardFiles = [];
let clipboardOperation = '';
let folderGroups = JSON.parse(localStorage.getItem('folderGroups')) || {};
let fileTags = JSON.parse(localStorage.getItem('fileTags')) || {};
let statusBarVisible = JSON.parse(localStorage.getItem('statusBarVisible')) !== false;
let previewPanelVisible = JSON.parse(localStorage.getItem('previewPanelVisible')) !== false;
let folderChildrenCountCache = {}; // 缓存文件夹子项数量
let lastDirectoryStats = null; // 最近一次目录统计信息（用于状态栏）

// 日历和年报相关变量
let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();
let currentReportYear = new Date().getFullYear();

// 最近访问记录
let recentAccess = JSON.parse(localStorage.getItem('recentAccess')) || [];
let isFromCalendar = false; // 标记是否从日历视图跳转

// 悬停预览相关变量
let hoverPreviewTimer = null;           // 主文件列表悬停预览（文件/文件夹）
let emptyHoverTimer = null;             // 主文件列表空白区域悬停预览
let calendarHoverTimer = null;          // 日历视图悬停预览
let annualHoverTimer = null;            // 年报视图悬停预览
const HOVER_PREVIEW_DELAY = 300; // 悬停多少毫秒后触发预览

// 添加到最近访问记录
function addToRecentAccess(filePath, isDirectory) {
    // 移除已存在的相同路径
    recentAccess = recentAccess.filter(item => item.path !== filePath);
    
    // 添加到开头
    recentAccess.unshift({
        path: filePath,
        name: path.basename(filePath),
        isDirectory: isDirectory,
        accessTime: Date.now()
    });
    
    // 限制最多保存 50 条记录
    if (recentAccess.length > 50) {
        recentAccess = recentAccess.slice(0, 50);
    }
    
    // 保存到 localStorage
    localStorage.setItem('recentAccess', JSON.stringify(recentAccess));
}

// 获取文件图标（使用 Font Awesome）
function getFileIcon(fileName, isDirectory) {
    if (isDirectory) {
        return '<i class="fas fa-folder" style="color: #ffd700;"></i>';
    }
    
    const ext = path.extname(fileName).toLowerCase();
    
    // 图片文件
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'].includes(ext)) {
        return '<i class="fas fa-image" style="color: #e74c3c;"></i>';
    }
    
    // 视频文件
    if (['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.m4v', '.webm'].includes(ext)) {
        return '<i class="fas fa-film" style="color: #9b59b6;"></i>';
    }
    
    // 音频文件
    if (['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a', '.wma'].includes(ext)) {
        return '<i class="fas fa-music" style="color: #3498db;"></i>';
    }
    
    // 压缩包
    if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].includes(ext)) {
        return '<i class="fas fa-file-archive" style="color: #95a5a6;"></i>';
    }
    
    // 文档文件
    if (['.doc', '.docx'].includes(ext)) {
        return '<i class="fas fa-file-word" style="color: #2980b9;"></i>';
    }
    if (['.xls', '.xlsx'].includes(ext)) {
        return '<i class="fas fa-file-excel" style="color: #27ae60;"></i>';
    }
    if (['.ppt', '.pptx'].includes(ext)) {
        return '<i class="fas fa-file-powerpoint" style="color: #d35400;"></i>';
    }
    if (['.pdf'].includes(ext)) {
        return '<i class="fas fa-file-pdf" style="color: #c0392b;"></i>';
    }
    
    // 文本文件
    if (['.txt', '.log', '.md', '.readme'].includes(ext)) {
        return '<i class="fas fa-file-alt" style="color: #7f8c8d;"></i>';
    }
    
    // 代码文件
    if (['.js', '.jsx', '.json'].includes(ext)) {
        return '<i class="fab fa-js-square" style="color: #f7df1e;"></i>';
    }
    if (['.ts', '.tsx'].includes(ext)) {
        return '<i class="fas fa-code" style="color: #3178c6;"></i>';
    }
    if (['.html', '.htm'].includes(ext)) {
        return '<i class="fab fa-html5" style="color: #e34f26;"></i>';
    }
    if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
        return '<i class="fab fa-css3-alt" style="color: #1572b6;"></i>';
    }
    if (['.py'].includes(ext)) {
        return '<i class="fab fa-python" style="color: #3776ab;"></i>';
    }
    if (['.java'].includes(ext)) {
        return '<i class="fab fa-java" style="color: #007396;"></i>';
    }
    if (['.php'].includes(ext)) {
        return '<i class="fab fa-php" style="color: #777bb4;"></i>';
    }
    if (['.rb'].includes(ext)) {
        return '<i class="fas fa-gem" style="color: #cc342d;"></i>';
    }
    if (['.go'].includes(ext)) {
        return '<i class="fas fa-code" style="color: #00add8;"></i>';
    }
    if (['.rs'].includes(ext)) {
        return '<i class="fas fa-code" style="color: #ce422b;"></i>';
    }
    if (['.c', '.cpp', '.h', '.hpp'].includes(ext)) {
        return '<i class="fas fa-code" style="color: #00599c;"></i>';
    }
    if (['.cs'].includes(ext)) {
        return '<i class="fas fa-code" style="color: #239120;"></i>';
    }
    if (['.swift'].includes(ext)) {
        return '<i class="fas fa-code" style="color: #fa7343;"></i>';
    }
    if (['.kt', '.kts'].includes(ext)) {
        return '<i class="fas fa-code" style="color: #7f52ff;"></i>';
    }
    
    // 配置文件
    if (['.xml', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config'].includes(ext)) {
        return '<i class="fas fa-cog" style="color: #95a5a6;"></i>';
    }
    
    // 数据库文件
    if (['.sql', '.db', '.sqlite', '.mdb'].includes(ext)) {
        return '<i class="fas fa-database" style="color: #2ecc71;"></i>';
    }
    
    // 字体文件
    if (['.ttf', '.otf', '.woff', '.woff2', '.eot'].includes(ext)) {
        return '<i class="fas fa-font" style="color: #34495e;"></i>';
    }
    
    // 可执行文件
    if (['.exe', '.app', '.dmg', '.deb', '.rpm', '.apk'].includes(ext)) {
        return '<i class="fas fa-cogs" style="color: #2c3e50;"></i>';
    }
    
    // 默认文件图标
    return '<i class="fas fa-file" style="color: #95a5a6;"></i>';
}

// 路径工具函数
const path = {
    join: (...parts) => {
        return parts.join('\\').replace(/\\\\/g, '\\').replace(/\//g, '\\');
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
    sep: '\\'
};

// OS 工具函数
const os = {
    platform: () => {
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('win')) return 'win32';
        if (platform.includes('mac')) return 'darwin';
        return 'linux';
    }
};

// ==================== 初始化函数 ====================

async function initTauriAPIs() {
    // 等待 Tauri API 加载
    let attempts = 0;
    while (typeof window.__TAURI__ === 'undefined' && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
    }
    
    if (typeof window.__TAURI__ === 'undefined') {
        throw new Error('Tauri API 加载超时');
    }
    
    // 初始化 Tauri API 引用
    ({ invoke } = window.__TAURI__.tauri);
    ({ open: openDialog, save: saveDialog, message, ask, confirm } = window.__TAURI__.dialog);
    ({ writeText, readText } = window.__TAURI__.clipboard);
    ({ open: shellOpen } = window.__TAURI__.shell);
    
    console.log('✅ Tauri API 已加载');
}

// 不再需要初始化 PDF.js
// 使用系统原生 PDF 查看器

async function initUI() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    // 如果主题是暗色，添加 dark-theme 类到 body
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    
    const savedView = localStorage.getItem('currentView') || 'icon-view';
    setView(savedView);
    
    // 初始化拖拽调整功能
    initResizers();
    
    const statusBar = document.getElementById('status-bar');
    const previewPanel = document.getElementById('preview-panel');
    
    if (statusBar) {
        statusBar.style.display = statusBarVisible ? 'flex' : 'none';
    }
    
    if (previewPanel) {
        previewPanel.style.display = previewPanelVisible ? 'flex' : 'none';
    }

    // 地址栏：点击进入可编辑模式，失焦/回车后恢复为面包屑
    const pathContainer = document.getElementById('path-container');
    if (pathContainer) {
        pathContainer.addEventListener('click', (e) => {
            // 如果点击的是已有的 input，直接返回
            if (e.target.tagName === 'INPUT') return;

            // 创建输入框，填入当前路径
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentPath || '';
            input.className = 'path-edit-input';
            input.style.width = '100%';

            // 清空原来的面包屑，并插入输入框
            pathContainer.innerHTML = '';
            pathContainer.appendChild(input);

            // 选中文本，方便复制/粘贴
            input.focus();
            input.select();

            const finishEdit = async (commit) => {
                const newPath = input.value.trim();
                // 恢复为当前路径的面包屑
                if (!commit || !newPath) {
                    updatePathBar(currentPath || '');
                    return;
                }
                try {
                    await navigateTo(newPath);
                } catch (error) {
                    console.error('路径导航失败:', error);
                    // 导航失败时恢复原路径面包屑
                    updatePathBar(currentPath || '');
                }
            };

            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') {
                    evt.preventDefault();
                    finishEdit(true);
                } else if (evt.key === 'Escape') {
                    evt.preventDefault();
                    finishEdit(false);
                }
            });

            input.addEventListener('blur', () => {
                finishEdit(true);
            });
        });
    }
}

// 格式化字节大小
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function loadDrives() {
    try {
        const drives = await invoke('get_drives');
        const drivesContainer = document.getElementById('drives');
        
        if (!drivesContainer) return;
        
        drivesContainer.innerHTML = `
            <div class="sidebar-section-header" onclick="toggleSidebarSection('drives')">
                <i class="fas fa-chevron-down sidebar-section-icon"></i>
                <span>磁盘驱动器</span>
            </div>
            <div class="sidebar-section-content" id="drives-content"></div>
        `;
        
        const drivesContent = document.getElementById('drives-content');
        
        for (const drive of drives) {
            const driveItem = document.createElement('div');
            driveItem.className = 'drive-item';
            
            // 计算可用空间
            const usedSpace = drive.used_space;
            const totalSpace = drive.total_space;
            const freeSpace = drive.available_space;
            const usagePercent = drive.usage_percent;
            
            // 根据驱动器类型选择图标
            let driveIcon = 'fa-hdd';
            let iconColor = '#4a90e2';
            
            switch(drive.drive_type) {
                case 'Network':
                    driveIcon = 'fa-network-wired';
                    iconColor = '#27ae60';
                    break;
                case 'SSD':
                    driveIcon = 'fa-microchip';
                    iconColor = '#9b59b6';
                    break;
                case 'HDD':
                    driveIcon = 'fa-hdd';
                    iconColor = '#4a90e2';
                    break;
                case 'Removable':
                    driveIcon = 'fa-usb';
                    iconColor = '#e67e22';
                    break;
                case 'CD-ROM':
                    driveIcon = 'fa-compact-disc';
                    iconColor = '#95a5a6';
                    break;
                default:
                    driveIcon = 'fa-hdd';
                    iconColor = '#7f8c8d';
            }
            
            driveItem.innerHTML = `
                <div class="drive-icon-wrapper">
                    <i class="fas ${driveIcon} file-icon" style="color: ${iconColor};"></i>
                </div>
                <div class="drive-info">
                    <div class="drive-header">
                        <span class="drive-label">${drive.label} <span class="drive-name">(${drive.name})</span></span>
                    </div>
                    <div class="drive-space-text">${formatBytes(freeSpace)} 可用 / ${formatBytes(totalSpace)}</div>
                    <div class="drive-progress-bar">
                        <div class="drive-progress-fill" style="width: ${usagePercent}%"></div>
                    </div>
                </div>
            `;
            
            // 点击事件
            driveItem.addEventListener('click', () => navigateTo(drive.name));
            
            // 悬停提示
            driveItem.title = `${drive.label}\n` +
                             `类型: ${drive.drive_type}\n` +
                             `文件系统: ${drive.file_system}\n` +
                             `总容量: ${formatBytes(totalSpace)}\n` +
                             `已使用: ${formatBytes(usedSpace)} (${usagePercent.toFixed(1)}%)\n` +
                             `可用空间: ${formatBytes(freeSpace)}`;
            
            drivesContent.appendChild(driveItem);
        }
    } catch (error) {
        console.error('加载驱动器失败:', error);
    }
}

// ==================== 文件导航 ====================

async function navigateTo(newPath) {
    try {
        console.log('导航到:', newPath);
        
        // 确保路径格式正确（网络路径需要特殊处理）
        let normalizedPath = newPath;
        
        const files = await invoke('read_directory', { path: normalizedPath });
        
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(normalizedPath);
        historyIndex = history.length - 1;
        
        currentPath = normalizedPath;
        
        // 记录访问历史
        addToRecentAccess(normalizedPath, true);
        
        updatePathBar(normalizedPath);
        updateFileList(files);
        updateStatusBar(files);
        updateNavigationButtons();
        
    } catch (error) {
        console.error('导航失败:', error);
        const { dialog } = window.__TAURI__;
        if (dialog && dialog.message) {
            await dialog.message('无法打开目录: ' + error, { 
                title: '错误', 
                type: 'error' 
            });
        } else {
            alert('无法打开目录: ' + error);
        }
    }
}

async function navigateBack() {
    if (historyIndex > 0) {
        historyIndex--;
        const newPath = history[historyIndex];
        currentPath = newPath;
        
        const files = await invoke('read_directory', { path: newPath });
        updatePathBar(newPath);
        updateFileList(files);
        updateStatusBar(files);
        updateNavigationButtons();
    }
}

async function navigateForward() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        const newPath = history[historyIndex];
        currentPath = newPath;
        
        const files = await invoke('read_directory', { path: newPath });
        updatePathBar(newPath);
        updateFileList(files);
        updateStatusBar(files);
        updateNavigationButtons();
    }
}

async function navigateUp() {
    if (isFromCalendar) {
        // 如果是从日历视图跳转来的，返回日历视图
        isFromCalendar = false; // 重置标记
        showCalendarView();
        return;
    }
    
    const parentPath = path.dirname(currentPath);
    if (parentPath && parentPath !== currentPath) {
        await navigateTo(parentPath);
    }
}

// ==================== UI 更新函数 ====================

function updatePathBar(filepath) {
    const pathContainer = document.getElementById('path-container');
    if (!pathContainer) return;
    
    const parts = filepath.split(/[\\/]/).filter(p => p);
    pathContainer.innerHTML = '';
    
    let currentPathPart = '';
    parts.forEach((part, index) => {
        if (index === 0) {
            currentPathPart = part + '\\';
        } else {
            currentPathPart += part + '\\';
        }
        
        const pathPart = document.createElement('span');
        pathPart.className = 'path-part';
        pathPart.textContent = part;
        pathPart.dataset.path = currentPathPart;
        pathPart.addEventListener('click', (e) => {
            navigateTo(e.target.dataset.path);
        });
        
        pathContainer.appendChild(pathPart);
        
        if (index < parts.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'path-separator';
            separator.textContent = ' › ';
            pathContainer.appendChild(separator);
        }
    });
}

function updateFileList(files) {
    const fileList = document.getElementById('file-list');
    const fileListContainer = document.getElementById('file-list-container');
    if (!fileList) return;
    
    const sortedFiles = sortFiles(files);
    fileList.innerHTML = '';
    
    // 根据当前视图渲染文件列表
    if (currentView === 'group-view') {
        // 分组视图：按文件类型分组
        renderGroupView(sortedFiles, fileList);
    } else if (currentView === 'timeline-view') {
        // 时间轴视图：按时间分组
        renderTimelineView(sortedFiles, fileList);
    } else if (currentView === 'list-view') {
        // 列表视图：添加表头并渲染
        fileList.className = '';
        
        // 添加表头
        const headerRow = document.createElement('div');
        headerRow.className = 'file-item file-list-header';
        headerRow.innerHTML = `
            <div class="file-icon"></div>
            <div class="file-name">名称</div>
            <div class="file-size">大小</div>
            <div class="file-date">修改日期</div>
            <div class="file-type">类型</div>
        `;
        fileList.appendChild(headerRow);
        
        // 添加文件项
        sortedFiles.forEach(file => {
            const fileItem = createFileItem(file);
            fileList.appendChild(fileItem);
        });
    } else {
        // 图标视图：默认渲染
        fileList.className = '';
    sortedFiles.forEach(file => {
        const fileItem = createFileItem(file);
        fileList.appendChild(fileItem);
    });
    }
}

// 渲染分组视图
function renderGroupView(files, container) {
    const groups = groupFilesByType(files);
    
    Object.keys(groups).forEach(groupName => {
        const groupFiles = groups[groupName];
        if (groupFiles.length === 0) return;
        
        const groupElement = document.createElement('div');
        groupElement.className = 'file-list-group';
        
        groupElement.innerHTML = `
            <div class="file-list-group-header">
                <span class="group-title">${groupName}</span>
                <span class="group-count">(${groupFiles.length})</span>
            </div>
            <div class="file-list-group-content"></div>
        `;
        
        const groupContent = groupElement.querySelector('.file-list-group-content');
        groupFiles.forEach(file => {
            const fileItem = createFileItem(file);
            groupContent.appendChild(fileItem);
        });
        
        container.appendChild(groupElement);
    });
}

// 渲染时间轴视图
function renderTimelineView(files, container) {
    // 按创建时间分组
    const timelineGroups = {};
    const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", 
                       "七月", "八月", "九月", "十月", "十一月", "十二月"];
    
    files.forEach(file => {
        if (!file.created && !file.modified) return;
        
        const date = new Date((file.created || file.modified) * 1000);
        const year = date.getFullYear();
        const month = date.getMonth();
        const key = `${year}-${month}`;
        const label = `${year}年 ${monthNames[month]}`;
        
        if (!timelineGroups[key]) {
            timelineGroups[key] = {
                label,
                files: [],
                year,
                month
            };
        }
        timelineGroups[key].files.push(file);
    });
    
    // 按时间倒序排序
    const sortedKeys = Object.keys(timelineGroups).sort((a, b) => b.localeCompare(a));
    
    sortedKeys.forEach(key => {
        const group = timelineGroups[key];
        
        const groupElement = document.createElement('div');
        groupElement.className = 'file-list-group';
        
        groupElement.innerHTML = `
            <div class="file-list-group-header">
                <span class="group-title">${group.label}</span>
                <span class="group-count">(${group.files.length})</span>
            </div>
            <div class="file-list-group-content"></div>
        `;
        
        const groupContent = groupElement.querySelector('.file-list-group-content');
        group.files.forEach(file => {
            const fileItem = createFileItem(file);
            groupContent.appendChild(fileItem);
        });
        
        container.appendChild(groupElement);
    });
}

// 按文件类型分组
function groupFilesByType(files) {
    const groups = {
        '文件夹': [],
        '图片': [],
        '视频': [],
        '音频': [],
        '文档': [],
        '压缩包': [],
        '代码': [],
        '其他': []
    };
    
    files.forEach(file => {
        if (file.is_directory) {
            groups['文件夹'].push(file);
            return;
        }
        
        const ext = path.extname(file.name).toLowerCase();
        
        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'].includes(ext)) {
            groups['图片'].push(file);
        } else if (['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv'].includes(ext)) {
            groups['视频'].push(file);
        } else if (['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a'].includes(ext)) {
            groups['音频'].push(file);
        } else if (['.txt', '.md', '.doc', '.docx', '.pdf', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
            groups['文档'].push(file);
        } else if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext)) {
            groups['压缩包'].push(file);
        } else if (['.js', '.ts', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rs', '.html', '.css', '.json', '.xml'].includes(ext)) {
            groups['代码'].push(file);
        } else {
            groups['其他'].push(file);
        }
    });
    
    return groups;
}

function createFileItem(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    const normalizedPath = normalizePath(file.path);
    fileItem.dataset.path = normalizedPath;
    fileItem.dataset.isDirectory = file.is_directory;
    
    const ext = path.extname(file.name).toLowerCase();
    const extLabel = (ext || '').replace('.', '').toUpperCase();
    let icon = getFileIcon(file.name, file.is_directory);

    // 如果是图片文件，显示缩略图，并在左上角叠加一个小类型图标
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'].includes(ext);
    if (isImage && !file.is_directory) {
        const { convertFileSrc } = window.__TAURI__.tauri;
        const imageUrl = convertFileSrc(file.path);
        icon = `
            <div class="file-thumbnail-wrapper no-overlay">
                <img src="${imageUrl}" class="file-thumbnail" alt="${file.name}">
                <span class="file-ext-badge">${extLabel}</span>
            </div>
        `;
    }
    
    const tag = fileTags[file.path];
    if (tag && tag !== 'none') {
        fileItem.classList.add(`tag-${tag}`);
    }
    
    // 格式化日期
    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    // 根据当前视图类型设置不同的 HTML 结构
    if (currentView === 'icon-view') {
        // 图标视图：文件夹图标中间增加数量徽标
        if (file.is_directory) {
            fileItem.innerHTML = `
                <div class="file-icon">
                    <div class="folder-icon-wrapper">
                        ${icon}
                        <span class="folder-count-badge"></span>
                    </div>
                </div>
                <div class="file-name">${file.name}</div>
            `;
        } else {
            fileItem.innerHTML = `
                <div class="file-icon">${icon}</div>
                <div class="file-name">${file.name}</div>
            `;
        }
    } else {
        // 列表视图、分组视图、时间轴视图：显示完整信息
        fileItem.innerHTML = `
            <div class="file-icon">${icon}</div>
            <div class="file-name">${file.name}</div>
            <div class="file-size">${file.is_directory ? '-' : formatFileSize(file.size)}</div>
            <div class="file-date">${formatDate(file.modified)}</div>
            <div class="file-type">${file.is_directory ? '文件夹' : (ext || '文件')}</div>
        `;
    }

    // 需要优先尝试系统缩略图的文件类型（如 PSD / AI / PDF / PPTX）
    const needShellThumb = ['.psd', '.ai', '.pdf', '.pptx'].includes(ext);
    if (!file.is_directory && needShellThumb) {
        const fileIconEl = fileItem.querySelector('.file-icon');
        if (fileIconEl) {
            (async () => {
                try {
                    console.log('尝试获取系统缩略图:', normalizedPath);
                    const thumbPath = await invoke('get_system_thumbnail', {
                        path: normalizedPath,
                        width: 256,
                        height: 256
                    });
                    if (!thumbPath) return;
                    const { convertFileSrc } = window.__TAURI__.tauri;
                    const thumbUrl = convertFileSrc(thumbPath);
                    fileIconEl.innerHTML = `
                        <div class="file-thumbnail-wrapper no-overlay">
                            <img src="${thumbUrl}" class="file-thumbnail" alt="${file.name}">
                            <span class="file-ext-badge">${extLabel}</span>
                        </div>
                    `;
                } catch (e) {
                    console.warn('获取系统缩略图失败:', e);
                    // 对 PPTX 再尝试内置缩略图
                    if (ext === '.pptx') {
                        try {
                            console.log('回退到 PPTX 内置缩略图:', normalizedPath);
                            const thumbPath = await invoke('get_ppt_thumbnail', { path: normalizedPath });
                            if (!thumbPath) return;
                            const { convertFileSrc } = window.__TAURI__.tauri;
                            const thumbUrl = convertFileSrc(thumbPath);
                            fileIconEl.innerHTML = `
                                <div class="file-thumbnail-wrapper no-overlay">
                                    <img src="${thumbUrl}" class="file-thumbnail" alt="${file.name}">
                                    <span class="file-ext-badge">${extLabel}</span>
                                </div>
                            `;
                        } catch (err) {
                            console.warn('获取 PPTX 内置缩略图失败，使用默认图标:', err);
                        }
                    }
                }
            })();
        }
    }
    
    // 如果是 exe，可执行文件：仅在 Windows 下尝试加载真实图标
    if (!file.is_directory && ext && ext.toLowerCase() === '.exe') {
        const isWindows = navigator.platform.toLowerCase().includes('win');
        const fileIconEl = fileItem.querySelector('.file-icon');
        if (isWindows && fileIconEl) {
            (async () => {
                try {
                    const iconPath = await invoke('get_exe_icon', { path: file.path });
                    if (!iconPath) return;
                    const { convertFileSrc } = window.__TAURI__.tauri;
                    const iconUrl = convertFileSrc(iconPath);
                    fileIconEl.innerHTML = `
                        <div class="file-thumbnail-wrapper">
                            <img src="${iconUrl}" class="file-thumbnail" alt="${file.name}">
                        </div>
                    `;
                } catch (e) {
                    console.warn('获取 exe 图标失败，使用默认图标:', e);
                }
            })();
        }
    }

    // 如果是 PPTX 文件：尝试加载内置缩略图
    if (!file.is_directory && ext && ext.toLowerCase() === '.pptx') {
        const fileIconEl = fileItem.querySelector('.file-icon');
        if (fileIconEl) {
            (async () => {
                try {
                    console.log('尝试加载 PPT 缩略图:', normalizedPath);
                    const thumbPath = await invoke('get_ppt_thumbnail', { path: normalizedPath });
                    if (!thumbPath) return;
                    const { convertFileSrc } = window.__TAURI__.tauri;
                    const thumbUrl = convertFileSrc(thumbPath);
                    fileIconEl.innerHTML = `
                        <div class="file-thumbnail-wrapper no-overlay">
                            <img src="${thumbUrl}" class="file-thumbnail" alt="${file.name}">
                            <span class="file-ext-badge">${extLabel}</span>
                        </div>
                    `;
                } catch (e) {
                    // 没有缩略图或解析失败时保持默认图标
                    console.warn('获取 PPT 缩略图失败，使用默认图标:', e);
                }
            })();
        }
    }

    // 为文件夹异步加载子项数量（仅加载一次并缓存）
    if (file.is_directory && currentView === 'icon-view') {
        const folderPath = normalizePath(file.path);
        const cached = folderChildrenCountCache[folderPath];
        const badge = fileItem.querySelector('.folder-count-badge');
        if (badge) {
            if (typeof cached === 'number') {
                badge.textContent = cached;
            } else {
                // 异步统计子项数量
                (async () => {
                    try {
                        const children = await invoke('read_directory', { path: folderPath });
                        const count = Array.isArray(children) ? children.length : 0;
                        folderChildrenCountCache[folderPath] = count;
                        badge.textContent = count;
                    } catch (err) {
                        console.warn('统计文件夹子项数量失败:', folderPath, err);
                    }
                })();
            }
        }
    }

    fileItem.addEventListener('dblclick', () => openFile(file));
    fileItem.addEventListener('click', (e) => selectFile(file, e.ctrlKey));

    // 悬停一定时间后自动更新预览
    fileItem.addEventListener('mouseenter', () => {
        // 如果存在旧的悬停定时器，先清除
        if (hoverPreviewTimer) {
            clearTimeout(hoverPreviewTimer);
            hoverPreviewTimer = null;
        }

        const filePath = file.path;
        hoverPreviewTimer = setTimeout(() => {
            // 仅在没有按下多选键的情况下触发悬停预览
            if (!filePath) return;
            updatePreview(filePath);
        }, HOVER_PREVIEW_DELAY);
    });

    fileItem.addEventListener('mouseleave', () => {
        if (hoverPreviewTimer) {
            clearTimeout(hoverPreviewTimer);
            hoverPreviewTimer = null;
        }
    });
    fileItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(file, e.clientX, e.clientY);
    });
    
    return fileItem;
}

function setStatusBarColumns(left, center, right) {
    const statusBar = document.getElementById('status-bar');
    if (!statusBar) return;
    statusBar.innerHTML = `
        <div class="status-col status-left">${left || ''}</div>
        <div class="status-col status-center">${center || ''}</div>
        <div class="status-col status-right">${right || ''}</div>
    `;
}

function updateStatusBar(files) {
    const fileCount = files.filter(f => !f.is_directory).length;
    const folderCount = files.filter(f => f.is_directory).length;
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

    lastDirectoryStats = { fileCount, folderCount, totalSize };

    // 目录级状态栏：当前路径 + 统计信息
    const pathText = currentPath || '';
    const centerText = `${folderCount} 个文件夹, ${fileCount} 个文件`;
    const rightText = `总大小: ${formatFileSize(totalSize)}`;
    setStatusBarColumns(pathText, centerText, rightText);
}

function updateStatusBarForEntry(fileInfo) {
    if (!fileInfo) return;

    const pathText = fileInfo.path || currentPath || '';
    const isDir = fileInfo.isDirectory;
    const typeText = isDir ? '文件夹' : (path.extname(fileInfo.name) || '文件');
    const sizeText = isDir ? '-' : formatFileSize(fileInfo.size || 0);
    const centerParts = [
        `类型: ${typeText}`,
        `大小: ${sizeText}`
    ];

    if (lastDirectoryStats) {
        centerParts.push(`所在目录: ${lastDirectoryStats.folderCount} 个文件夹, ${lastDirectoryStats.fileCount} 个文件`);
    }

    const centerText = centerParts.join(' | ');
    const rightParts = [];
    if (fileInfo.created) {
        rightParts.push(`创建: ${formatDate(fileInfo.created, 'short')}`);
    }
    if (fileInfo.modified) {
        rightParts.push(`修改: ${formatDate(fileInfo.modified, 'short')}`);
    }
    const rightText = rightParts.join(' | ');

    setStatusBarColumns(pathText, centerText, rightText);
}

function updateNavigationButtons() {
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const upBtn = document.getElementById('up-btn');
    
    if (backBtn) backBtn.disabled = historyIndex <= 0;
    if (forwardBtn) forwardBtn.disabled = historyIndex >= history.length - 1;
    if (upBtn) {
        const parentPath = path.dirname(currentPath);
        upBtn.disabled = !parentPath || parentPath === currentPath;
    }
}

// ==================== 工具函数 ====================

// 规范化 Windows 路径（处理像 "W:下载" 这样的情况）
function normalizePath(p) {
    if (!p || typeof p !== 'string') return p;
    // 将正斜杠统一为反斜杠
    let pathStr = p.replace(/\//g, '\\');
    // 处理形如 "W:文件夹" 的路径，补上反斜杠
    const driveMatch = /^([A-Za-z]:)([^\\].*)$/.exec(pathStr);
    if (driveMatch) {
        pathStr = `${driveMatch[1]}\\${driveMatch[2]}`;
    }
    return pathStr;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function sortFiles(files) {
    return files.sort((a, b) => {
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;
        
        let comparison = 0;
        switch (sortBy) {
            case 'name':
                comparison = a.name.localeCompare(b.name, 'zh-CN');
                break;
            case 'size':
                comparison = a.size - b.size;
                break;
            case 'modified':
                comparison = (a.modified || 0) - (b.modified || 0);
                break;
            case 'created':
                comparison = (a.created || 0) - (b.created || 0);
                break;
            case 'type':
                const extA = path.extname(a.name);
                const extB = path.extname(b.name);
                comparison = extA.localeCompare(extB);
                break;
        }
        
        return sortOrder === 'asc' ? comparison : -comparison;
    });
}

// ==================== 文件操作 ====================

async function openFile(file) {
    if (file.is_directory) {
        await navigateTo(normalizePath(file.path));
    } else {
        try {
            // 记录文件访问
            addToRecentAccess(file.path, false);
            await invoke('open_with_default', { path: file.path });
        } catch (error) {
            console.error('打开文件失败:', error);
        }
    }
}

function selectFile(file, multiSelect) {
    const filePath = normalizePath(file.path);
    console.log('selectFile 被调用，文件:', file.name, '路径:', filePath, 'isDirectory:', file.is_directory);

    // 不能直接用 querySelector 携带原始路径（包含反斜杠、# 等特殊字符），否则会被当成 CSS 转义
    // 这里通过遍历所有带 data-path 的 file-item，用 JS 比较规范化后的路径，避免选择器转义问题
    let fileItem = null;
    const allItems = document.querySelectorAll('.file-item[data-path]');
    for (const el of allItems) {
        const elPath = normalizePath(el.dataset.path || '');
        if (elPath === filePath) {
            fileItem = el;
            break;
        }
    }

    if (!fileItem) {
        console.error('找不到文件元素，路径:', filePath);
        return;
    }
    
    const isCurrentlySelected = fileItem.classList.contains('selected');
    
    if (!multiSelect) {
        // 清除其他选中状态
        document.querySelectorAll('.file-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        selectedFiles = [];
        console.log('清除了所有选中状态');
        
        // 单击模式：直接选中当前项
        fileItem.classList.add('selected');
        selectedFiles.push(filePath);
        console.log('已选中:', filePath);
        
        // 更新预览面板
        updatePreview(file.path);
    } else {
        // 多选模式（Ctrl + 点击）：切换选中状态
        if (isCurrentlySelected) {
            // 取消选中
            fileItem.classList.remove('selected');
            selectedFiles = selectedFiles.filter(f => f !== filePath);
            console.log('取消选中，剩余:', selectedFiles);
        } else {
            // 选中
            fileItem.classList.add('selected');
            selectedFiles.push(filePath);
            console.log('已选中，当前选中:', selectedFiles);
        }
        
        // 多选时预览最后一个选中的文件
        if (selectedFiles.length > 0) {
            updatePreview(normalizePath(selectedFiles[selectedFiles.length - 1]));
        }
    }
}

// ==================== 文件预览 ====================

async function updatePreview(filePath) {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;
    
    // 在切换预览前暂停已有的音频/视频
    const oldMedia = previewContent.querySelectorAll('audio, video');
    oldMedia.forEach(m => {
        try { m.pause(); } catch (e) {}
    });

    // 恢复默认样式（可能被 PDF 预览修改过）
    previewContent.style.padding = '';
    previewContent.style.display = '';
    previewContent.style.flexDirection = '';
    previewContent.style.height = '';
    
    if (!filePath) {
        previewContent.innerHTML = '<p class="preview-empty">请选择一个文件以预览</p>';
        return;
    }
    
    try {
        // 检查文件是否存在
        const exists = await invoke('path_exists', { path: filePath });
        if (!exists) {
            previewContent.innerHTML = '<p class="preview-error">文件不存在</p>';
            return;
        }
        
        // 获取文件信息（用于状态栏和附加信息，不强制要求）
        const fileInfo = await getFileDetails(filePath);
        console.log('📁 fileInfo:', fileInfo);

        if (!fileInfo) {
            console.warn('getFileDetails 失败，将仅根据路径进行预览:', filePath);
        } else {
            // 根据当前预览对象更新状态栏
            updateStatusBarForEntry(fileInfo);
        }

        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);
        
        // 如果是目录
        if (fileInfo && fileInfo.isDirectory) {
            try {
                const files = await invoke('read_directory', { path: filePath });
                
                // 分类统计
                const folders = files.filter(f => f.is_directory);
                const regularFiles = files.filter(f => !f.is_directory);
                
                // 限制显示数量
                const maxDisplay = 30;
                const displayFiles = files.slice(0, maxDisplay);
                
                const fileList = displayFiles.map(f => {
                    const icon = getFileIcon(f.name, f.is_directory);
                    const size = f.is_directory ? '' : `<span class="file-size-hint">${formatBytes(f.size || 0)}</span>`;
                    return `<li class="preview-list-item">
                        <span class="preview-item-icon">${icon}</span>
                        <span class="preview-item-name">${f.name}</span>
                        ${size}
                    </li>`;
                }).join('');
                
                previewContent.innerHTML = `
                    <div class="preview-header">
                        <div class="preview-header-main">
                            <i class="fas fa-folder" style="color: #ffd700; font-size: 28px;"></i>
                            <h3>${fileName}</h3>
                        </div>
                        <button class="preview-open-btn" title="在资源管理器中打开此文件夹" onclick="window.__TAURI__.shell.open('${filePath.replace(/\\/g, "\\\\")}')">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    </div>
                    <div class="preview-file-list">
                        <div style="font-size: 12px; color: #999; margin-bottom: 8px; padding: 0 10px;">
                            <i class="fas fa-list"></i> 内容列表 ${files.length > maxDisplay ? `(显示前 ${maxDisplay} 项)` : ''}
                        </div>
                        <ul>${fileList}</ul>
                        ${files.length > maxDisplay ? `<p class="preview-more"><i class="fas fa-ellipsis-h"></i> 还有 ${files.length - maxDisplay} 个项目...</p>` : ''}
                    </div>
                    <div class="preview-info" data-folder-path="${filePath.replace(/\\/g, "\\\\")}">
                        <p><i class="fas fa-folder"></i> ${folders.length} 个文件夹</p>
                        <p><i class="fas fa-file"></i> ${regularFiles.length} 个文件</p>
                        <p><i class="fas fa-info-circle"></i> 共 ${files.length} 个项目</p>
                        ${fileInfo.created ? `<p><i class="fas fa-calendar-plus"></i> 创建: ${formatDate(fileInfo.created)}</p>` : ''}
                        ${fileInfo.modified ? `<p><i class="fas fa-calendar-alt"></i> 修改: ${formatDate(fileInfo.modified)}</p>` : ''}
                    </div>
                `;
            } catch (error) {
                previewContent.innerHTML = `<p class="preview-error">无法读取文件夹内容: ${error}</p>`;
            }
            return;
        }
        // 图片文件
        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'].includes(ext)) {
            const { convertFileSrc } = window.__TAURI__.tauri;
            const assetUrl = convertFileSrc(filePath);
            
            // 设置样式以最大化显示
            previewContent.style.padding = '0';
            previewContent.style.display = 'flex';
            previewContent.style.flexDirection = 'column';
            
            previewContent.innerHTML = `
                <div class="preview-header" style="flex-shrink: 0; padding: 15px;">
                    <i class="fas fa-image" style="color: #e74c3c; font-size: 48px;"></i>
                    <h3>${fileName}</h3>
                </div>
                <div class="preview-image-container" style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; padding: 10px; overflow: auto;">
                    <img src="${assetUrl}" alt="${fileName}" class="preview-image" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                </div>
                <div class="preview-info" style="flex-shrink: 0; padding: 15px; border-top: 1px solid var(--border-color);">
                    ${fileInfo ? `<p><i class=\"fas fa-hdd\"></i> 大小: ${formatBytes(fileInfo.size || 0)}</p>` : ''}
                    ${fileInfo && fileInfo.created ? `<p><i class=\"fas fa-calendar-plus\"></i> 创建时间: ${formatDate(fileInfo.created)}</p>` : ''}
                    ${fileInfo && fileInfo.modified ? `<p><i class=\"fas fa-calendar-alt\"></i> 修改时间: ${formatDate(fileInfo.modified)}</p>` : ''}
                </div>
            `;
            return;
        }
        
        // 视频文件
        if (['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.m4v', '.webm'].includes(ext)) {
            const { convertFileSrc } = window.__TAURI__.tauri;
            const assetUrl = convertFileSrc(filePath);
            
            // 设置样式以最大化显示
            previewContent.style.padding = '0';
            previewContent.style.display = 'flex';
            previewContent.style.flexDirection = 'column';
            
            previewContent.innerHTML = `
                <div class="preview-header" style="flex-shrink: 0; padding: 15px;">
                    <i class="fas fa-film" style="color: #9b59b6; font-size: 48px;"></i>
                    <h3>${fileName}</h3>
                </div>
                <div class="preview-video-container" style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 10px; min-height: 0;">
                    <video controls autoplay muted class="preview-video" style="max-width: 100%; max-height: 100%;">
                        <source src="${assetUrl}" type="video/${ext.slice(1)}">
                        您的浏览器不支持视频播放。
                    </video>
                </div>
                <div class="preview-info" style="flex-shrink: 0; padding: 15px; border-top: 1px solid var(--border-color);">
                    <p><i class="fas fa-hdd"></i> 大小: ${formatBytes(fileInfo.size || 0)}</p>
                    ${fileInfo.created ? `<p><i class="fas fa-calendar-plus"></i> 创建时间: ${formatDate(fileInfo.created)}</p>` : ''}
                    ${fileInfo.modified ? `<p><i class="fas fa-calendar-alt"></i> 修改时间: ${formatDate(fileInfo.modified)}</p>` : ''}
                </div>
            `;

            // 自动播放视频（在某些环境下可能仍需用户交互）
            const videoEl = previewContent.querySelector('.preview-video');
            if (videoEl) {
                try {
                    videoEl.currentTime = 0;
                    videoEl.play().catch(() => {});
                } catch (e) {}
            }
            return;
        }
        
        // 音频文件
        if (['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a', '.wma'].includes(ext)) {
            const { convertFileSrc } = window.__TAURI__.tauri;
            const assetUrl = convertFileSrc(filePath);
            
            previewContent.innerHTML = `
                <div class="preview-header">
                    <i class="fas fa-music" style="color: #3498db; font-size: 48px;"></i>
                    <h3>${fileName}</h3>
                </div>
                <div class="preview-audio-container" style="padding: 20px; display: flex; align-items: center; justify-content: center;">
                    <audio controls autoplay class="preview-audio" style="width: 100%;">
                        <source src="${assetUrl}" type="audio/${ext.slice(1)}">
                        您的浏览器不支持音频播放。
                    </audio>
                </div>
                <div class="preview-info">
                    ${fileInfo ? `<p><i class=\"fas fa-hdd\"></i> 大小: ${formatBytes(fileInfo.size || 0)}</p>` : ''}
                    ${fileInfo && fileInfo.created ? `<p><i class=\"fas fa-calendar-plus\"></i> 创建时间: ${formatDate(fileInfo.created)}</p>` : ''}
                    ${fileInfo && fileInfo.modified ? `<p><i class=\"fas fa-calendar-alt\"></i> 修改时间: ${formatDate(fileInfo.modified)}</p>` : ''}
                </div>
            `;

            const audioEl = previewContent.querySelector('.preview-audio');
            if (audioEl) {
                try {
                    audioEl.currentTime = 0;
                    audioEl.play().catch(() => {});
                } catch (e) {}
            }
            return;
        }
        
        // 文本文件
        if (['.txt', '.tap', '.md', '.log', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.sass', 
             '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf', '.py', '.java', '.c', '.cpp', 
             '.h', '.hpp', '.rs', '.go', '.php', '.rb', '.sh', '.bat', '.ps1'].includes(ext)) {
            try {
                // 通过后端命令智能读取文本（支持 UTF-8 / GBK / ANSI 等编码）
                const maxLength = 5000;
                let content = await invoke('read_text_flexible', { path: filePath, maxLen: maxLength * 5 });
                if (typeof content !== 'string') {
                    content = String(content ?? '');
                }

                // 限制预览长度
                const isTruncated = content.length > maxLength;
                if (isTruncated) {
                    content = content.slice(0, maxLength);
                }
                
                // 转义 HTML
                const escapedContent = content
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
                
                // 设置样式以最大化显示
                previewContent.style.padding = '0';
                previewContent.style.display = 'flex';
                previewContent.style.flexDirection = 'column';
                
                previewContent.innerHTML = `
                    <div class="preview-header" style="flex-shrink: 0; padding: 15px;">
                        <i class="fas fa-file-code" style="color: #2ecc71; font-size: 48px;"></i>
                        <h3>${fileName}</h3>
                    </div>
                    <div class="preview-code-container" style="flex: 1; overflow: auto; padding: 15px; min-height: 0; background: transparent;">
                        <pre style="margin: 0; background: transparent;"><code class="preview-code" style="background: transparent;">${escapedContent}</code></pre>
                        ${isTruncated ? '<p class="preview-more">... 内容已截断</p>' : ''}
                    </div>
                    <div class="preview-info" style="flex-shrink: 0; padding: 15px; border-top: 1px solid var(--border-color);">
                        ${fileInfo ? `<p><i class=\"fas fa-hdd\"></i> 大小: ${formatBytes(fileInfo.size || 0)}</p>` : ''}
                        ${fileInfo && fileInfo.created ? `<p><i class=\"fas fa-calendar-plus\"></i> 创建时间: ${formatDate(fileInfo.created)}</p>` : ''}
                        ${fileInfo && fileInfo.modified ? `<p><i class=\"fas fa-calendar-alt\"></i> 修改时间: ${formatDate(fileInfo.modified)}</p>` : ''}
                    </div>
                `;

                // 代码语法高亮（如果本地 hljs 存在）
                const codeEl = previewContent.querySelector('.preview-code');
                if (window.hljs && codeEl) {
                    try {
                        window.hljs.highlightElement(codeEl);
                    } catch (e) {
                        console.warn('代码高亮失败:', e);
                    }
                }
            } catch (error) {
                previewContent.innerHTML = `<p class="preview-error">无法读取文件内容: ${error}</p>`;
            }
            return;
        }
        
        // PDF 文件
        if (ext === '.pdf') {
            try {
                await renderPDFPreview(filePath, fileName, fileInfo);
            } catch (error) {
                console.error('PDF 预览失败:', error);
                previewContent.innerHTML = `
                    <div class="preview-header">
                        <i class="fas fa-file-pdf" style="color: #c0392b; font-size: 48px;"></i>
                        <h3>${fileName}</h3>
                    </div>
                    <div class="preview-info">
                        <p><i class="fas fa-exclamation-triangle"></i> PDF 预览失败: ${error.message}</p>
                ${fileInfo ? `<p><i class=\"fas fa-hdd\"></i> 大小: ${formatBytes(fileInfo.size || 0)}</p>` : ''}
                ${fileInfo && fileInfo.created ? `<p><i class="fas fa-calendar-plus"></i> 创建时间: ${formatDate(fileInfo.created)}</p>` : ''}
                ${fileInfo && fileInfo.modified ? `<p><i class="fas fa-calendar-alt"></i> 修改时间: ${formatDate(fileInfo.modified)}</p>` : ''}
                        <button class="preview-open-btn" onclick="window.__TAURI__.shell.open('${filePath.replace(/\\/g, '\\\\')}')">
                            <i class="fas fa-external-link-alt"></i> 使用默认程序打开
                        </button>
                    </div>
                `;
            }
            return;
        }
        
        // 默认预览（显示文件信息）
        const icon = getFileIcon(fileName, false);
        previewContent.innerHTML = `
            <div class="preview-header">
                <div style="font-size: 48px;">${icon}</div>
                <h3>${fileName}</h3>
            </div>
            <div class="preview-info">
                <p><i class="fas fa-tag"></i> 类型: ${ext || '未知'}</p>
                ${fileInfo ? `<p><i class=\"fas fa-hdd\"></i> 大小: ${formatBytes(fileInfo.size || 0)}</p>` : ''}
                ${fileInfo && fileInfo.created ? `<p><i class=\"fas fa-calendar-plus\"></i> 创建时间: ${formatDate(fileInfo.created)}</p>` : ''}
                ${fileInfo && fileInfo.modified ? `<p><i class=\"fas fa-calendar-alt\"></i> 修改时间: ${formatDate(fileInfo.modified)}</p>` : ''}
                <button class="preview-open-btn" onclick="window.__TAURI__.shell.open('${filePath.replace(/\\/g, '\\\\')}')">
                    <i class="fas fa-external-link-alt"></i> 使用默认程序打开
                </button>
            </div>
        `;
        
    } catch (error) {
        console.error('预览文件失败:', error);
        previewContent.innerHTML = `<p class="preview-error">预览失败: ${error}</p>`;
    }
}

// 获取文件详细信息的辅助函数
// getFileDetails 函数已移至文件末尾统一定义

// PDF 预览渲染函数（使用 iframe + 调整后的 CSP）
async function renderPDFPreview(filePath, fileName, fileInfo) {
    const previewContent = document.getElementById('preview-content');
    
    try {
        // 使用 Tauri 的 convertFileSrc 转换路径
        const { convertFileSrc } = window.__TAURI__.tauri;
        const pdfUrl = convertFileSrc(filePath);
        
        console.log('📄 尝试使用 iframe 加载 PDF:', pdfUrl);
        
        // 使用 iframe 直接加载 PDF（最大化显示区域）
        // 先移除 preview-content 的 padding，让 iframe 完全占满
        previewContent.style.padding = '0';
        previewContent.style.display = 'flex';
        previewContent.style.flexDirection = 'column';
        previewContent.style.height = '100%';
        
        previewContent.innerHTML = `
            <div class="preview-header" style="padding: 6px 10px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
                <div style="display: flex; align-items: center; overflow: hidden;">
                    <i class="fas fa-file-pdf" style="color: #c0392b; font-size: 16px; margin-right: 6px; flex-shrink: 0;"></i>
                    <span style="font-weight: 500; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fileName}</span>
                </div>
                <button 
                    onclick="window.__TAURI__.shell.open('${filePath.replace(/\\/g, '\\\\')}')"
                    style="padding: 4px 8px; background: transparent; color: #c0392b; border: 1px solid #c0392b; border-radius: 3px; cursor: pointer; font-size: 11px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;"
                    title="使用外部程序打开"
                >
                    <i class="fas fa-external-link-alt"></i>
                    <span>打开</span>
                </button>
            </div>
            <iframe 
                src="${pdfUrl}" 
                style="width: 100%; height: 100%; flex: 1; border: none; display: block;"
                title="PDF Preview"
            >
            </iframe>
        `;
        
    } catch (error) {
        console.error('PDF 预览失败:', error);
        // 降级方案
        previewContent.innerHTML = `
            <div class="preview-header">
                <i class="fas fa-file-pdf" style="color: #c0392b; font-size: 48px;"></i>
                <h3>${fileName}</h3>
            </div>
            <div class="preview-info" style="text-align: center; padding: 20px;">
                <p><i class="fas fa-info-circle"></i> 无法内嵌预览 PDF</p>
                ${fileInfo ? `<p style=\"margin: 10px 0;\"><i class=\"fas fa-hdd\"></i> 大小: ${formatBytes(fileInfo.size || 0)}</p>` : ''}
                <button 
                    class="preview-open-btn" 
                    onclick="window.__TAURI__.shell.open('${filePath.replace(/\\/g, '\\\\')}')"
                    style="margin: 20px auto; padding: 12px 24px; font-size: 16px; background: #c0392b; color: white; border: none; border-radius: 6px; cursor: pointer;"
                >
                    <i class="fas fa-external-link-alt"></i> 打开 PDF
                </button>
            </div>
        `;
    }
}

// ==================== 颜色标签功能 ====================

function applyColorTag(color) {
    if (selectedFiles.length === 0) {
        console.log('没有选中的文件');
        return;
    }
    
    selectedFiles.forEach(filePath => {
        if (color === 'none') {
            delete fileTags[filePath];
        } else {
            fileTags[filePath] = color;
        }
    });
    
    // 保存到 localStorage
    localStorage.setItem('fileTags', JSON.stringify(fileTags));
    
    // 重新渲染文件列表以显示新的标签
    if (currentPath) {
        navigateTo(currentPath);
    }
    
    console.log(`已为 ${selectedFiles.length} 个文件应用${color}标签`);
}

// ==================== 收藏夹 ====================

function loadFavorites() {
    const favoritesContainer = document.getElementById('favorites');
    if (!favoritesContainer) return;
    
    favoritesContainer.innerHTML = `
        <div class="sidebar-section-header" onclick="toggleSidebarSection('favorites')">
            <i class="fas fa-chevron-down sidebar-section-icon"></i>
            <span>收藏夹</span>
        </div>
        <div class="sidebar-section-content" id="favorites-content"></div>
    `;
    
    const favoritesContent = document.getElementById('favorites-content');
    
    favorites.forEach(favPath => {
        const favItem = document.createElement('div');
        favItem.className = 'sidebar-item favorite-item';
        favItem.innerHTML = `
            <i class="fas fa-star file-icon"></i>
            <span class="fav-label">${path.basename(favPath)}</span>
        `;
        favItem.addEventListener('click', () => navigateTo(favPath));
        favoritesContent.appendChild(favItem);
    });
}

function addToFavorites(filepath) {
    if (!favorites.includes(filepath)) {
        favorites.push(filepath);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        loadFavorites();
    }
}

function removeFromFavorites(filepath) {
    favorites = favorites.filter(f => f !== filepath);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
}

// ==================== 事件绑定 ====================

function bindEvents() {
    // 侧边栏选项卡切换
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // 初始化：显示默认激活的选项卡内容
    const activeButton = document.querySelector('.tab-button.active');
    if (activeButton) {
        const targetTab = activeButton.getAttribute('data-tab');
        const targetContent = document.getElementById(`${targetTab}-tab`);
        if (targetContent) {
            targetContent.style.display = 'block';
        }
    }
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // 移除所有活动状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.style.display = 'none');
            
            // 设置当前选项卡为活动状态
            button.classList.add('active');
            
            // 显示对应的内容
            const targetContent = document.getElementById(`${targetTab}-tab`);
            if (targetContent) {
                targetContent.style.display = 'block';
                
                // 如果是最近访问标签，刷新内容
                if (targetTab === 'recent') {
                    loadRecentAccess();
                }
            }
        });
    });
    
    // 导航按钮
    document.getElementById('back-btn')?.addEventListener('click', navigateBack);
    document.getElementById('forward-btn')?.addEventListener('click', navigateForward);
    document.getElementById('up-btn')?.addEventListener('click', navigateUp);
    
    // 排序按钮
    document.getElementById('sort-name')?.addEventListener('click', () => {
        sortBy = 'name';
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        if (currentPath) navigateTo(currentPath);
    });
    
    document.getElementById('sort-date')?.addEventListener('click', () => {
        sortBy = 'created';
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        if (currentPath) navigateTo(currentPath);
    });
    
    document.getElementById('sort-modified')?.addEventListener('click', () => {
        sortBy = 'modified';
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        if (currentPath) navigateTo(currentPath);
    });
    
    document.getElementById('sort-type')?.addEventListener('click', () => {
        sortBy = 'type';
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        if (currentPath) navigateTo(currentPath);
    });
    
    // 视图切换按钮
    document.getElementById('list-view-btn')?.addEventListener('click', () => {
        setView('list-view');
        if (currentPath) navigateTo(currentPath);
    });
    
    document.getElementById('icon-view-btn')?.addEventListener('click', () => {
        setView('icon-view');
        if (currentPath) navigateTo(currentPath);
    });
    
    document.getElementById('group-view-btn')?.addEventListener('click', () => {
        setView('group-view');
        if (currentPath) navigateTo(currentPath);
    });
    
    document.getElementById('timeline-view-btn')?.addEventListener('click', () => {
        setView('timeline-view');
        if (currentPath) navigateTo(currentPath);
    });
    
    // 颜色标签按钮
    const colorTagButtons = document.querySelectorAll('.color-tag-btn');
    colorTagButtons.forEach(button => {
        button.addEventListener('click', () => {
            const color = button.getAttribute('data-color');
            applyColorTag(color);
        });
    });
    
    // 设置图标点击切换菜单
    const settingsIcon = document.querySelector('#settings .fa-cog');
    const settingsMenu = document.getElementById('settings-menu');
    
    if (settingsIcon && settingsMenu) {
        settingsIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsMenu.classList.toggle('hidden');
        });
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', () => {
            settingsMenu.classList.add('hidden');
        });
        
        settingsMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('open-settings')?.addEventListener('click', openSettings);
    
    // 自定义项目点击事件
    const calendarBtn = document.getElementById('custom-calendar');
    const annualReportBtn = document.getElementById('custom-annual-report');
    
    if (calendarBtn) {
        calendarBtn.addEventListener('click', () => {
            console.log('日历按钮被点击');
            toggleCalendarView();
        });
    } else {
        console.warn('未找到日历按钮元素');
    }
    
    if (annualReportBtn) {
        annualReportBtn.addEventListener('click', () => {
            console.log('年报按钮被点击');
            showAnnualReport();
        });
    } else {
        console.warn('未找到年报按钮元素');
    }
    
    // 添加分组按钮
    document.getElementById('add-group-btn')?.addEventListener('click', () => {
        console.log('点击了添加分组');
        showAddGroupDialog();
    });
    
    // 文件列表容器双击事件 - 双击空白处返回上一级
    const fileListContainer = document.getElementById('file-list-container');
    const fileList = document.getElementById('file-list');
    
    if (fileListContainer) {
        // 单击文件时显示预览
        fileListContainer.addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                const filePath = fileItem.dataset.path;
                if (filePath) {
                    updatePreview(filePath);
                }
            }
        });
        
        // 在空白区域悬停一段时间后，恢复为当前文件夹的预览
        fileListContainer.addEventListener('mousemove', (e) => {
            const fileItem = e.target.closest('.file-item');

            // 如果在文件/文件夹上移动，则不触发空白预览，并清理定时器
            if (fileItem) {
                if (emptyHoverTimer) {
                    clearTimeout(emptyHoverTimer);
                    emptyHoverTimer = null;
                }
                return;
            }

            // 鼠标在容器空白区域移动，启动（或重置）空白预览定时器
            if (emptyHoverTimer) {
                clearTimeout(emptyHoverTimer);
                emptyHoverTimer = null;
            }
            emptyHoverTimer = setTimeout(() => {
                if (currentPath) {
                    updatePreview(currentPath);
                }
            }, HOVER_PREVIEW_DELAY);
        });

        fileListContainer.addEventListener('mouseleave', () => {
            if (emptyHoverTimer) {
                clearTimeout(emptyHoverTimer);
                emptyHoverTimer = null;
            }
        });
        
        fileListContainer.addEventListener('dblclick', (e) => {
            if (e.target === fileListContainer || e.target === fileList) {
                // 双击空白区域：执行后退操作，相当于返回上一次打开的文件夹
                navigateBack();
            }
        });
    }
    
    // 添加键盘快捷键
    document.addEventListener('keydown', async (e) => {
        // 如果当前焦点在可编辑元素上（如地址栏输入框、文本框），不拦截快捷键
        const target = e.target;
        const tag = target && target.tagName;
        const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
        if (isEditable) {
            return;
        }
        // 空格键 - 预览选中的文件
        if (e.key === ' ' || e.code === 'Space') {
            console.log('空格键被按下，选中文件数量:', selectedFiles.length);
            console.log('选中的文件:', selectedFiles);
            
            if (selectedFiles.length === 1 && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                e.preventDefault(); // 防止页面滚动
                const filePath = selectedFiles[0];
                console.log('尝试预览文件:', filePath);
                await updatePreview(filePath);
                return;
            }
        }
        
        // Ctrl+C - 复制
        if (e.ctrlKey && e.key === 'c' && selectedFiles.length > 0) {
            e.preventDefault();
            await copyFile(selectedFiles);
        }
        
        // Ctrl+X - 剪切
        if (e.ctrlKey && e.key === 'x' && selectedFiles.length > 0) {
            e.preventDefault();
            await cutFile(selectedFiles);
        }
        
        // Ctrl+V - 粘贴到当前目录（仅当不在输入框中时）
        if (e.ctrlKey && e.key === 'v' && currentPath) {
            e.preventDefault();
            await pasteFile(currentPath);
        }
        
        // Delete - 删除（TODO: 实现删除功能）
        if (e.key === 'Delete' && selectedFiles.length > 0) {
            e.preventDefault();
            console.log('Delete key pressed, selected files:', selectedFiles);
            // TODO: 实现删除确认和执行
        }
        
        // F5 - 刷新
        if (e.key === 'F5' && currentPath) {
            e.preventDefault();
            await navigateTo(currentPath);
        }
    });
    
    // 点击文档关闭右键菜单
    document.addEventListener('click', hideContextMenu);
    
    // 文件列表空白区域右键菜单
    if (fileListContainer) {
        fileListContainer.addEventListener('contextmenu', (e) => {
            if (e.target === fileListContainer || e.target === fileList) {
                e.preventDefault();
                showContextMenu(null, e.clientX, e.clientY);
            }
        });
    }
}

function setView(view) {
    currentView = view;
    const fileListContainer = document.getElementById('file-list-container');
    if (fileListContainer) {
        fileListContainer.className = view;
    }
    localStorage.setItem('currentView', view);
    
    // 更新视图按钮的激活状态
    const viewButtons = document.querySelectorAll('#view-options button');
    viewButtons.forEach(btn => {
        const btnView = btn.getAttribute('data-view');
        if (btnView === view) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function toggleTheme() {
    console.log('切换主题按钮被点击');
    document.body.classList.toggle('dark-theme');
    const isDarkTheme = document.body.classList.contains('dark-theme');
    const newTheme = isDarkTheme ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    console.log('当前主题：', newTheme);
}

async function openSettings() {
    try {
        // 使用 Tauri 创建新窗口
        const { WebviewWindow } = window.__TAURI__.window;
        const settingsWindow = new WebviewWindow('settings', {
            url: 'settings.html',
            title: '设置',
            width: 800,
            height: 600,
            center: true,
            resizable: true
        });
        
        settingsWindow.once('tauri://created', () => {
            console.log('设置窗口已创建');
        });
        
        settingsWindow.once('tauri://error', (e) => {
            console.error('创建设置窗口失败:', e);
            // 降级方案：在浏览器新标签页中打开
            window.open('settings.html', '_blank');
        });
    } catch (error) {
        console.error('打开设置失败:', error);
        // 降级方案：在浏览器新标签页中打开
        window.open('settings.html', '_blank');
    }
}

/**
 * 显示右键菜单
 * @param {Object} file - 文件对象
 * @param {number} x - 鼠标 X 坐标
 * @param {number} y - 鼠标 Y 坐标
 */
async function showContextMenu(file, x, y) {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu) return;

    // 清空旧菜单项
    contextMenu.innerHTML = '';

    // 获取文件路径
    const filePath = file ? await invoke('join_path', { base: currentPath, path: file.name }) : currentPath;
    const isDirectory = file ? file.is_directory : true;
    const isFavorite = favorites.includes(filePath);

    // 定义菜单项
    let menuItems = [];

    if (file) {
        // 文件/文件夹菜单
        menuItems = [
            { label: '打开', action: () => openFile(file) },
            { label: '在资源管理器中打开', action: () => openInExplorer(filePath) },
            { type: 'separator' },
            { label: isFavorite ? '取消收藏' : '添加到收藏夹', action: () => toggleFavorite(filePath) },
            { type: 'separator' },
            { label: '复制', action: () => copyFile(file), shortcut: 'Ctrl+C' },
            { label: '剪切', action: () => cutFile(file), shortcut: 'Ctrl+X' },
            { label: '删除', action: () => deleteFile(file), shortcut: 'Del' },
            { type: 'separator' },
            { label: '重命名', action: () => renameFilePrompt(file) },
        ];
    } else {
        // 空白区域菜单
        menuItems = [
            { label: '新建文件夹', action: () => showCreateFolderDialog() },
            { label: '粘贴', action: () => pasteFile(), shortcut: 'Ctrl+V', disabled: !localStorage.getItem('clipboard') },
            { type: 'separator' },
            { label: isFavorite ? '取消收藏' : '添加到收藏夹', action: () => toggleFavorite(currentPath) },
            { type: 'separator' },
            { label: '刷新', action: () => loadDirectory(currentPath), shortcut: 'F5' },
        ];
    }

    // 创建菜单项
    menuItems.forEach(item => {
        if (item.type === 'separator') {
            const separator = document.createElement('div');
            separator.className = 'context-menu-separator';
            contextMenu.appendChild(separator);
        } else {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            if (item.disabled) {
                menuItem.classList.add('disabled');
            }

            const labelSpan = document.createElement('span');
            labelSpan.textContent = item.label;
            menuItem.appendChild(labelSpan);

            if (item.shortcut) {
                const shortcutSpan = document.createElement('span');
                shortcutSpan.className = 'context-menu-shortcut';
                shortcutSpan.textContent = item.shortcut;
                menuItem.appendChild(shortcutSpan);
            }

            if (!item.disabled) {
                menuItem.addEventListener('click', () => {
                    item.action();
                    hideContextMenu();
                });
            }

            contextMenu.appendChild(menuItem);
        }
    });

    // 显示菜单
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;

    // 确保菜单不超出屏幕
    setTimeout(() => {
        const rect = contextMenu.getBoundingClientRect();
        
        // 检查右边界
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = `${x - rect.width}px`;
        }
        
        // 检查底部边界
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = `${y - rect.height}px`;
        }
        
        // 确保不会超出左边界和顶部边界
        const finalRect = contextMenu.getBoundingClientRect();
        if (finalRect.left < 0) {
            contextMenu.style.left = '10px';
        }
        if (finalRect.top < 0) {
            contextMenu.style.top = '10px';
        }
    }, 0);
}

/**
 * 隐藏右键菜单
 */
function hideContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

/**
 * 切换收藏夹状态
 */
function toggleFavorite(path) {
    const index = favorites.indexOf(path);
    if (index > -1) {
        removeFromFavorites(path);
    } else {
        addToFavorites(path);
    }
}

/**
 * 在资源管理器中打开
 */
async function openInExplorer(path) {
    try {
        // 使用 Tauri 的 shell 命令打开资源管理器
        await invoke('open_in_explorer', { path });
    } catch (error) {
        console.error('打开资源管理器失败:', error);
    }
}

/**
 * 重命名文件提示框
 */
async function renameFilePrompt(file) {
    const newName = prompt('请输入新文件名:', file.name);
    if (newName && newName.trim() && newName !== file.name) {
        try {
            const oldPath = await invoke('join_path', { base: currentPath, path: file.name });
            const newPath = await invoke('join_path', { base: currentPath, path: newName.trim() });
            await invoke('rename_file', { oldPath, newPath });
            await loadDirectory(currentPath);
        } catch (error) {
            console.error('重命名失败:', error);
            alert(`重命名失败: ${error}`);
        }
    }
}

/**
 * 删除文件
 */
async function deleteFile(file) {
    const confirmed = confirm(`确定要删除 "${file.name}" 吗?`);
    if (!confirmed) return;

    try {
        const filePath = await invoke('join_path', { base: currentPath, path: file.name });
        if (file.is_directory) {
            await invoke('remove_directory', { path: filePath });
        } else {
            await invoke('remove_file', { path: filePath });
        }
        await loadDirectory(currentPath);
    } catch (error) {
        console.error('删除失败:', error);
        alert(`删除失败: ${error}`);
    }
}

// ==================== 分组管理 ====================

function loadFolderGroups() {
    const groupsList = document.getElementById('folder-groups-list');
    if (!groupsList) return;
    
    groupsList.innerHTML = '';
    
    Object.keys(folderGroups).forEach(groupName => {
        const groupDiv = createGroupElement(groupName, folderGroups[groupName]);
        groupsList.appendChild(groupDiv);
    });
}

function createGroupElement(groupName, folders) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'folder-group';
    groupDiv.innerHTML = `
        <div class="folder-group-header">
            <span class="group-name">${groupName}</span>
            <button class="delete-group-btn" data-group="${groupName}" title="删除分组">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="folder-group-items">
            ${folders.map(folder => `
                <div class="folder-group-item" data-path="${folder}">
                    <i class="fas fa-folder"></i>
                    <span>${path.basename(folder)}</span>
                </div>
            `).join('')}
        </div>
    `;
    
    // 点击分组中的文件夹
    groupDiv.querySelectorAll('.folder-group-item').forEach(item => {
        item.addEventListener('click', () => {
            const folderPath = item.dataset.path;
            navigateTo(folderPath);
        });
    });
    
    // 删除分组
    groupDiv.querySelector('.delete-group-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`确定要删除分组"${groupName}"吗？`)) {
            delete folderGroups[groupName];
            localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
            loadFolderGroups();
        }
    });
    
    return groupDiv;
}

function showAddGroupDialog() {
    const groupName = prompt('请输入分组名称:');
    if (groupName && groupName.trim()) {
        createGroup(groupName.trim());
    }
}

/**
 * 创建新分组
 * @param {string} groupName - 分组名称
 */
function createGroup(groupName) {
    console.log('创建新分组:', groupName);
    
    // 检查分组是否已存在
    if (folderGroups[groupName]) {
        alert('该分组名称已存在！');
        return;
    }
    
    // 初始化分组数据结构（如果需要）
    const groupCollapseStates = JSON.parse(localStorage.getItem('groupCollapseStates') || '{}');
    const groupColors = JSON.parse(localStorage.getItem('groupColors') || '{}');
    const groupOrder = JSON.parse(localStorage.getItem('groupOrder') || '[]');
    const folderOrder = JSON.parse(localStorage.getItem('folderOrder') || '{}');
    
    // 创建新分组
    folderGroups[groupName] = [];
    folderOrder[groupName] = [];
    groupCollapseStates[groupName] = false;
    groupColors[groupName] = '#2c2c2c';
    groupOrder.push(groupName);
    
    // 保存所有数据到 localStorage
    try {
        localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
        localStorage.setItem('folderOrder', JSON.stringify(folderOrder));
        localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
        localStorage.setItem('groupColors', JSON.stringify(groupColors));
        localStorage.setItem('groupOrder', JSON.stringify(groupOrder));
        
        console.log('分组数据保存成功');
        
        // 更新视图
        loadFolderGroups();
        
        alert(`分组"${groupName}"已创建！\n\n提示：您可以通过右键菜单将文件夹添加到此分组。`);
    } catch (error) {
        console.error('保存分组数据失败:', error);
        alert('创建分组失败！');
    }
}

/**
 * 更新文件夹分组显示
 */
function updateFolderGroups() {
    loadFolderGroups(); // 重新加载分组显示
}

/**
 * 添加文件夹到分组
 * @param {string} groupName - 分组名称
 * @param {string|Object} folder - 文件夹路径或对象
 */
function addToGroup(groupName, folder) {
    if (!folderGroups[groupName]) {
        console.error('分组不存在:', groupName);
        return;
    }
    
    const folderPath = typeof folder === 'string' ? folder : folder.path;
    const folderName = path.basename(folderPath);
    
    // 检查是否已存在
    const exists = folderGroups[groupName].some(f => 
        (typeof f === 'string' ? f : f.path) === folderPath
    );
    
    if (exists) {
        alert('该文件夹已在分组中！');
        return;
    }
    
    // 添加文件夹
    folderGroups[groupName].push({
        name: folderName,
        path: folderPath
    });
    
    // 保存到 localStorage
    localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
    
    // 更新显示
    loadFolderGroups();
    
    console.log(`已添加 ${folderName} 到分组 ${groupName}`);
}

/**
 * 从分组中移除文件夹
 * @param {string} groupName - 分组名称
 * @param {string} folderPath - 文件夹路径
 */
function removeFromGroup(groupName, folderPath) {
    if (!folderGroups[groupName]) {
        console.error('分组不存在:', groupName);
        return;
    }
    
    // 过滤掉要移除的文件夹
    folderGroups[groupName] = folderGroups[groupName].filter(f => 
        (typeof f === 'string' ? f : f.path) !== folderPath
    );
    
    // 保存到 localStorage
    localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
    
    // 更新显示
    loadFolderGroups();
    
    console.log(`已从分组 ${groupName} 移除文件夹`);
}

/**
 * 删除分组
 * @param {string} groupName - 分组名称
 */
async function deleteGroup(groupName) {
    const result = await confirm(
        `确定要删除分组"${groupName}"吗？\n\n分组内的文件夹不会被删除。`,
        { title: '删除分组', type: 'warning' }
    );
    
    if (!result) return;
    
    // 删除分组
    delete folderGroups[groupName];
    
    // 同时删除相关数据
    const groupCollapseStates = JSON.parse(localStorage.getItem('groupCollapseStates') || '{}');
    const groupColors = JSON.parse(localStorage.getItem('groupColors') || '{}');
    const groupOrder = JSON.parse(localStorage.getItem('groupOrder') || '[]');
    const folderOrder = JSON.parse(localStorage.getItem('folderOrder') || '{}');
    
    delete groupCollapseStates[groupName];
    delete groupColors[groupName];
    delete folderOrder[groupName];
    
    const orderIndex = groupOrder.indexOf(groupName);
    if (orderIndex > -1) {
        groupOrder.splice(orderIndex, 1);
    }
    
    // 保存所有更改
    localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
    localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
    localStorage.setItem('groupColors', JSON.stringify(groupColors));
    localStorage.setItem('groupOrder', JSON.stringify(groupOrder));
    localStorage.setItem('folderOrder', JSON.stringify(folderOrder));
    
    // 更新显示
    loadFolderGroups();
    
    console.log(`已删除分组 ${groupName}`);
}

/**
 * 重命名分组
 * @param {string} oldName - 旧名称
 * @param {string} newName - 新名称
 */
function renameGroup(oldName, newName) {
    if (!folderGroups[oldName]) {
        console.error('分组不存在:', oldName);
        return;
    }
    
    if (folderGroups[newName]) {
        alert('新名称已存在！');
        return;
    }
    
    // 复制数据到新名称
    folderGroups[newName] = folderGroups[oldName];
    delete folderGroups[oldName];
    
    // 更新相关数据
    const groupCollapseStates = JSON.parse(localStorage.getItem('groupCollapseStates') || '{}');
    const groupColors = JSON.parse(localStorage.getItem('groupColors') || '{}');
    const groupOrder = JSON.parse(localStorage.getItem('groupOrder') || '[]');
    const folderOrder = JSON.parse(localStorage.getItem('folderOrder') || '{}');
    
    if (groupCollapseStates[oldName] !== undefined) {
        groupCollapseStates[newName] = groupCollapseStates[oldName];
        delete groupCollapseStates[oldName];
    }
    
    if (groupColors[oldName]) {
        groupColors[newName] = groupColors[oldName];
        delete groupColors[oldName];
    }
    
    if (folderOrder[oldName]) {
        folderOrder[newName] = folderOrder[oldName];
        delete folderOrder[oldName];
    }
    
    const orderIndex = groupOrder.indexOf(oldName);
    if (orderIndex > -1) {
        groupOrder[orderIndex] = newName;
    }
    
    // 保存所有更改
    localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
    localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
    localStorage.setItem('groupColors', JSON.stringify(groupColors));
    localStorage.setItem('groupOrder', JSON.stringify(groupOrder));
    localStorage.setItem('folderOrder', JSON.stringify(folderOrder));
    
    // 更新显示
    loadFolderGroups();
    
    console.log(`已将分组 ${oldName} 重命名为 ${newName}`);
}

/**
 * 显示分组右键菜单
 * @param {Event} e - 事件对象
 * @param {string} groupName - 分组名称
 */
async function showGroupContextMenu(e, groupName) {
    e.preventDefault();
    
    // 简化版右键菜单，使用 confirm/prompt
    const action = prompt(
        `分组: ${groupName}\n\n` +
        `输入操作:\n` +
        `1 - 重命名\n` +
        `2 - 删除\n` +
        `3 - 取消`,
        '3'
    );
    
    if (action === '1') {
        const newName = prompt('请输入新名称:', groupName);
        if (newName && newName.trim() && newName !== groupName) {
            renameGroup(groupName, newName.trim());
        }
    } else if (action === '2') {
        await deleteGroup(groupName);
    }
}

/**
 * 显示分组文件夹右键菜单
 * @param {Event} e - 事件对象
 * @param {string} groupName - 分组名称
 * @param {string} folderPath - 文件夹路径
 */
async function showGroupFolderContextMenu(e, groupName, folderPath) {
    e.preventDefault();
    
    const result = await confirm(
        `是否从分组"${groupName}"中移除？\n\n${path.basename(folderPath)}`,
        { title: '移除文件夹', type: 'warning' }
    );
    
    if (result) {
        removeFromGroup(groupName, folderPath);
    }
}

// ==================== 日历视图 ====================

function toggleCalendarView() {
    const now = new Date();
    currentCalendarYear = now.getFullYear();
    currentCalendarMonth = now.getMonth();
    showCalendarView();
}

async function showCalendarView() {
    const now = new Date();
    currentCalendarYear = currentCalendarYear || now.getFullYear();
    currentCalendarMonth = currentCalendarMonth !== undefined ? currentCalendarMonth : now.getMonth();
    
    // 从设置中获取当前年份的项目路径
    const projectPaths = JSON.parse(localStorage.getItem('projectPaths') || '{}');
    const yearPath = projectPaths[currentCalendarYear.toString()];
    
    if (!yearPath) {
        await message(`未设置 ${currentCalendarYear} 年的项目文件夹。\n请在设置中配置项目文件夹路径。`, { title: '提示', type: 'info' });
        return;
    }
    
    const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    const weekDays = ["一", "二", "三", "四", "五", "六", "日"];
    
    const fileListContainer = document.getElementById('file-list-container');
    const fileList = document.getElementById('file-list');
    fileListContainer.className = 'calendar-view';
    
    let calendarHTML = `
        <div class="calendar-view-container">
            <div class="calendar-controls" id="calendar-controls">
                <button id="prev-month">&lt;</button>
                <h2>${currentCalendarYear}年 ${monthNames[currentCalendarMonth]}</h2>
                <button id="next-month">&gt;</button>
                <button id="today-button">今天</button>
            </div>
            <div class="calendar-grid">
    `;
    
    // 添加星期头部
    weekDays.forEach(day => {
        calendarHTML += `<div class="calendar-header">${day}</div>`;
    });
    
    const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
    
    // 调整第一天的位置
    let startDay = firstDayOfMonth - 1;
    if (startDay === -1) startDay = 6;
    
    // 添加空白天数
    for (let i = 0; i < startDay; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
    }
    
    // 获取当前月份的文件夹路径
    const monthFolderPath = path.join(yearPath, `${currentCalendarMonth + 1}月`);
    
    // 获取当月所有项目文件夹
    let monthFolders = [];
    try {
        const monthExists = await invoke('path_exists', { path: monthFolderPath });
        if (monthExists) {
            const files = await invoke('read_directory', { path: monthFolderPath });
            
            monthFolders = files.map(file => {
                // 尝试从文件夹名称获取日期
                const dateMatch = file.name.match(/^(\d{4})/);
                let day;
                
                if (dateMatch && !isNaN(parseInt(dateMatch[1]))) {
                    // 如果文件夹名称符合格式，使用名称中的日期
                    day = parseInt(dateMatch[1].substring(2));
                } else {
                    // 如果不符合格式，使用创建时间
                    if (file.created) {
                        const createDate = new Date(file.created * 1000);
                        // 只有当创建时间在当前月份时才使用
                        if (createDate.getMonth() === currentCalendarMonth && 
                            createDate.getFullYear() === currentCalendarYear) {
                            day = createDate.getDate();
                        }
                    }
                }
                
                return {
                    name: file.name,
                    day: day,
                    path: file.path,
                    created: file.created
                };
            }).filter(folder => folder.day !== undefined);
            
            // 按创建时间排序
            monthFolders.sort((a, b) => a.created - b.created);
        }
    } catch (err) {
        console.error('读取月份文件夹错误:', err);
        monthFolders = [];
    }
    
    // 生成日历天数
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentCalendarYear, currentCalendarMonth, day);
        const isToday = date.toDateString() === today.toDateString();
        
        // 查找当天的项目文件夹
        const dayFolders = monthFolders.filter(folder => folder.day === day);
        const hasFolders = dayFolders.length > 0;
        
        calendarHTML += `
            <div class="calendar-day${isToday ? ' today' : ''}${hasFolders ? ' has-content' : ''}" data-date="${day}">
                <span class="day-number">${day}</span>
                <div class="day-content">
                    ${dayFolders.map(folder => {
                        const folderIcon = getFileIcon(folder.name, true);
                        return `
                            <div class="folder-item" data-path="${folder.path}" title="${folder.name}">
                                <span class="folder-icon">${folderIcon}</span>
                                <span class="folder-name">${folder.name.match(/^(\d{4})/) ? folder.name.substring(5) : folder.name}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="add-folder-icon" title="添加新文件夹">
                    <i class="fas fa-plus"></i>
                </div>
            </div>
        `;
    }
    
    calendarHTML += '</div></div>';
    fileList.innerHTML = calendarHTML;
    
    // 添加事件监听器
    document.getElementById('prev-month')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month')?.addEventListener('click', () => changeMonth(1));
    document.getElementById('today-button')?.addEventListener('click', goToToday);
    
    // 添加日历控件的滚轮事件监听
    const calendarControls = document.getElementById('calendar-controls');
    if (calendarControls) {
        calendarControls.addEventListener('wheel', handleCalendarScroll);
    }
    
    // 为文件夹添加双击和悬停预览事件
    document.querySelectorAll('.folder-item').forEach(item => {
        item.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const folderPath = item.getAttribute('data-path');
            if (folderPath) {
                isFromCalendar = true; // 设置标记，表示从日历跳转
                navigateTo(folderPath);
            }
        });

        // 悬停一定时间后在右侧预览区预览该文件夹
        item.addEventListener('mouseenter', () => {
            if (calendarHoverTimer) {
                clearTimeout(calendarHoverTimer);
                calendarHoverTimer = null;
            }
            const folderPath = item.getAttribute('data-path');
            if (!folderPath) return;
            calendarHoverTimer = setTimeout(() => {
                updatePreview(folderPath);
            }, HOVER_PREVIEW_DELAY);
        });

        item.addEventListener('mouseleave', () => {
            if (calendarHoverTimer) {
                clearTimeout(calendarHoverTimer);
                calendarHoverTimer = null;
            }
        });
    });
    
    // 为加号图标添加点击事件
    document.querySelectorAll('.add-folder-icon').forEach(icon => {
        icon.addEventListener('click', async (e) => {
            e.stopPropagation();
            const dayElement = icon.closest('.calendar-day');
            const day = parseInt(dayElement.getAttribute('data-date'));
            await showCreateFolderDialog(currentCalendarYear, currentCalendarMonth + 1, day);
        });
    });
}

function changeMonth(delta) {
    currentCalendarMonth += delta;
    
    if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear++;
    } else if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear--;
    }
    
    showCalendarView();
}

function goToToday() {
    const now = new Date();
    currentCalendarYear = now.getFullYear();
    currentCalendarMonth = now.getMonth();
    showCalendarView();
}

// 处理日历滚轮事件
function handleCalendarScroll(e) {
    e.preventDefault(); // 防止页面滚动
    const delta = e.deltaY < 0 ? -1 : 1;
    
    // 添加视觉反馈
    const calendarGrid = document.querySelector('.calendar-grid');
    if (calendarGrid) {
        calendarGrid.classList.add('switching');
        setTimeout(() => {
            calendarGrid.classList.remove('switching');
        }, 300);
    }
    
    changeMonth(delta);
}

async function showCreateFolderDialog(year, month, day) {
    const projectPaths = JSON.parse(localStorage.getItem('projectPaths') || '{}');
    const yearPath = projectPaths[year.toString()];
    
    if (!yearPath) {
        await message('未设置项目路径', { title: '错误', type: 'error' });
        return;
    }
    
    const folderName = prompt(`请输入 ${year}年${month}月${day}日 的文件夹名称:`);
    if (!folderName || !folderName.trim()) return;
    
    try {
        const monthPath = path.join(yearPath, `${month}月`);
        
        // 确保月份文件夹存在
        const monthExists = await invoke('path_exists', { path: monthPath });
        if (!monthExists) {
            await invoke('create_directory', { path: monthPath });
        }
        
        // 格式化日期为 MMDD
        const datePrefix = `${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
        const fullFolderName = `${datePrefix}-${folderName.trim()}`;
        const newFolderPath = path.join(monthPath, fullFolderName);
        
        await invoke('create_directory', { path: newFolderPath });
        await message('文件夹创建成功！', { title: '成功', type: 'info' });
        showCalendarView();
    } catch (err) {
        console.error('创建文件夹失败:', err);
        await message('创建文件夹失败: ' + err, { title: '错误', type: 'error' });
    }
}

// ==================== 年报视图 ====================

async function showAnnualReport() {
    const projectPaths = JSON.parse(localStorage.getItem('projectPaths') || '{}');
    let yearPath = projectPaths[currentReportYear.toString()];
    
    // 如果当前年份没有文件夹，则提示
    if (!yearPath) {
        await message(`未找到 ${currentReportYear} 年的项目路径。\n请在设置中配置项目文件夹路径。`, { title: '提示', type: 'info' });
        return;
    }
    
    const fileListContainer = document.getElementById('file-list-container');
    const fileList = document.getElementById('file-list');
    fileListContainer.className = 'annual-report-view';
    
    // 创建年报视图
    const annualReportHTML = `
        <div class="annual-report-container">
            <div class="annual-report-controls">
                <button id="prev-year">&lt;</button>
                <h2>${currentReportYear}</h2>
                <button id="next-year">&gt;</button>
            </div>
            <div class="annual-timeline">
                ${generateMonthsTimeline()}
            </div>
            <div class="project-preview">
                <div class="preview-header">
                    <div class="preview-title">选择项目以查看内容</div>
                    <div class="preview-controls">
                        <button id="preview-refresh" title="刷新"><i class="fas fa-sync-alt"></i></button>
                        <button id="preview-open" title="在文件夹中打开"><i class="fas fa-external-link-alt"></i></button>
                    </div>
                </div>
                <div class="preview-content"></div>
            </div>
        </div>
    `;
    
    fileList.innerHTML = annualReportHTML;
    
    // 添加控制按钮事件监听
    document.getElementById('prev-year')?.addEventListener('click', () => {
        changeReportYear(-1);
    });
    document.getElementById('next-year')?.addEventListener('click', () => {
        changeReportYear(1);
    });
    
    // 加载年度数据
    await loadAnnualData(yearPath);
    
    // 添加滚轮事件监听
    const timeline = document.querySelector('.annual-timeline');
    if (timeline) {
        let isMouseDown = false;
        let lastX = 0;
        
        timeline.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            timeline.style.cursor = 'grabbing';
            lastX = e.pageX;
        });
        
        timeline.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            e.preventDefault();
            
            const deltaX = e.pageX - lastX;
            timeline.scrollLeft -= deltaX;
            lastX = e.pageX;
        });
        
        timeline.addEventListener('mouseup', () => {
            isMouseDown = false;
            timeline.style.cursor = 'grab';
        });
        
        timeline.addEventListener('mouseleave', () => {
            isMouseDown = false;
            timeline.style.cursor = 'grab';
        });
        
        timeline.addEventListener('wheel', (e) => {
            if (!e.ctrlKey && !e.target.closest('.month-content')) {
                e.preventDefault();
                timeline.scrollLeft += e.deltaY;
            }
        }, { passive: false });
        
        timeline.style.cursor = 'grab';
    }
}

function generateMonthsTimeline() {
    const months = ["一月", "二月", "三月", "四月", "五月", "六月", 
                   "七月", "八月", "九月", "十月", "十一月", "十二月"];
    
    return `
        <div class="timeline-container">
            <div class="timeline-line"></div>
            <div class="months-container">
                ${months.map((month, index) => `
                    <div class="month-column" data-month="${index + 1}">
                        <div class="month-marker">
                            <div class="month-dot"></div>
                            <div class="month-header">${month}</div>
                        </div>
                        <div class="month-content" id="month-${index + 1}">
                            <div class="month-projects"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function loadAnnualData(yearPath) {
    console.log('开始加载年度数据:', yearPath);
    
    for (let month = 1; month <= 12; month++) {
        const monthPath = path.join(yearPath, `${month}月`);
        console.log('检查月份路径:', monthPath);
        
        try {
            const monthExists = await invoke('path_exists', { path: monthPath });
            if (monthExists) {
                console.log(`读取 ${month} 月数据`);
                const files = await invoke('read_directory', { path: monthPath });
                const monthProjects = document.querySelector(`#month-${month} .month-projects`);
                
                if (!monthProjects) {
                    console.error(`未找到月份容器: month-${month}`);
                    continue;
                }
                
                const projectItems = await Promise.all(files.map(async file => {
                    const filePath = file.path;
                    
                    // 获取文件夹内最新修改时间
                    let lastModified = file.modified || file.created;
                    try {
                        const subFiles = await invoke('read_directory', { path: filePath });
                        for (const subFile of subFiles) {
                            if (subFile.name.toLowerCase() !== 'thumbs.db' && subFile.modified) {
                                if (subFile.modified > lastModified) {
                                    lastModified = subFile.modified;
                                }
                            }
                        }
                    } catch (err) {
                        console.warn(`读取子文件夹失败: ${filePath}`, err);
                    }
                    
                    const createdDate = file.created ? new Date(file.created * 1000) : new Date();
                    const modifiedDate = file.modified ? new Date(file.modified * 1000) : new Date();
                    const lastModifiedDate = new Date(lastModified * 1000);
                    
                    const folderIcon = getFileIcon(file.name, true);
                    
                    return `
                        <div class="project-item" data-path="${filePath}">
                            <span class="project-icon">${folderIcon}</span>
                            <div class="project-info">
                                <span class="project-name">${file.name}</span>
                                <div class="project-dates">
                                    <span class="create-date">创建: ${createdDate.toLocaleDateString()}</span>
                                    <span class="modify-date">修改: ${modifiedDate.toLocaleDateString()}</span>
                                </div>
                                <div class="last-modified-date" style="display: none;">
                                    最后更新: ${lastModifiedDate.toLocaleDateString()} ${lastModifiedDate.toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    `;
                }));
                
                monthProjects.innerHTML = projectItems.join('');
                
                // 为每个项目添加鼠标事件
                monthProjects.querySelectorAll('.project-item').forEach(item => {
                    const filePath = item.getAttribute('data-path');
                    
                    // 双击事件 - 在系统资源管理器中打开该项目文件夹
                    item.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        if (filePath) {
                            shellOpen(filePath);
                        }
                    });

                    // 右键菜单 - 使用与主文件列表一致的上下文菜单
                    item.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        if (!filePath) return;
                        const fileObj = {
                            path: filePath,
                            name: path.basename(filePath),
                            is_directory: true
                        };
                        showContextMenu(fileObj, e.clientX, e.clientY);
                    });
                    
                    // 单击事件 - 显示预览并设置为活动项目
                    item.addEventListener('click', () => {
                        document.querySelectorAll('.project-item.active').forEach(p => {
                            p.classList.remove('active');
                        });
                        
                        item.classList.add('active');
                        updateProjectPreview(filePath);
                    });

                    // 悬停一定时间后，自动更新底部预览
                    item.addEventListener('mouseenter', () => {
                        if (annualHoverTimer) {
                            clearTimeout(annualHoverTimer);
                            annualHoverTimer = null;
                        }
                        if (!filePath) return;
                        annualHoverTimer = setTimeout(() => {
                            updateProjectPreview(filePath);
                        }, HOVER_PREVIEW_DELAY);
                    });

                    item.addEventListener('mouseleave', () => {
                        if (annualHoverTimer) {
                            clearTimeout(annualHoverTimer);
                            annualHoverTimer = null;
                        }
                    });
                });
            } else {
                console.log(`${month} 月份文件夹不存在`);
            }
        } catch (err) {
            console.error(`读取 ${month} 月数据时出错:`, err);
        }
    }
}

async function updateProjectPreview(projectPath) {
    if (!projectPath) return;
    
    const previewHeader = document.querySelector('.preview-header .preview-title');
    const previewContent = document.querySelector('.preview-content');
    const projectName = path.basename(projectPath);
    
    if (previewHeader) {
        previewHeader.textContent = projectName;
    }
    
    if (!previewContent) return;
    
    try {
        const files = await invoke('read_directory', { path: projectPath });
        
        // 过滤掉 Thumbs.db 等系统文件
        const filteredFiles = files.filter(file => 
            file.name.toLowerCase() !== 'thumbs.db'
        );
        
        previewContent.innerHTML = filteredFiles.map(file => {
            const icon = getFileIcon(file.name, file.is_directory);
            
            return `
                <div class="preview-file-item" data-path="${file.path}">
                    <span class="preview-file-icon">${icon}</span>
                    <span class="preview-file-name">${file.name}</span>
                </div>
            `;
        }).join('');
        
        // 为预览文件添加双击事件
        previewContent.querySelectorAll('.preview-file-item').forEach(item => {
            const filePath = item.getAttribute('data-path');
            item.addEventListener('dblclick', () => {
                shellOpen(filePath);
            });
        });
        
    } catch (err) {
        console.error('更新预览失败:', err);
        if (previewContent) {
            previewContent.innerHTML = '<div class="preview-error">无法加载预览</div>';
        }
    }
}

function changeReportYear(delta) {
    currentReportYear += delta;
    console.log('切换到年份:', currentReportYear);
    showAnnualReport();
}

// ==================== 辅助工具函数 ====================

/**
 * 格式化日期
 * @param {Date|number} date - 日期对象或时间戳
 * @param {string} format - 格式类型: 'long', 'short', 'numeric'
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date, format = 'long') {
    try {
        if (!date) return '-';
        
        const d = date instanceof Date ? date : new Date(typeof date === 'number' && date < 10000000000 ? date * 1000 : date);
        
        if (isNaN(d.getTime())) return '-';
        
        if (format === 'long') {
            return d.toLocaleDateString('zh-CN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        } else if (format === 'short') {
            return d.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } else {
            return d.toLocaleDateString('zh-CN');
        }
    } catch (error) {
        console.error('formatDate error:', error);
        return '-';
    }
}

/**
 * 格式化时间
 * @param {Date|number} date - 日期对象或时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(date) {
    try {
        if (!date) return '-';
        
        const d = date instanceof Date ? date : new Date(typeof date === 'number' && date < 10000000000 ? date * 1000 : date);
        
        if (isNaN(d.getTime())) return '-';
        
        return d.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } catch (error) {
        console.error('formatTime error:', error);
        return '-';
    }
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 获取当前视图的 data-view 属性
 * @returns {string} 当前视图类型
 */
function getCurrentViewDataAttribute() {
    const viewButtons = document.querySelectorAll('[data-view]');
    for (const button of viewButtons) {
        if (button.classList.contains('active')) {
            return button.getAttribute('data-view');
        }
    }
    return 'icon-view'; // 默认返回图标视图
}

/**
 * 获取文件详情
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} 文件详情对象
 */
async function getFileDetails(filePath) {
    try {
        const normalized = normalizePath(filePath);
        const files = await invoke('read_directory', { path: path.dirname(normalized) });
        const fileName = path.basename(normalized);
        const file = files.find(f => f.name === fileName);
        
        if (!file) {
            throw new Error('File not found');
        }
        
        return {
            name: file.name,
            path: file.path,
            isDirectory: file.is_directory,
            size: file.size,
            created: file.created,
            modified: file.modified
        };
    } catch (error) {
        console.error('getFileDetails error:', error);
        return null;
    }
}

/**
 * 按类型分组文件
 * @param {Array} files - 文件数组
 * @returns {Object} 分组后的文件对象
 */
function groupFilesByType(files) {
    const groups = {};
    
    files.forEach(file => {
        const ext = file.is_directory 
            ? '文件夹' 
            : (path.extname(file.name).toLowerCase().replace(/^\./, '') || '无扩展名');
        
        if (!groups[ext]) {
            groups[ext] = [];
        }
        groups[ext].push(file);
    });
    
    return groups;
}

// ==================== 文件操作 ====================

/**
 * 复制文件到剪贴板
 * @param {string|Array<string>} filePaths - 文件路径（字符串或数组）
 */
async function copyFile(filePaths) {
    try {
        // 确保是数组格式
        if (typeof filePaths === 'string') {
            filePaths = [filePaths];
        }
        
        // 将文件路径保存到 localStorage（因为 Tauri 的剪贴板 API 只支持文本）
        clipboardFiles = filePaths;
        clipboardOperation = 'copy';
        localStorage.setItem('clipboardFiles', JSON.stringify(filePaths));
        localStorage.setItem('clipboardOperation', 'copy');
        
        console.log('已复制文件:', filePaths);
        
        // 也复制路径文本到系统剪贴板
        await writeText(filePaths.join('\n'));
        
        // 可以显示提示
        // await message(`已复制 ${filePaths.length} 个项目`, { title: '复制', type: 'info' });
        
    } catch (error) {
        console.error('copyFile error:', error);
        await message('复制失败: ' + error, { title: '错误', type: 'error' });
    }
}

/**
 * 剪切文件到剪贴板
 * @param {string|Array<string>} filePaths - 文件路径（字符串或数组）
 */
async function cutFile(filePaths) {
    try {
        if (typeof filePaths === 'string') {
            filePaths = [filePaths];
        }
        
        clipboardFiles = filePaths;
        clipboardOperation = 'cut';
        localStorage.setItem('clipboardFiles', JSON.stringify(filePaths));
        localStorage.setItem('clipboardOperation', 'cut');
        
        console.log('已剪切文件:', filePaths);
        await writeText(filePaths.join('\n'));
        
    } catch (error) {
        console.error('cutFile error:', error);
        await message('剪切失败: ' + error, { title: '错误', type: 'error' });
    }
}

/**
 * 粘贴文件到目标目录
 * @param {string} targetDir - 目标目录
 */
async function pasteFile(targetDir) {
    try {
        // 从 localStorage 读取剪贴板内容
        const savedFiles = localStorage.getItem('clipboardFiles');
        const savedOperation = localStorage.getItem('clipboardOperation');
        
        if (!savedFiles) {
            await message('剪贴板为空', { title: '提示', type: 'info' });
            return;
        }
        
        const files = JSON.parse(savedFiles);
        const operation = savedOperation || 'copy';
        
        console.log(`开始${operation === 'cut' ? '移动' : '复制'}文件:`, files, '到', targetDir);
        
        for (const sourcePath of files) {
            const fileName = path.basename(sourcePath);
            const destPath = path.join(targetDir, fileName);
            
            try {
                if (operation === 'cut') {
                    // 移动文件
                    await invoke('rename_file', { 
                        oldPath: sourcePath, 
                        newPath: destPath 
                    });
                    console.log(`已移动: ${fileName}`);
                } else {
                    // 复制文件
                    await invoke('copy_file', { 
                        source: sourcePath, 
                        destination: destPath 
                    });
                    console.log(`已复制: ${fileName}`);
                }
            } catch (err) {
                console.error(`处理文件 ${fileName} 失败:`, err);
                // 继续处理其他文件
            }
        }
        
        // 如果是剪切操作，清空剪贴板
        if (operation === 'cut') {
            clipboardFiles = [];
            clipboardOperation = '';
            localStorage.removeItem('clipboardFiles');
            localStorage.removeItem('clipboardOperation');
        }
        
        // 刷新当前目录
        await navigateTo(targetDir);
        
        await message(`${operation === 'cut' ? '移动' : '复制'}完成`, { 
            title: '成功', 
            type: 'info' 
        });
        
    } catch (error) {
        console.error('pasteFile error:', error);
        await message('粘贴失败: ' + error, { title: '错误', type: 'error' });
    }
}

// ==================== 侧边栏操作 ====================

/**
 * 切换侧边栏区域的展开/折叠状态
 * @param {string} sectionId - 区域ID
 */
function toggleSidebarSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const content = section.querySelector('.sidebar-section-content');
    const icon = section.querySelector('.sidebar-section-icon');
    
    if (!content) return;
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (icon) {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-down');
        }
    } else {
        content.style.display = 'none';
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-right');
        }
    }
}

/**
 * 更新收藏夹显示
 */
function updateFavorites() {
    const favoritesContainer = document.getElementById('favorites-tab');
    if (!favoritesContainer) return;
    
    favoritesContainer.innerHTML = '';
    
    if (favorites.length === 0) {
        favoritesContainer.innerHTML = '<p class="empty-message">暂无收藏夹</p>';
        return;
    }
    
    favorites.forEach(favPath => {
        const favItem = document.createElement('div');
        favItem.className = 'sidebar-item favorite-item';
        favItem.innerHTML = `
            <i class="fas fa-star file-icon"></i>
            <span class="favorite-label">${path.basename(favPath)}</span>
        `;
        
        favItem.addEventListener('click', () => navigateTo(favPath));
        
        favItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showFavoriteContextMenu(favPath, e.clientX, e.clientY);
        });
        
        favoritesContainer.appendChild(favItem);
    });
}

/**
 * 显示收藏夹右键菜单
 * @param {string} favPath - 收藏夹路径
 * @param {number} x - 鼠标X坐标
 * @param {number} y - 鼠标Y坐标
 */
async function showFavoriteContextMenu(favPath, x, y) {
    // TODO: 实现完整的右键菜单
    // 暂时使用简单的确认对话框
    const result = await confirm(`是否从收藏夹中移除？\n\n${favPath}`, {
        title: '移除收藏',
        type: 'warning'
    });
    
    if (result) {
        removeFromFavorites(favPath);
        updateFavorites();
    }
}

// ==================== 主初始化 ====================

async function init() {
    try {
        console.log('🚀 EasyExplorer Tauri 版本启动中...');
        
        await initTauriAPIs();
        await initUI();
        await loadDrives();
        
        loadFavorites();
        updateFavorites(); // 更新收藏夹显示
        loadFolderGroups();
        bindEvents();
        
        const drives = await invoke('get_drives');
        if (drives && drives.length > 0) {
            await navigateTo(drives[0].name);
        }
        
        console.log('✅ EasyExplorer Tauri 版本已启动完成');
        
    } catch (error) {
        console.error('❌ 初始化失败:', error);
        document.body.innerHTML = `
            <div style="padding: 20px; font-family: sans-serif;">
                <h2 style="color: red;">⚠️ 应用初始化失败</h2>
                <p>请确保使用 <code>npm run dev</code> 启动应用，而不是直接在浏览器中打开 HTML 文件。</p>
                <p><strong>错误信息:</strong> ${error.message}</p>
                <hr>
                <p><strong>正确启动方式:</strong></p>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">npm run dev</pre>
            </div>
        `;
    }
}

// ==================== 拖拽调整功能 ====================

let isResizing = false;
let isResizingPreview = false;

// ==================== 最近访问 ====================

async function loadRecentAccess() {
    const recentTab = document.getElementById('recent-tab');
    if (!recentTab) return;
    
    // 过滤掉不存在的文件/文件夹
    const validRecent = [];
    for (const item of recentAccess) {
        try {
            const exists = await invoke('path_exists', { path: item.path });
            if (exists) {
                validRecent.push(item);
            }
        } catch (err) {
            console.warn(`检查路径失败: ${item.path}`, err);
        }
    }
    
    // 更新有效的记录
    if (validRecent.length !== recentAccess.length) {
        recentAccess = validRecent;
        localStorage.setItem('recentAccess', JSON.stringify(recentAccess));
    }
    
    if (recentAccess.length === 0) {
        recentTab.innerHTML = `
            <div class="recent-empty">
                <i class="fas fa-clock" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
                <p style="color: #999;">暂无最近访问的文件和文件夹</p>
                <p style="color: #ccc; font-size: 12px;">打开文件或文件夹后会显示在这里</p>
            </div>
        `;
        return;
    }
    
    // 按日期分组
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    const groups = {
        today: [],
        yesterday: [],
        thisWeek: [],
        older: []
    };
    
    recentAccess.forEach(item => {
        const accessDate = new Date(item.accessTime);
        accessDate.setHours(0, 0, 0, 0);
        
        if (accessDate.getTime() === today.getTime()) {
            groups.today.push(item);
        } else if (accessDate.getTime() === yesterday.getTime()) {
            groups.yesterday.push(item);
        } else if (accessDate >= thisWeek) {
            groups.thisWeek.push(item);
        } else {
            groups.older.push(item);
        }
    });
    
    // 生成 HTML
    let html = '<div class="recent-container">';
    
    const groupTitles = {
        today: '今天',
        yesterday: '昨天',
        thisWeek: '本周',
        older: '更早'
    };
    
    for (const [key, items] of Object.entries(groups)) {
        if (items.length === 0) continue;
        
        html += `
            <div class="recent-group">
                <div class="recent-group-header">
                    <i class="fas fa-chevron-down"></i>
                    <span>${groupTitles[key]}</span>
                    <span class="recent-group-count">(${items.length})</span>
                </div>
                <div class="recent-group-content">
        `;
        
        items.forEach(item => {
            const icon = getFileIcon(item.name, item.isDirectory);
            const timeStr = new Date(item.accessTime).toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            html += `
                <div class="recent-item" data-path="${item.path}" data-is-directory="${item.isDirectory}">
                    <span class="recent-item-icon">${icon}</span>
                    <div class="recent-item-info">
                        <span class="recent-item-name">${item.name}</span>
                        <span class="recent-item-path">${item.path}</span>
                    </div>
                    <span class="recent-item-time">${timeStr}</span>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    recentTab.innerHTML = html;
    
    // 添加事件监听
    document.querySelectorAll('.recent-item').forEach(item => {
        const filePath = item.getAttribute('data-path');
        const isDirectory = item.getAttribute('data-is-directory') === 'true';
        
        // 单击 - 如果是文件夹则在中间区域导航，如果是文件则仅更新右侧预览
        item.addEventListener('click', async () => {
            if (isDirectory) {
                await navigateTo(filePath);
            } else {
                await updatePreview(filePath);
            }
        });
        
        // 双击 - 打开（不切换到主页标签）
        item.addEventListener('dblclick', async (e) => {
            e.stopPropagation();
            if (isDirectory) {
                await navigateTo(filePath);
            } else {
                try {
                    await invoke('open_with_default', { path: filePath });
                } catch (error) {
                    console.error('打开文件失败:', error);
                }
            }
        });
        
        // 右键菜单
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showRecentContextMenu(filePath, isDirectory, e.clientX, e.clientY);
        });
    });
    
    // 分组折叠/展开
    document.querySelectorAll('.recent-group-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const icon = header.querySelector('i');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.style.transform = 'rotate(0deg)';
            } else {
                content.style.display = 'none';
                icon.style.transform = 'rotate(-90deg)';
            }
        });
    });
}

function showRecentContextMenu(filePath, isDirectory, x, y) {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu) return;
    
    contextMenu.innerHTML = `
        ${isDirectory ? `
            <div class="context-menu-item" data-action="open">
                <i class="fas fa-folder-open"></i>
                <span>打开</span>
            </div>
        ` : `
            <div class="context-menu-item" data-action="open">
                <i class="fas fa-file"></i>
                <span>打开</span>
            </div>
        `}
        <div class="context-menu-item" data-action="openInExplorer">
            <i class="fas fa-external-link-alt"></i>
            <span>在文件资源管理器中显示</span>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="removeFromRecent">
            <i class="fas fa-times"></i>
            <span>从列表中移除</span>
        </div>
    `;
    
    // 定位菜单
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.display = 'block';
    
    // 处理菜单项点击
    contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', async () => {
            const action = item.getAttribute('data-action');
            
            switch (action) {
                case 'open':
                    if (isDirectory) {
                        const foldersButton = document.querySelector('[data-tab="folders"]');
                        if (foldersButton) {
                            foldersButton.click();
                        }
                        await navigateTo(filePath);
                    } else {
                        try {
                            await invoke('open_with_default', { path: filePath });
                        } catch (error) {
                            console.error('打开文件失败:', error);
                        }
                    }
                    break;
                    
                case 'openInExplorer':
                    try {
                        await invoke('open_in_explorer', { path: filePath });
                    } catch (error) {
                        console.error('在资源管理器中打开失败:', error);
                    }
                    break;
                    
                case 'removeFromRecent':
                    recentAccess = recentAccess.filter(item => item.path !== filePath);
                    localStorage.setItem('recentAccess', JSON.stringify(recentAccess));
                    loadRecentAccess();
                    break;
            }
            
            contextMenu.style.display = 'none';
        });
    });
    
    // 点击其他地方关闭菜单
    const closeMenu = (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

function initResizers() {
    const resizer = document.getElementById('resizer');
    const previewResizer = document.getElementById('preview-resizer');
    const sidebar = document.getElementById('sidebar');
    const previewPanel = document.getElementById('preview-panel');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const previewToggle = document.getElementById('preview-toggle');
    
    // 左侧边栏拖拽
    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            resizer.classList.add('resizing');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            
            const onMouseMove = (e) => {
                if (!isResizing) return;
                requestAnimationFrame(() => {
                    const newWidth = e.clientX;
                    if (newWidth > 150 && newWidth < window.innerWidth * 0.4) {
                        sidebar.style.width = `${newWidth}px`;
                        if (newWidth < 350) {
                            sidebar.classList.add('small-width');
                        } else {
                            sidebar.classList.remove('small-width');
                        }
                    }
                });
            };
            
            const onMouseUp = () => {
                isResizing = false;
                resizer.classList.remove('resizing');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
    
    // 右侧预览面板拖拽
    if (previewResizer && previewPanel) {
        previewResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizingPreview = true;
            previewResizer.classList.add('resizing');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
            
            const onMouseMove = (e) => {
                if (!isResizingPreview) return;
                requestAnimationFrame(() => {
                    const newWidth = window.innerWidth - e.clientX;
                    if (newWidth > 200 && newWidth < window.innerWidth * 0.5) {
                        previewPanel.style.width = `${newWidth}px`;
                    }
                });
            };
            
            const onMouseUp = () => {
                isResizingPreview = false;
                previewResizer.classList.remove('resizing');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
    
    // 侧边栏切换
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                sidebar.style.width = '250px';
            } else {
                sidebar.classList.add('collapsed');
                sidebar.style.width = '0';
            }
        });
    }
    
    // 预览面板切换
    if (previewToggle && previewPanel) {
        previewToggle.addEventListener('click', () => {
            if (previewPanel.classList.contains('collapsed')) {
                previewPanel.classList.remove('collapsed');
                previewPanel.style.width = '300px';
            } else {
                previewPanel.classList.add('collapsed');
                previewPanel.style.width = '0';
            }
        });
    }
}

// DOM 加载完成后启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 导出给全局使用
window.easyExplorer = {
    navigateTo,
    openFile,
    addToFavorites,
    removeFromFavorites,
};
