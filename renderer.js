// #region 库
const fs = require('fs')
const path = require('path')
const { shell, ipcRenderer, clipboard } = require('electron')
const os = require('os')
const { execSync } = require('child_process')
const iconv = require('iconv-lite')
const Sortable = require('sortablejs')
const iconExtractor = require('icon-extractor');
const windowsShortcuts = require('windows-shortcuts-gbk')
const { console } = require('inspector')
const libre = require('libreoffice-convert');
const fsExtra = require('fs-extra'); // 引入 fs-extra
const hljs = require('highlight.js'); // 引入 highlight.js
const PSD = require('psd'); // 引入psd.js库
const clipboardEx = require('electron-clipboard-ex');
// #endregion

// #region Dom元素

const pathElement = document.createElement('input')
const fileListElement = document.getElementById('file-list')
const backBtn = document.getElementById('back-btn')
const forwardBtn = document.getElementById('forward-btn')
const upBtn = document.getElementById('up-btn')
const favoritesElement = document.getElementById('favorites')
const drivesElement = document.getElementById('drives')
const quickAccessElement = document.getElementById('quick-access')
const statusBarElement = document.getElementById('status-bar')
const listViewBtn = document.getElementById('list-view-btn')
const iconViewBtn = document.getElementById('icon-view-btn')
const groupViewBtn = document.getElementById('group-view-btn');
const timelineViewBtn = document.getElementById('timeline-view-btn');
const fileListContainer = document.getElementById('file-list-container')
const previewPanel = document.getElementById('preview-panel')
const previewToggle = document.getElementById('preview-toggle')
const previewResizer = document.getElementById('preview-resizer')
const previewContent = document.getElementById('preview-content')
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const main = document.getElementById('main');
const settingsIcon = document.getElementById('settings');
const settingsMenu = document.getElementById('settings-menu');
const themeToggleButton = document.getElementById('theme-toggle');
const fullscreen_preview = document.getElementById('fullscreen-preview');
const review_content_fullscreen = document.getElementById('preview-content-fullscreen');
const statusBar = document.getElementById('status-bar');


// #endregion

// #region 变量

let currentPath = ''
let currentSortMethod = 'name';// 方法
let currentSortOrder = 'asc';// 排序顺序
let isPreviewResizing = false; // 预览面板拖拽


let lastX = 0;
let history = []
let currentHistoryIndex = -1

let isResizing = false;
let isPreviewOpen = false; // 是否全屏
let selectedItem = null; // 选中项

let customIcons = {};
const favoriteIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" ><path d="M23.9986 5L17.8856 17.4776L4 19.4911L14.0589 29.3251L11.6544 43L23.9986 36.4192L36.3454 43L33.9586 29.3251L44 19.4911L30.1913 17.4776L23.9986 5Z" fill="#333" stroke="#333" stroke-width="4" stroke-linejoin="round"/></svg>`
const driveIcon = `<img src="./assets/icons/driveIcon.png" />`
const folderIcon = `<?xml version='1.0' encoding='utf-8'?><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 70 61.3' style='enable-background:new 0 0 70 61.3;'>    <title>图标示例</title>    <path fill='#FFC446' d='M63.4,8.7H40.2c-0.1,0-0.3,0-0.4-0.1c-0.1,0-0.3-0.1-0.4-0.2l-6.7-6.8c-0.5-0.5-1.1-0.9-1.7-1.2        C30.2,0.2,29.5,0,28.8,0H6.6C2.9,0,0,2.9,0,6.6v48.1c0,3.6,2.9,6.5,6.6,6.6h56.9c3.6,0,6.6-2.9,6.6-6.6V15.3        C70,11.7,67.1,8.8,63.4,8.7z'/>    <text x='35' y='37' fill='#EFA348' font-family='Arial-BoldMT' font-size='31.504' text-anchor='middle' dominant-baseline='middle'></text></svg>`

let isSelecting = false;
let selectionBox = null;
let startX, startY;


let favorites = JSON.parse(localStorage.getItem('favorites')) || []
let currentViewMode = localStorage.getItem('viewMode') || 'list'; // 修改视图模相关的变量和函数
let statusBarDisplayOptions = JSON.parse(localStorage.getItem('statusBarDisplayOptions')) || {
    showPath: true,
    showType: true,
    showSize: true,
    showDate: true
};

// 在文件顶部添加新的变量
let activeTab = 'folders'; // 默认显示文件夹选项卡

// #endregion

// #region 启动预处理

pathElement.id = 'path'
pathElement.type = 'text'

// 加载上次打开的路径
let lastOpenedPath = localStorage.getItem('lastOpenedPath');
let initialPath = lastOpenedPath || (process.platform === 'win32' ? process.env.USERPROFILE || 'C:\\' : process.env.HOME || '/');

main.insertBefore(pathElement, document.querySelector('#path-container'))

// 加载自定义图标
fs.readFile(path.join(__dirname, 'icons.json'), 'utf8', (err, data) => {
    if (err) {
        console.error('无法加载图标文件:', err);
        return;
    }
    customIcons = JSON.parse(data);
});



// 初始化
document.addEventListener('DOMContentLoaded', () => {
    currentViewMode = localStorage.getItem('viewMode') || 'list';
    // console.log('Initial view mode:', currentViewMode);
    setViewMode(currentViewMode); // 初始化视图模式

    // 确保路径存在
    fs.access(initialPath, fs.constants.R_OK, (err) => {
        if (err) {
            console.error('无法访问初始路径:', err);
            initialPath = process.platform === 'win32' ? 'C:\\' : '/';
        }
        updateFileList(initialPath);
    });

    // 设置侧边栏切换事件
    const sidebarSections = document.querySelectorAll('.sidebar-section');
    sidebarSections.forEach(section => {
        const header = section.querySelector('.sidebar-section-header');
        if (header) {
            header.addEventListener('click', () => {
                toggleSidebarSection(section.id);
            });
        }
    });

    // 设置排序按钮事件
    document.getElementById('sort-name').addEventListener('click', () => handleSortClick('name'));
    document.getElementById('sort-date').addEventListener('click', () => handleSortClick('date'));
    document.getElementById('sort-modified').addEventListener('click', () => handleSortClick('modified'));
    document.getElementById('sort-type').addEventListener('click', () => handleSortClick('type'));

    // 初始化文件列表
    updateFileList(initialPath);

    // 更新侧边栏内容
    updateFavorites(); // 更新收藏夹
    showDrives(); // 显示驱动器
    updateQuickAccess(); // 更新快速访问

    // 添加标签页切换功能
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // 移除所有活动类
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.style.display = 'none');
            
            // 添加活动类到当前标签
            button.classList.add('active');
            document.getElementById(`${tabName}-tab`).style.display = 'block';

            // 如果是"最近"标签,更新内容
            if (tabName === 'recent') {
                updateRecentTab();
            }
        });
    });

    // 加载保存的选项卡状态
    activeTab = localStorage.getItem('activeTab') || 'folders';
    const activeTabButton = document.querySelector(`.tab-button[data-tab="${activeTab}"]`);
    if (activeTabButton) {
        activeTabButton.click();
    }

    // 为选项卡按钮添加点击事件
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            activeTab = tabName;
            localStorage.setItem('activeTab', activeTab);
            
            // ... 现有的选项卡切换逻辑 ...
        });
    });
});

// 修改 updateRecentTab 函数
function updateRecentTab() {
    const recentTab = document.getElementById('recent-tab');
    const quickAccessPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent');

    fs.readdir(quickAccessPath, (err, files) => {
        if (err) {
            console.error('无法读取最近访问目录:', err);
            recentTab.innerHTML = '<p>无法加载最近访问的项目</p>';
            return;
        }

        // 过滤并处理快捷方式
        Promise.all(files.filter(file => path.extname(file).toLowerCase() === '.lnk')
            .map(file => new Promise((resolve) => {
                const filePath = path.join(quickAccessPath, file);
                windowsShortcuts.query(filePath, (error, shortcut) => {
                    if (error) {
                        resolve(null);
                    } else {
                        let targetPath = shortcut.target;
                        if (Buffer.isBuffer(targetPath)) {
                            targetPath = iconv.decode(targetPath, 'gbk');
                        }
                        fs.stat(targetPath, (err, stats) => {
                            if (err) {
                                resolve(null);
                            } else {
                                resolve({ 
                                    path: targetPath, 
                                    name: path.basename(targetPath),
                                    parentDir: path.dirname(targetPath),
                                    isDirectory: stats.isDirectory(),
                                    atime: stats.atime // 使用访问时间而不是修改时间
                                });
                            }
                        });
                    }
                });
            })))
            .then(recentItems => {
                recentItems = recentItems.filter(item => item !== null && !item.isDirectory);
                
                // 去除重复项，只保留最近的一条
                const uniqueItems = {};
                recentItems.forEach(item => {
                    if (!uniqueItems[item.path] || item.atime > uniqueItems[item.path].atime) {
                        uniqueItems[item.path] = item;
                    }
                });
                recentItems = Object.values(uniqueItems);

                // 按访问时间排序，最新的排在前面
                recentItems.sort((a, b) => b.atime - a.atime);

                const timelineContainer = document.createElement('div');
                timelineContainer.className = 'timeline-container';

                let currentDate = null;

                recentItems.forEach(item => {
                    const itemDate = item.atime.toDateString();
                    
                    if (itemDate !== currentDate) {
                        currentDate = itemDate;
                        const dateHeader = document.createElement('div');
                        dateHeader.className = 'timeline-date-header';
                        dateHeader.innerHTML = `
                            <span class="date-text">${item.atime.toISOString().split('T')[0]}</span>
                            <i class="fas fa-chevron-down"></i>
                        `;
                        dateHeader.addEventListener('click', toggleDateItems);
                        timelineContainer.appendChild(dateHeader);

                        const dateItems = document.createElement('div');
                        dateItems.className = 'timeline-date-items';
                        timelineContainer.appendChild(dateItems);
                    }

                    const timelineItem = document.createElement('div');
                    timelineItem.className = 'timeline-item';
                    timelineItem.innerHTML = `
                        <div class="timeline-item-content">
                            <span class="file-time">${formatTime(item.atime)}</span>
                            <span class="file-icon">${getUnknownIcon(path.extname(item.name))}</span>
                            <span class="file-name" title="${item.name}">${item.name}</span>
                            <span class="file-parent-dir" title="${item.parentDir}">${path.basename(item.parentDir)}</span>
                        </div>
                    `;

                    const fileName = timelineItem.querySelector('.file-name');
                    const parentDir = timelineItem.querySelector('.file-parent-dir');

                    // 添加鼠标悬停事件
                    timelineItem.addEventListener('mouseover', () => {
                        updateStatusBar(item.path);
                        updatePreview({
                            name: item.name,
                            isDirectory: item.isDirectory,
                            stats: {
                                birthtime: item.atime,
                                mtime: item.atime
                            }
                        });
                    });

                    timelineItem.addEventListener('mouseout', () => {
                        updateStatusBar('');
                        updatePreview(null);
                    });

                    fileName.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        shell.openPath(item.path);
                        debouncedUpdateRecentTab();
                    });

                    parentDir.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navigateTo(item.parentDir);
                    });

                    timelineContainer.lastElementChild.appendChild(timelineItem);
                });

                recentTab.innerHTML = '';
                recentTab.appendChild(timelineContainer);
            });
    });
}

// 添加折叠/展开功能
function toggleDateItems(e) {
    const dateHeader = e.currentTarget;
    const dateItems = dateHeader.nextElementSibling;
    const isCollapsed = dateHeader.classList.toggle('collapsed');
    dateItems.style.display = isCollapsed ? 'none' : 'block';
    dateHeader.querySelector('i').className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down';
}

// 添加格式化日期的函数
function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('zh-CN', options);
}

// 添加格式化时间的函数
function formatTime(date) {
    const options = { hour: '2-digit', minute: '2-digit' };
    return date.toLocaleTimeString('zh-CN', options);
}

// 修改 updateQuickAccess 函数，使其同时更新"最近"标签
function updateQuickAccess() {
    // ... 现有的代码 ...

    // 在更新快速访问后，也更新"最近"标签
    updateRecentTab();
}

// 在应用程序关闭前保存当前路径和选项卡状态
window.addEventListener('beforeunload', () => {
    localStorage.setItem('lastOpenedPath', currentPath);
    localStorage.setItem('activeTab', activeTab);
});

// #endregion

// #region 通用函数-文件

// 复制文件
function copyFile(filePaths) {
    // 判断 filePaths 是否为字符串，如果是则转换为数组
    if (typeof filePaths === 'string') {
        filePaths = [filePaths]; // 将字符串包装在数组中
    }

    clipboardEx.writeFilePaths(filePaths); // 将 filePaths 写入贴板
    const copiedPaths = clipboardEx.readFilePaths();
    console.log('filePath:', copiedPaths);
}

// 粘贴文件
function pasteFile(targetDir, source) {
    const fileName = path.basename(source);
    const destination = path.join(targetDir, fileName);

    fs.copyFile(source, destination, (err) => {
        if (err) {
            console.error('复制件时出错:', err);
        } else {
            console.log(`文件已粘贴到: ${destination}`);
            // updateFileList(targetDir); // 更新文件列表
        }
    });
}

// 复制进度
ipcRenderer.on('copy-progress', (data) => {
    // 解析进度信息更新进度条
    console.log('复制进度:', data);
    // 更新进度条的逻辑
});



// #endregion

// #region 通用函数-日期

// 格式化文件大小
function formatFileSize(size) {
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
    if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' MB';
    return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// 格式化日期
function formatDate(date) {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// #endregion

// #region 布局-调整

// 侧栏切换
function toggleSidebarSection(sectionId) {
    const section = document.getElementById(sectionId);
    const content = section.querySelector('.sidebar-section-content');
    const icon = section.querySelector('.sidebar-section-icon');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
    } else {
        content.style.display = 'none';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
    }
}

// 拖拽-左栏
resizer.addEventListener('mousedown', initResize);

// 初始化拖拽排序
function initResize(e) { // 初始化拖拽排序
    isResizing = true;
    resizer.classList.add('resizing');
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'none';
}

// 拖拽调整
function resize(e) {
    if (!isResizing) return;
    requestAnimationFrame(() => {
        const newWidth = e.clientX < 0 ? 1 : e.clientX; 
        if (newWidth > 0 && newWidth < window.innerWidth) {
            sidebar.style.width = `${newWidth}px`;
            console.log('newWidth', newWidth);
            if (newWidth < 350) {
                sidebar.classList.add('small-width');
            } else {
                sidebar.classList.remove('small-width');
            }
        }
    });
}

// 停止拖拽调整
function stopResize() {
    isResizing = false;
    resizer.classList.remove('resizing');
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.userSelect = '';
}

// 侧栏切换
sidebarToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        sidebar.style.width = '250px';  // 或者使用上次调整的宽度
    } else {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '0';
    }
});

// 预览面板切换
previewToggle.addEventListener('click', () => {
    if (previewPanel.classList.contains('collapsed')) {
        previewPanel.classList.remove('collapsed');
        previewPanel.style.width = '250px';  // 或者使用上次调整的宽度
    } else {
        previewPanel.classList.add('collapsed');
        previewPanel.style.width = '0';
    }
});

// #endregion

// #region 右键菜单

// 右键菜单-左栏
sidebar.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const target = e.target.closest('.favorite-item'); // 检查是否在收藏夹项目上
    if (target) {
        const favPath = target.getAttribute('data-path'); // 获取收藏夹路径
        console.log('favPath', favPath);
        showFavoriteContextMenu(favPath, e.clientX, e.clientY); // 显示取消收藏菜单
    } else {
        showContextMenu(null, currentPath); // 显示默认菜单
    }
});

// 收藏夹右键菜单
ipcRenderer.on('favorite-menu-item-clicked', (event, action, path) => {
    switch (action) {
        case 'remove-from-favorites':
            removeFromFavorites(path);
            break;
    }
});

// 显示上下文菜单
function showContextMenu(file, dirPath) {
    const isDirectory = file ? (typeof file.isDirectory === 'function' ? file.isDirectory() : file.isDirectory) : true;
    const filePath = file ? path.join(dirPath, file.name) : dirPath;
    const isFavorite = favorites.includes(filePath);

    ipcRenderer.send('show-context-menu', {
        isDirectory: isDirectory,
        path: filePath,
        isCurrentDir: !file,
        isFavorite: isFavorite,
        hasSelection: !!file
    });
}

// 右键菜单点击事件
ipcRenderer.on('menu-item-clicked', (event, action, path) => {
    switch (action) {
        case 'open-in-explorer':
            shell.showItemInFolder(path);
            break;
        case 'add-to-favorites':
            addToFavorites(path);
            break;
        case 'remove-from-favorites':
            removeFromFavorites(path);
            break;
        case 'copy':
            const selectedItems = fileListContainer.querySelectorAll('.file-item.selected'); // 获取选中的文件项
            const selectedPaths = Array.from(selectedItems).map(item => item.getAttribute('data-path')); // 获取选中项的路径
            copyFile(selectedPaths); // 传递选中项的路径
            break;
        case 'paste':
            const filePaths = clipboardEx.readFilePaths(); // 获取剪贴板中的文件路径
            if (filePaths.length > 0) {
                // 发送粘贴事件到主进程
                ipcRenderer.send('perform-paste', currentPath, filePaths);
            }
            break;
            if (filePaths.length > 0) {
                filePaths.forEach(filePath => {
                    pasteFile(currentPath, filePath); // 将件粘贴到当前路径
                });
                updateFileList(currentPath); // 更新文件列表以显示新粘贴的文件
            }

    }
});


// #endregion

// #region 文件-视图-时间轴

// 创建时间轴项目
function createTimelineItems(fileDetails) {
    const timelineContainer = document.createElement('div');
    timelineContainer.className = 'timeline-container';

    // 按创建日期排序文件
    fileDetails.sort((a, b) => b.stats.birthtime - a.stats.birthtime);

    let currentYear = null;
    let currentMonth = null;
    const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

    fileDetails.forEach(file => {
        if (file.stats && file.stats.birthtime) {
            const fileDate = new Date(file.stats.birthtime);
            const fileYear = fileDate.getFullYear();
            const fileMonth = fileDate.getMonth();

            if (fileYear !== currentYear) {
                currentYear = fileYear;
                const yearHeader = document.createElement('div');
                yearHeader.className = 'timeline-year-header';
                yearHeader.innerHTML = `
                    <span class="year-text">${currentYear}</span>
                    <i class="fas fa-chevron-down"></i>
                `;
                yearHeader.addEventListener('click', toggleYearItems);
                timelineContainer.appendChild(yearHeader);

                const yearItems = document.createElement('div');
                yearItems.className = 'timeline-year-items';
                timelineContainer.appendChild(yearItems);

                currentMonth = null; // 重置月份，确保新的一年会显示所有月份
            }

            if (fileMonth !== currentMonth) {
                currentMonth = fileMonth;
                const monthHeader = document.createElement('div');
                monthHeader.className = 'timeline-month-header';
                monthHeader.innerHTML = `
                    <span class="month-text">${monthNames[currentMonth]}</span>
                    <i class="fas fa-chevron-down"></i>
                `;
                monthHeader.addEventListener('click', toggleMonthItems);
                timelineContainer.lastElementChild.appendChild(monthHeader);

                const monthItems = document.createElement('div');
                monthItems.className = 'timeline-month-items';
                timelineContainer.lastElementChild.appendChild(monthItems);
            }

            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item';
            timelineItem.innerHTML = `
                <div class="timeline-item-content">
                    <span class="file-icon">${file.isDirectory ? folderIcon : getUnknownIcon(path.extname(file.name))}</span>
                    <span class="file-name">${file.name}</span>
                    <div class="file-time">
                        <span>创建: ${formatDate(file.stats.birthtime)}</span>
                        <span>修改: ${formatDate(file.stats.mtime)}</span>
                    </div>
                </div>
            `;

            // 添加事件监听器
            timelineItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const filePath = path.join(currentPath, file.name);
                if (file.isDirectory) {
                    navigateTo(filePath);
                } else {
                    shell.openPath(filePath);
                }
            });

            // 添加鼠标移入事件监听器
            timelineItem.addEventListener('mouseover', () => {
                updateStatusBar(path.join(currentPath, file.name));
                updatePreview(file);
            });

            // 添加鼠标移出事件监听器
            timelineItem.addEventListener('mouseout', () => {
                updateStatusBar(currentPath);
                updatePreview(null);
            });

            timelineContainer.lastElementChild.lastElementChild.appendChild(timelineItem);
        }
    });

    return timelineContainer;
}

// 年份切换
function toggleYearItems(e) {
    const yearHeader = e.currentTarget;
    const yearItems = yearHeader.nextElementSibling;
    let isCollapsed = yearHeader.classList.toggle('collapsed');

    if (yearItems && yearItems.classList.contains('timeline-year-items')) {
        yearItems.style.maxHeight = isCollapsed ? '0' : `${yearItems.scrollHeight}px`;
    }

    yearHeader.querySelector('i').className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down';
}

// 月份切换
function toggleMonthItems(e) {
    const monthHeader = e.currentTarget;
    const monthItems = monthHeader.nextElementSibling;
    let isCollapsed = monthHeader.classList.toggle('collapsed');

    if (monthItems && monthItems.classList.contains('timeline-month-items')) {
        monthItems.style.maxHeight = isCollapsed ? '0' : `${monthItems.scrollHeight}px`;
    }

    monthHeader.querySelector('i').className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down';
}

// 格式化日期
function formatDate(date) {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}
// #endregion

// #region 面板-工具栏
// 后退按钮
backBtn.addEventListener('click', () => {
    console.warn('backBtn clicked');
    if (currentHistoryIndex > 0) {
        currentHistoryIndex--
        updateFileList(history[currentHistoryIndex])
    }
})

// 前进按钮
forwardBtn.addEventListener('click', () => {
    if (currentHistoryIndex < history.length - 1) {
        currentHistoryIndex++
        updateFileList(history[currentHistoryIndex])
    }
})

// 向上按钮
upBtn.addEventListener('click', () => {
    const parentPath = path.dirname(currentPath)
    if (parentPath !== currentPath) {
        navigateTo(parentPath)
    } else if (process.platform === 'win32' && /^[A-Z]:$/.test(currentPath)) {
        showDrives()
    }
})

// #endregion

// #region 文件框选

fileListContainer.addEventListener('mousedown', handleMouseDown);
fileListContainer.addEventListener('mousemove', handleMouseMove);
fileListContainer.addEventListener('mouseup', handleMouseUp);

// 创建选择框
function createSelectionBox(x, y) {
    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    document.body.appendChild(selectionBox);
}

// 更新选择框
function updateSelectionBox(x, y) {
    const width = Math.abs(x - startX);
    const height = Math.abs(y - startY);
    const left = Math.min(x, startX);
    const top = Math.min(y, startY);
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
}

// 移除择框
function removeSelectionBox() {
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
}

// 判断元素是否在选择框内
function isElementInSelectionBox(element, box) {
    const elementRect = element.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    return !(elementRect.right < boxRect.left ||
        elementRect.left > boxRect.right ||
        elementRect.bottom < boxRect.top ||
        elementRect.top > boxRect.bottom);
}

// 选择框开始
function handleMouseDown(e) {
    if (e.button !== 0) return; // 只处理左键点击
    const target = e.target;


    // 检查是否在文件项上
    if (target.classList.contains('file-item') || target.closest('.file-item')) {
        console.log('文件上:', target.closest('.file-item').getAttribute('data-path'));
        // 如果在文件项上，开始拖拽
        const filePath = target.closest('.file-item').getAttribute('data-path'); // 获取文件路径
        const fileData = [Buffer.from(fs.readFileSync(filePath))];
        e.dataTransfer.setData('text/uri-list', `file://${filePath}`);
        e.dataTransfer.effectAllowed = 'copy';  // 设置拖拽效果
    } else {
        // 如果在空白处，开始框选
        console.log('空白处');
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        createSelectionBox(startX, startY);
    }
}

// 选择框移动
function handleMouseMove(e) {
    if (!isSelecting) return;
    updateSelectionBox(e.clientX, e.clientY);
    selectItemsInBox();
}

// 选择框结束
function handleMouseUp(e) {
    if (!isSelecting) return;
    isSelecting = false;
    removeSelectionBox(); // 确保在鼠标释放时移除选择框
}

// 选择框选择文件
function selectItemsInBox() {
    const fileItems = fileListContainer.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        if (isElementInSelectionBox(item, selectionBox)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}


// #endregion

// #region 收藏夹

// 从收藏夹中移除目录
function removeFromFavorites(dirPath) {
    const index = favorites.indexOf(dirPath);
    if (index > -1) {
        favorites.splice(index, 1);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        updateFavorites();
    } else {
        console.error('目录路径不在收藏夹中:', dirPath);
    }
}

// 显示收藏夹右键菜单
function showFavoriteContextMenu(favPath, x, y) {
    ipcRenderer.send('show-favorite-context-menu', { path: favPath, x, y });
}

// 更新收藏夹
function updateFavorites() {
    favoritesElement.innerHTML = `
    <div class="sidebar-section-header" onclick="toggleSidebarSection('favorites')">
      <i class="fas fa-chevron-down sidebar-section-icon"></i>
      <span>收藏</span>
    </div>
    <div class="sidebar-section-content">
      <ul id="favorites-list">
        ${favorites.map(fav => `
          <li class="favorite-item" data-path="${fav}">
            <span class="file-icon">${favoriteIcon}</span>
            <span>${path.basename(fav)}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;

    const favoritesList = document.getElementById('favorites-list');

    // 为收藏项添加右键菜单和鼠标移入事件
    const favoriteItems = favoritesList.querySelectorAll('.favorite-item');
    favoriteItems.forEach(item => {
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const favPath = item.getAttribute('data-path');
            console.log('favPath2222', favPath);
            showFavoriteContextMenu(favPath, e.clientX, e.clientY);
        });

        item.addEventListener('mouseover', () => {
            const favPath = item.getAttribute('data-path');
            updateStatusBar(favPath);
        });

        item.addEventListener('mouseout', () => {
            updateStatusBar(currentPath);
        });

        item.addEventListener('click', () => {
            const favPath = item.getAttribute('data-path');
            navigateTo(favPath);
        });
    });

    // 初始化拖拽排序
    if (favoritesList) {
        Sortable.create(favoritesList, {
            animation: 150,
            onEnd: function (evt) {
                const newOrder = Array.from(favoritesList.children).map(item => item.getAttribute('data-path'));
                favorites = newOrder;
                localStorage.setItem('favorites', JSON.stringify(favorites));
            }
        });
    } else {
        console.error('favorites-list element not found');
    }
}

// 添加到收藏夹
function addToFavorites(dirPath) {
    if (!favorites.includes(dirPath)) {
        favorites.push(dirPath);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        updateFavorites();
    }
}

// #endregion

// #region 文件-文件列表



// 获取文件图标
function getFileIcon(file) {
    return new Promise((resolve) => {
        const isDir = typeof file.isDirectory === 'function' ? file.isDirectory() : file.isDirectory;
        // 果是文件夹，则返回文件夹图标
        if (isDir) {
            resolve(folderIcon);
            return;
        }
        // 只针对exe后缀的文件获取图标
        const ext = path.extname(file.name).toLowerCase();
        if (['.exe', '.lnk'].includes(ext)) {
            const filePath = path.join(currentPath, file.name);
            ipcRenderer.invoke('get-file-icon', filePath).then(base64 => {
                // 检查 base64 是否有效
                if (base64) {
                    resolve(`<img src="${base64}" class="file-icon">`);
                } else {
                    resolve(getUnknownIcon(ext));
                }
            }).catch(error => {
                console.warn(`无法获取文件图标: ${filePath}`, error);
                resolve(getUnknownIcon(ext));
            });
        } else if (['.ttf', '.otf'].includes(ext)) {
            const fontName = path.basename(filePath, path.extname(filePath)); // 获取字体名称
            const isChinese = /[\u4e00-\u9fa5]/.test(fontName); // 检查是否包含中文
            const encodedPath = encodeURIComponent(filePath).replace(/%5C/g, '/'); // 对路径进���编码并替换反斜杠为正斜杠
            const fontFace = new FontFace(fontName, `url(file://${encodedPath})`);

            fontFace.load().then(() => {
                document.fonts.add(fontFace);
                // 创建图标和文件名
                const fontItem = document.createElement('div');
                const fileIcon = document.createElement('div');
                fileIcon.className = 'file-icon';
                fileIcon.textContent = isChinese ? fontName : 'Abg'; // 根据字体内容设置
                fileIcon.style.fontFamily = fontName;
                const fileName = document.createElement('div');
                fileName.className = 'file-name';
                fileName.textContent = file.name;

                // 将图标和文件名添加到文件项
                fontItem.appendChild(fileIcon);
                fontItem.appendChild(fileName);
                resolve(fontItem);

            }).catch(err => {
                resolve(getUnknownIcon(ext));
            });

        } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
            const filePath = path.join(currentPath, file.name);
            resolve(`<img src="${filePath}" class="file-icon">`);
        } else if (['.mp4', '.avi', '.mov'].includes(ext)) {
            const filePath = path.join(currentPath, file.name);
            resolve(`
                <video class="file-icon" src="${filePath}" controls>
                    您的浏览器不支 video 标签。
                </video>
            `);
        } else if (ext === '.svg') {
            const filePath = path.join(currentPath, file.name);
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.warn(`无法读取SVG文件: ${filePath}`, err);
                    resolve(getUnknownIcon(ext));
                } else {
                    resolve(`<div class="file-icon">${data}</div>`);
                }
            });
        } else if (['.mp3', '.wav'].includes(ext)) {
            const filePath = path.join(currentPath, file.name);
            resolve(`
                <audio class="file-icon" src="${filePath}" controls>
                    您的浏览器不支持 audio 标签。
                </audio>
            `);
        } else if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.7zip', '.tgz', '.tar.gz', '.tar.bz2'].includes(ext)) {
            resolve(getUnknownIcon(ext, ".zips"));
        } else {
            const unknownSvg = getUnknownIcon(ext); // 用新函数
            resolve(unknownSvg);
        }
    });
}

// 更新文件列表
function updateFileList(dirPath, isQuickAccess = false) {

    fileListElement.innerHTML = '';
    updatePreview(null);

    fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
        if (err) {
            console.error('无法读取目录:', err, dirPath);
            fileListElement.innerHTML = `<div class="error-message">无法读取目录: ${err.message}</div>`;
            return;
        }

        // 更新路径
        if (!isQuickAccess) {
            currentPath = dirPath;
            pathElement.value = dirPath;
        }

        // 取文件详细信息并排序
        Promise.all(files.map(file => getFileDetails(dirPath, file).catch(err => {
            console.error(`获取文件 ${file.name} 的详情时出错: ${err}`);
            return null; // 如果获取详情失败，返回null以跳过该文件
        })))
            .then(fileDetails => {
                // 过滤掉获取详情失败的文件
                const validFileDetails = fileDetails.filter(detail => detail !== null);//过滤
                sortFiles(validFileDetails);//排序
                fileListElement.innerHTML = '';

                if (currentViewMode === 'timeline') {
                    const timelineItems = createTimelineItems(validFileDetails);
                    fileListElement.appendChild(timelineItems);
                } else if (currentViewMode === 'group') {
                    const groupedFiles = groupFilesByType(validFileDetails) || {};
                    Object.entries(groupedFiles).forEach(([groupName, groupFiles]) => {
                        const groupElement = document.createElement('div');
                        groupElement.className = 'file-list-group';

                        const groupHeader = document.createElement('div');
                        groupHeader.className = 'file-list-group-header';
                        groupHeader.innerHTML = `
                            <span>${groupName}</span>
                            <span class="group-count">${groupFiles.length} 项</span>
                            <div class="group-sort-buttons">
                                <button class="group-sort-button" data-sort="name" title="按名称排序">
                                    <i class="fas fa-sort-alpha-down"></i>
                                </button>
                                <button class="group-sort-button" data-sort="date" title="按日期排序">
                                    <i class="fas fa-calendar-alt"></i>
                                </button>
                            </div>
                        `;
                        groupElement.appendChild(groupHeader);

                        const groupContent = document.createElement('div');
                        groupContent.className = 'file-list-group-content';
                        groupFiles.forEach(file => {
                            const fileItem = createFileItem(file, dirPath);
                            groupContent.appendChild(fileItem);
                        });
                        groupElement.appendChild(groupContent);

                        // 添加排序按钮的事件监听器
                        const sortButtons = groupHeader.querySelectorAll('.group-sort-button');
                        sortButtons.forEach(button => {
                            button.addEventListener('click', (e) => {
                                const sortType = e.currentTarget.getAttribute('data-sort');
                                const isAscending = !e.currentTarget.classList.contains('sorted-asc');

                                sortGroupFiles(groupContent, sortType, isAscending);

                                // 更新排序按钮的状态
                                sortButtons.forEach(btn => btn.classList.remove('sorted-asc', 'sorted-desc'));
                                e.currentTarget.classList.add(isAscending ? 'sorted-asc' : 'sorted-desc');
                            });
                        });

                        fileListElement.appendChild(groupElement);
                    });
                } else {
                    validFileDetails.forEach(file => {
                        const fileItem = createFileItem(file, dirPath);
                        fileListElement.appendChild(fileItem);
                    });
                }
            })
            .catch(error => {
                console.error('获取文件详情时出错:', error);
                // fileListElement.innerHTML = `<div class="error-message">获取文件详情时出错: ${error.message}</div>`;
            });
    });

}

// 获取未知图标
function getUnknownIcon(ext, defaultIcon = '.unknown') {
    return customIcons[ext] || customIcons[defaultIcon].replace('XXX', ext.replace(".", ""));
}

// 创建文件项
function createFileItem(file, dirPath) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    if (file.error) {
        fileItem.classList.add('error');
    }


    fileItem.setAttribute('data-path', path.join(dirPath, file.name));

    const icon = document.createElement('span');
    icon.className = 'file-icon';


    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;

    // 获取文件图标
    getFileIcon(file).then(iconHtml => {
        icon.innerHTML = iconHtml;
        icon.setAttribute('data-svg', iconHtml);
    }).catch(error => {
        console.error('获取文件图标时出错:', error);
        icon.innerHTML = `<i class="far fa-file"></i>`;
    });

    fileItem.appendChild(icon);
    fileItem.appendChild(name);

    // 添加拖拽事件监听器
    fileItem.setAttribute('draggable', true); // 使元素可拖拽
    fileItem.addEventListener('dragstart', (e) => {
        e.preventDefault();
        const filePath = path.join(dirPath, file.name); // 确保路径格式正确
        const fileData = [new File([fs.readFileSync(filePath)], file.name, { type: 'application/octet-stream' })];

        // 设置拖拽格式为 Files，Photoshop 需要文件句柄来识别
        e.dataTransfer.setData('text/uri-list', `file://${filePath}`);
        e.dataTransfer.effectAllowed = 'copy';  // 设置拖拽效果
        console.log('Dragging file:', filePath);
    });

    // 根据当前视图模式添加额外的样式或结构
    if (currentViewMode === 'list') {
        const size = document.createElement('span');
        size.className = 'file-size';
        size.textContent = file.stats ? formatFileSize(file.stats.size) : '';
        fileItem.appendChild(size);

        const date = document.createElement('span');
        date.className = 'file-date';
        date.textContent = file.stats ? formatDate(file.stats.mtime) : '';
        fileItem.appendChild(date);
    }

    if (file.error) {
        fileItem.title = `无法访问: ${file.error}`;
    } else {
        // 只为没错误的文件加事件监听器
        fileItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!e.ctrlKey && !e.shiftKey) {
                // 如果没有按住 Ctrl 或 Shift 键，清除其他选中项
                fileListContainer.querySelectorAll('.file-item.selected').forEach(item => {
                    if (item !== fileItem) {
                        item.classList.remove('selected');
                    }
                });
            }
            fileItem.classList.toggle('selected');
            updateStatusBar(path.join(dirPath, file.name)); //更新状态栏
        });

        // 双击打开文件
        fileItem.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const filePath = path.join(dirPath, file.name);
            if (typeof file.isDirectory === 'function' ? file.isDirectory() : file.isDirectory) {
                navigateTo(filePath);
            } else {
                shell.openPath(filePath);
                debouncedUpdateRecentTab();
            }
        });

        // 右键单
        fileItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(file, dirPath);
        });

        if (!file.error) {

            // 将事件监听器移到这里
            fileItem.addEventListener('mouseover', () => {
                updateStatusBar(path.join(dirPath, file.name));
                updatePreview(file);
                if (file.isDirectory) {
                    const folderPath = path.join(dirPath, file.name); // 构建文件夹完整路径
                    // 获取文件夹中的文件/文件夹数量
                    fs.readdir(folderPath, (err, items) => {
                        if (err) {
                            console.warn(`无法读取文件夹内容: ${folderPath}`, err);
                            return;
                        }
                        const folderCount = items.length; // 计算数量
                        // 替换SVG图标中的文本
                        const updatedFolderIcon = folderIcon.replace(/(<text[^>]*>)(.*?)(<\/text>)/, `$1${folderCount}$3`);
                        icon.innerHTML = updatedFolderIcon; // 更新图标
                    });
                }
            });

            // 鼠标移出事件
            fileItem.addEventListener('mouseout', () => {
                if (icon.hasAttribute('data-svg')) {
                    icon.innerHTML = icon.getAttribute('data-svg'); // 使用 data-svg 的内容还原图标
                } else {
                    icon.innerHTML = folderIcon; // 还原默认文件夹图标
                }
                updateStatusBar(currentPath);
                updatePreview(null);
            });
        }
    }

    return fileItem;
}

// 获取文件详细信息
function getFileDetails(dirPath, file) {
    return new Promise((resolve) => {
        const filePath = path.join(dirPath, file.name);
        fs.stat(filePath, (err, stats) => {
            if (err) {
                console.warn(`无法获取文件 ${filePath} 的详细信息: ${err.message}`);
                resolve({
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    stats: null,
                    error: err.code
                });
            } else {
                // 使用 birthtime 如果可用，否则使用 mtime
                const creationTime = stats.birthtime && stats.birthtime.getTime() > 0
                    ? stats.birthtime
                    : stats.mtime;

                resolve({
                    name: file.name,
                    isDirectory: stats.isDirectory(),
                    stats: {
                        ...stats,
                        birthtime: creationTime
                    }
                });
            }
        });
    });
}


// 文件分组
function groupFilesByType(files) {
    const groups = {};

    files.forEach(file => {
        const ext = file.isDirectory ? '文件夹' : (path.extname(file.name).toLowerCase().replace(/^\./, '') || '无扩展名'); // 修改这一行
        if (!groups[ext]) {
            groups[ext] = [];
        }
        groups[ext].push(file);
    });

    return groups;
}

// 排序文件
function sortFiles(files) {
    return files.sort((a, b) => {
        // 首处理错误的文件
        if (a.error && !b.error) return 1;
        if (!a.error && b.error) return -1;
        if (a.error && b.error) return 0;

        // 然按照文件夹和文分类
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;

        // 后根据前排方法进行排序
        switch (currentSortMethod) {
            case 'name':
                return currentSortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            case 'date':
                if (!a.stats || !b.stats) return 0;
                return currentSortOrder === 'asc' ? a.stats.birthtime - b.stats.birthtime : b.stats.birthtime - a.stats.birthtime;
            case 'modified':
                if (!a.stats || !b.stats) return 0;
                return currentSortOrder === 'asc' ? a.stats.mtime - b.stats.mtime : b.stats.mtime - a.stats.mtime;
            case 'type':
                return currentSortOrder === 'asc' ? path.extname(a.name).localeCompare(path.extname(b.name)) : path.extname(b.name).localeCompare(path.extname(a.name));
            default:
                return 0;
        }
    });
}


// 获取文件图标结果
ipcRenderer.on('file-icon-result', (event, { base64, error }) => {
    if (error) {
        console.warn('获取文件图标时出错:', error);
    }
});


// 双击打开文件
fileListContainer.ondblclick = (e) => {
    if (e.target === fileListContainer || e.target === fileListElement) {
        const parentPath = path.dirname(currentPath)
        if (parentPath !== currentPath) {
            navigateTo(parentPath)
        }
    }
}

// 文件列表右键菜单点击事件
fileListContainer.addEventListener('contextmenu', (e) => {
    if (e.target === fileListContainer || e.target === fileListElement) {
        e.preventDefault();
        showContextMenu(null, currentPath);
    }
});

// 文件列表点击事件
fileListContainer.addEventListener('click', (e) => {
    if (e.target === fileListContainer || e.target === fileListElement) {
        if (selectedItem) {
            selectedItem.classList.remove('selected');
            selectedItem = null;
        }
        removeSelectionBox(); // 移除选择框
    }
})
// #endregion

// #region 文件-视图

// 添加时间轴视图按钮的事件监听器
timelineViewBtn.addEventListener('click', () => {
    setViewMode('timeline');
});


// 修改视图模式
function setViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('viewMode', mode);

    // 更新 file-list 的 class
    const fileList = document.getElementById('file-list');
    fileList.className = mode === 'list' ? 'file-list-list' :
        mode === 'group' ? 'file-list-group' :
            mode === 'timeline' ? 'file-list-timeline' : 'file-list-icons';

    // 添加类样式到 file-list-container
    const fileListContainer = document.getElementById('file-list-container');
    fileListContainer.className = mode === 'list' ? 'list-view' :
        mode === 'group' ? 'group-view' :
            mode === 'timeline' ? 'timeline-view' : 'icon-view';

    // 更新视图按钮的激活状态
    const viewButtons = document.querySelectorAll('#view-options button');
    viewButtons.forEach(button => {
        if (button.id === `${mode}-view-btn`) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    updateFileList(currentPath);
}

// 列表视图
listViewBtn.addEventListener('click', () => {
    updateFileList(currentPath); // 直接更新文件列表
    setViewMode('list');
});

// 图标视图
iconViewBtn.addEventListener('click', () => {
    updateFileList(currentPath); // 直接更新文件列表
    setViewMode('icon');
});

// 分组视图
groupViewBtn.addEventListener('click', () => {
    setViewMode('group');
    updateFileList(currentPath);
});

// 时间轴视图
timelineViewBtn.addEventListener('click', () => {
    setViewMode('timeline');
    updateFileList(currentPath);
});

// #endregion

// #region 快速访问

// 更新快速访问
function updateQuickAccess() {
    const quickAccessPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent'); // 快速访问路径
    // 快速访问路径
    fs.readdir(quickAccessPath, (err, files) => {
        if (err) {
            console.error('无法读快速访问目录:', err);
            return;
        }
        // 过滤并处理快捷方式
        Promise.all(files.filter(file => path.extname(file).toLowerCase() === '.lnk')
            .map(file => new Promise((resolve) => {
                const filePath = path.join(quickAccessPath, file);
                windowsShortcuts.query(filePath, (error, shortcut) => {
                    if (error) {
                        //   console.error('无法读取快捷方式:', error);
                        resolve(null);
                    } else {
                        let targetPath = shortcut.target;
                        if (Buffer.isBuffer(targetPath)) {
                            targetPath = iconv.decode(targetPath, 'gbk');
                        }
                        fs.stat(targetPath, (err, stats) => {
                            if (err || !stats.isDirectory()) {
                                resolve(null);
                            } else {
                                resolve({ path: targetPath, name: path.basename(targetPath) });
                            }
                        });
                    }
                });
            })))
            .then(quickAccessItems => {
                quickAccessItems = quickAccessItems.filter(item => item !== null);

                quickAccessElement.innerHTML = `
    <div class="sidebar-section-header" onclick="toggleSidebarSection('quick-access')">
    <i class="fas fa-chevron-down sidebar-section-icon"></i>
    <span>快速访问</span>
    </div>
    <div class="sidebar-section-content">
    ${quickAccessItems.slice(0, 10).map(item => `
        <div class="quick-access-item" data-path="${encodeURIComponent(item.path)}">
        <span class="file-icon">${folderIcon}</span>
        <span>${item.name}</span>
        </div>
    `).join('')}
    </div>
`;

                // 为快速访问项添加点击事件监听器
                const quickAccessElements = quickAccessElement.querySelectorAll('.quick-access-item');
                quickAccessElements.forEach(item => {
                    item.addEventListener('click', () => {
                        let filePath = decodeURIComponent(item.getAttribute('data-path'));
                        navigateTo(filePath);
                    });
                });
            });

    });

    // 在更新快速访问后，也更新"最近"标签
    updateRecentTab();
}
// #endregion

// #region 设置



// 当点击设置图标时，切换菜单的隐藏状态
settingsIcon.addEventListener('click', (e) => {
    settingsMenu.classList.toggle('hidden');
});


// 更新主题按钮文本
function updateThemeButtonText() {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    themeToggleButton.textContent = isDarkTheme ? '亮色主题' : '暗色主题';
}

// 切换主题按钮点击事件
themeToggleButton.addEventListener('click', () => {
    console.log('切换主题按钮被点击');
    document.body.classList.toggle('dark-theme');
    const isDarkTheme = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    console.log('当前主题：', isDarkTheme ? 'dark' : 'light');
    updateThemeButtonText();
});

// 在页面加载时应用保存的主题
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    updateThemeButtonText();
});

// 打开设置窗口
document.getElementById('open-settings').addEventListener('click', () => {
    ipcRenderer.send('open-settings');
});

// #endregion

// #region 工具栏-排序
// 排序
function sortGroupFiles(groupContent, sortType, isAscending) {
    const fileItems = Array.from(groupContent.children);
    fileItems.sort((a, b) => {
        let valueA, valueB;
        if (sortType === 'name') {
            valueA = a.querySelector('.file-name').textContent;
            valueB = b.querySelector('.file-name').textContent;
        } else if (sortType === 'date') {
            valueA = new Date(a.getAttribute('data-modified'));
            valueB = new Date(b.getAttribute('data-modified'));
        }

        if (valueA < valueB) return isAscending ? -1 : 1;
        if (valueA > valueB) return isAscending ? 1 : -1;
        return 0;
    });

    fileItems.forEach(item => groupContent.appendChild(item));
}

document.getElementById('sort-name').addEventListener('click', () => handleSortClick('name'));
document.getElementById('sort-date').addEventListener('click', () => handleSortClick('date'));
document.getElementById('sort-modified').addEventListener('click', () => handleSortClick('modified'));
document.getElementById('sort-type').addEventListener('click', () => handleSortClick('type'));

// 加排序按钮点击件处理函数
function handleSortClick(sortMethod) {
    if (currentSortMethod === sortMethod) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortMethod = sortMethod;
        currentSortOrder = 'asc';
    }
    updateFileList(currentPath);//更新文件列表
}


// #endregion

// #region 预览面板


previewResizer.addEventListener('mousedown', initPreviewResize);

// 初始化预览面板拖拽
function initPreviewResize(e) {
    isPreviewResizing = true; //开始调整
    lastPreviewX = e.clientX;
    document.addEventListener('mousemove', resizePreview);
    document.addEventListener('mouseup', stopPreviewResize);
}

// 调整预览面板大小
function resizePreview(e) {
    if (!isPreviewResizing) return;
    lastPreviewX = e.clientX;
    const newWidth = window.innerWidth - e.clientX;
    // console.log('e.clientX:', e.clientX, 'newWidth:', newWidth)
    if (newWidth >= 0 && newWidth < window.innerWidth - 400) {
        previewPanel.style.width = `${newWidth}px`;
    }
}

// 停止预览面板拖拽
function stopPreviewResize() {
    isPreviewResizing = false;
    document.removeEventListener('mousemove', resizePreview);
    document.removeEventListener('mouseup', stopPreviewResize);
}

// 预览视图
function updatePreview(file) {
    if (!file) {
        previewContent.innerHTML = '<p>没有选中文件</p>';
        return;
    }
    const filePath = path.join(currentPath, file.name);
    const fileExt = path.extname(file.name).toLowerCase();

    if (file.isDirectory) {
        fs.readdir(filePath, (err, files) => {
            if (err) {
                previewContent.innerHTML = `<p>无法读取文件夹内容: ${err.message}</p>`;
                return;
            }
            const fileList = files.slice(0, 10).map(f => `<li>${f}</li>`).join('');
            previewContent.innerHTML = `
                <h3>${file.name}</h3>
                <p>包含 ${files.length} 个项目</p>
                <ul>${fileList}</ul>
                ${files.length > 10 ? '<p>...</p>' : ''}
            `;
        });
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(fileExt)) {
        previewContent.innerHTML = `<img src="file://${filePath}" alt="${file.name}" style="max-width: 100%; max-height: 300px;">`;
    } else if (['.txt', '.md', '.js', '.html', '.css', '.tap', '.nc', '.ini', '.ts'].includes(fileExt)) {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                previewContent.innerHTML = `<p>无法读取文件内容: ${err.message}</p>`;
                return;
            }
            const highlightedCode = hljs.highlightAuto(data.slice(0, 1000)).value;
            previewContent.innerHTML = `<pre><code class="${fileExt.replace('.', '')}">${highlightedCode}</code></pre>`;
            if (data.length > 1000) {
                previewContent.innerHTML += '<p>...</p>';
            }
        });
    } else {
        previewContent.innerHTML = `
            <h3>${file.name}</h3>
            <p>类型: ${fileExt || '未知'}</p>
            <p>创建时间: ${formatDate(file.stats.birthtime)}</p>
            <p>修改时间: ${formatDate(file.stats.mtime)}</p>
        `;
    }
}

// #endregion

// #region 状态栏

// 更新状态栏
function updateStatusBar(filePath) {
    if (!filePath) {
        statusBarElement.textContent = '';
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err) {
            statusBarElement.textContent = `错误: ${err.message}`;
            return;
        }

        let statusText = '';

        if (statusBarDisplayOptions.showPath) {
            statusText += `路径: ${filePath} | `;
        }

        statusText += `名称: ${path.basename(filePath)}`;

        if (statusBarDisplayOptions.showType && !stats.isDirectory()) {
            statusText += ` | 类型: ${path.extname(filePath) || '文件'}`;
        }

        if (statusBarDisplayOptions.showSize) {
            statusText += ` | 大小: ${formatFileSize(stats.size)}`;
        }

        if (statusBarDisplayOptions.showDate) {
            statusText += ` | 修改日期: ${formatDate(stats.mtime)}`;
        }

        statusBarElement.textContent = statusText;
    });
}

// 添加新的函数来更新状态栏
function updateStatusBar(filePath) {
    if (!filePath) {
        statusBarElement.textContent = '';
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err) {
            statusBarElement.textContent = `错误: ${err.message}`;
            return;
        }

        let statusText = '';

        if (statusBarDisplayOptions.showPath) {
            statusText += `路径: ${filePath} | `;
        }

        statusText += `名称: ${path.basename(filePath)}`;

        if (statusBarDisplayOptions.showType && !stats.isDirectory()) {
            statusText += ` | 类型: ${path.extname(filePath) || '文件'}`;
        }

        if (statusBarDisplayOptions.showSize) {
            statusText += ` | 大小: ${formatFileSize(stats.size)}`;
        }

        if (statusBarDisplayOptions.showDate) {
            statusText += ` | 修改日期: ${formatDate(stats.mtime)}`;
        }

        statusBarElement.textContent = statusText;
    });
}

// 添加状态栏右键菜单
statusBarElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const options = [
        {
            label: '显示路径',
            checked: statusBarDisplayOptions.showPath
        },
        {
            label: '显示类型',
            checked: statusBarDisplayOptions.showType
        },
        {
            label: '显示大小',
            checked: statusBarDisplayOptions.showSize
        },
        {
            label: '显示日期',
            checked: statusBarDisplayOptions.showDate
        }
    ];

    ipcRenderer.send('show-status-bar-menu', options);
});

// 状态栏右键菜单点击事件
ipcRenderer.on('status-bar-menu-item-clicked', (event, label) => {
    switch (label) {
        case '显示路径':
            statusBarDisplayOptions.showPath = !statusBarDisplayOptions.showPath;
            break;
        case '显示类型':
            statusBarDisplayOptions.showType = !statusBarDisplayOptions.showType;
            break;
        case '显示大小':
            statusBarDisplayOptions.showSize = !statusBarDisplayOptions.showSize;
            break;
        case '显示日期':
            statusBarDisplayOptions.showDate = !statusBarDisplayOptions.showDate;
            break;
    }
    localStorage.setItem('statusBarDisplayOptions', JSON.stringify(statusBarDisplayOptions));
    updateStatusBar(currentPath);
});

// 状态栏拖拽事件
statusBar.addEventListener('mousedown', (e) => {
    const startY = e.clientY;
    const startHeight = parseInt(document.defaultView.getComputedStyle(statusBar).height, 10);

    function onMouseMove(e) {
        const newHeight = startHeight - e.clientY + startY;
        if (newHeight > 20 && newHeight < 40) {
            statusBar.style.height = `${newHeight}px`;
        }
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});

// #endregion

// #region 文件-空格预览

// 添加函数来显示文件夹预览
function showFolderPreview(folderPath, previewElement) {
    fs.readdir(folderPath, (err, files) => {
        if (err) {
            console.error('无法取目:', err)
            return
        }

        const previewItems = files.slice(0, 5)
        previewElement.innerHTML = previewItems.map(item => {
            const itemPath = path.join(folderPath, item).replace(/\\/g, '\\\\')
            return `<span class="preview-item" data-path="${itemPath}">${item}</span>`
        }).join('')

        // 为预览项添加点击事件
        previewElement.querySelectorAll('.preview-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation() // 阻止事件冒泡
                e.preventDefault() // 阻止默认行为
                const itemPath = e.target.getAttribute('data-path').replace(/\\\\/g, '\\')
                fs.stat(itemPath, (err, stats) => {
                    if (err) {
                        console.error('无法获取文件息:', err)
                        return
                    }
                    if (stats.isDirectory()) {
                        navigateTo(itemPath)
                    } else {
                        shell.openPath(itemPath)
                    }
                })
            })
        })
    })
}

// 处理空格键和ESC键事件
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault(); // 防止页面滚动
        const selectedItem = document.querySelector('.file-item.selected');
        if (selectedItem) {
            const filePath = selectedItem.getAttribute('data-path'); // 假设文件路径存储在data-path属性中
            if (isPreviewOpen) {
                hideFullscreenPreview(); // 如果预览已经打开，则关闭预览
                isPreviewOpen = false; // 更新状态
            } else {
                showFullscreenPreview(filePath); // 如果预览未打开，则打开预览
                isPreviewOpen = true; // 更新状态
            }
        }
    } else if (e.code === 'Escape') {
        isPreviewOpen = false;
        hideFullscreenPreview();

    } else if (e.code === 'ArrowRight') { // 右切换到下一张
        const nextItem = getNextSelectedItem();
        if (nextItem) {
            updateSelectedItem(nextItem); // 更新选中的项目
            const filePath = nextItem.getAttribute('data-path');
            showFullscreenPreview(filePath);
        }
    } else if (e.code === 'ArrowLeft') { // 左键切换到上一张
        const prevItem = getPreviousSelectedItem();
        if (prevItem) {
            updateSelectedItem(prevItem); // 更新选中的项目
            const filePath = prevItem.getAttribute('data-path');
            showFullscreenPreview(filePath);
        }
    }
});

// 更新选中的项目
function updateSelectedItem(newSelectedItem) {
    // 取消之前选中的项目
    document.querySelectorAll('.file-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    // 高亮当前选中的项目
    newSelectedItem.classList.add('selected');
}

// 获取下一个选中的项目
function getNextSelectedItem() {
    const selectedItems = document.querySelectorAll('.file-item.selected');
    if (selectedItems.length === 0) return null;
    const currentIndex = Array.from(selectedItems).indexOf(selectedItems[selectedItems.length - 1]);
    const nextIndex = (currentIndex + 1) % document.querySelectorAll('.file-item').length;
    return document.querySelectorAll('.file-item')[nextIndex];
}

// 获取上一个选中的项目
function getPreviousSelectedItem() {
    const selectedItems = document.querySelectorAll('.file-item.selected');
    if (selectedItems.length === 0) return null;
    const currentIndex = Array.from(selectedItems).indexOf(selectedItems[selectedItems.length - 1]);
    const prevIndex = (currentIndex - 1 + document.querySelectorAll('.file-item').length) % document.querySelectorAll('.file-item').length;
    return document.querySelectorAll('.file-item')[prevIndex];
}

// 图片缩放
document.addEventListener('wheel', (e) => {
    const img = review_content_fullscreen.querySelector('img');
    if (img) {
        e.preventDefault();
        const scale = e.deltaY < 0 ? 1.1 : 0.9; // 向上滚动放大，向下滚动缩小
        img.style.transform = `scale(${(parseFloat(img.style.transform.replace('scale(', '').replace(')', '')) || 1) * scale})`;
    }
});


// 显示全屏预览
function showFullscreenPreview(filePath) {
    const fileExt = path.extname(filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(fileExt)) {
        review_content_fullscreen.innerHTML = `<img src="file://${filePath}" alt="预览" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
    } else if (fileExt === '.pdf') {
        review_content_fullscreen.innerHTML = `<div class="preview-content"><iframe src="file://${filePath}" style="width: 100%; height: 100%; border: none;"></iframe></div>`;
    } else if (['.mp4', '.avi', '.mov'].includes(fileExt)) {
        review_content_fullscreen.innerHTML = `<video controls style="width: 100%; height: 100%;">
            <source src="file://${filePath}" type="video/${fileExt.replace('.', '')}">
            您的浏览器不支持 video 标签。
        </video>`;
    } else if (['.ppt', '.pptx', '.doc', '.docx'].includes(fileExt)) {
        const tempPdfPath = path.join(os.tmpdir(), `${path.basename(filePath, path.extname(filePath))}.pdf`);
        convertToPdf(filePath, tempPdfPath).then(() => {
            review_content_fullscreen.innerHTML = `<div class="preview-content"><iframe src="file://${tempPdfPath}" style="width: 100%; height: 100%; border: none;"></iframe></div>`;
        }).catch(err => {
            review_content_fullscreen.innerHTML = `<div class="preview-content"><p>无法转换文件: ${err.message}</p></div>`;
        });
    } else if (['.txt', '.md', '.ini'].includes(fileExt)) {
        // 处理文本文件
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                review_content_fullscreen.innerHTML = `<div class="preview-content"><p>无法读取文件: ${err.message}</p></div>`;
            } else {
                review_content_fullscreen.innerHTML = `<div class="preview-content"><pre>${data}</pre></div>`;
            }
        });
    } else if (['.js', '.vbs', '.ps1', '.reg', '.cmd', '.xml', '.au3', '.html', '.css', '.py', '.java', '.cpp', '.c', '.rb', '.ts', '.jsx', '.json'].includes(fileExt)) {
        // 处理代码文件
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                review_content_fullscreen.innerHTML = `<p>无法读取文件: ${err.message}</p>`;
            } else {
                const highlightedCode = hljs.highlightAuto(data).value; // 使用 highlight.js 进行高亮
                review_content_fullscreen.innerHTML = `<div class="preview-content"><pre><code class="${fileExt.replace('.', '')}">${highlightedCode}</code></pre></div>`;
            }
        });
    } else if (['.ttf', '.otf'].includes(fileExt)) {
        // 处理字体文件
        const fontName = path.basename(filePath, path.extname(filePath)); // 获取字体名称
        const encodedPath = encodeURIComponent(filePath).replace(/%5C/g, '/'); // 对路径进行编码并替换反斜杠为正斜杠

        // 调试信息：打印字体名称和编码后的路径
        console.log(`字体名称: ${fontName}`);
        console.log(`编码后的路径: ${encodedPath}`);

        const fontFace = new FontFace(fontName, `url(file://${encodedPath})`);

        fontFace.load().then(() => {
            document.fonts.add(fontFace);
            // 创建字体预览内容
            review_content_fullscreen.innerHTML = `
            <div style="font-family: '${fontName}'; text-align: center;">
                <h1 style="font-size: 48px;">${fontName}</h1>
                <h2 style="font-size: 36px;">Font Preview</h2>
                <p style="font-size: 24px;">中文测试: 你好，世</p>
                <p style="font-size: 24px;">English Test: Hello, World!</p>
                <p style="font-size: 24px;">数字测试: 1234567890</p>
            </div>
        `;
        }).catch(err => {
            // 调试信息：打印错误信息
            console.error('字体加载失败:', err);
            review_content_fullscreen.innerHTML = `<p>无法加载字体: ${err.message}</p>`;
        });
    } else if (fileExt === '.psd') {
        // 处理PSD文件
        console.log(`尝试打开PSD文件: ${filePath}`); // 添加调试信

        // 将 PSD 转换为 PNG 并保存到临时目录，然后读取并转换为 Base64
        PSD.open(filePath).then(function (psdData) {
            const tempFilePath = path.join(os.tmpdir(), 'output_temp_image.png');

            // 保存 PNG 文件到临时目录
            return psdData.image.saveAsPng(tempFilePath).then(() => {
                // 读取保存的 PNG 文件并转换为 Base64
                const imageBuffer = fs.readFileSync(tempFilePath);
                const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

                // 将 Base64 图片插入到页面中显示
                review_content_fullscreen.innerHTML = `<img src="${base64Image}" alt="PSD预览" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;

                // 删除临时文件（可选）
                fs.unlinkSync(tempFilePath);
            });
        }).catch(err => {
            console.error('处理PSD文件时出错:', err);
            review_content_fullscreen.innerHTML = `<p>无法读取PSD文件: ${err.message}</p>`;
        });

    } else {
        review_content_fullscreen.innerHTML = `<p>无法预览此文件类型</p>`;
    }
    fullscreen_preview.style.display = 'block';
}


// 添加转换函数
function convertToPdf(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const file = fs.readFileSync(inputPath);
        libre.convert(file, '.pdf', undefined, (err, result) => {
            if (err) {
                return reject(err);
            }
            fs.writeFileSync(outputPath, result);
            // 清理临时文件
            const tempDir = path.dirname(inputPath); // 获取临时目录

            // 调试信息：列出临时目录中的文件
            console.log(`临时目录: ${tempDir}`);
            fs.readdir(tempDir, (err, files) => {
                if (err) {
                    console.error('读取临时目录时出错:', err);
                } else {
                    console.log('临时目录中的文件:', files);
                }
            });

            // 使用 setTimeout 延迟删除
            setTimeout(() => {
                fsExtra.remove(tempDir) // 使用 fs-extra 的 remove 方法
                    .then(() => {
                        console.log(`成功删除临时目录: ${tempDir}`);
                        resolve();
                    })
                    .catch(removeErr => {
                        console.error('清理临时目录时出错:', removeErr);
                        resolve(); // 继续执行，即使清理失败
                    });
            }, 1000); // 延迟 1 秒
        });
    });
}


// 隐藏全屏预览
function hideFullscreenPreview() {
    fullscreen_preview.style.display = 'none';
}

// 关闭预览按钮
document.getElementById('close-preview').addEventListener('click', hideFullscreenPreview);


// #endregion

// #region 地址栏

// 地址栏焦点事件
function handlePathFocus() {
    pathElement.select()  // 选中全部文本
}

// 地址栏失去焦点事件
function handlePathBlur() {
    pathElement.value = currentPath  // 失去焦点时恢复为完整路径
}

// 地址栏事件监听器
pathElement.addEventListener('focus', handlePathFocus)
pathElement.addEventListener('blur', handlePathBlur)

// 导航到新路径
function navigateTo(newPath) {
    if (!newPath) {
        console.error('无效的路径');
        return;
    }

    newPath = newPath.replace(/\\\\/g, '\\');
    if (process.platform === 'win32' && newPath.length === 2 && newPath[1] === ':') {
        newPath += '\\';  // 确保驱动器路径以反斜杠结尾
    }

    fs.access(newPath, fs.constants.R_OK, (err) => {
        if (err) {
            console.error('访问目录:', err);
            return;
        }
        fs.stat(newPath, (err, stats) => {
            if (err) {
                console.error('无法获取文件/目录信息:', err);
                return;
            }
            if (stats.isDirectory()) {
                if (!newPath.endsWith(path.sep)) {
                    newPath += path.sep;
                }
                history = history.slice(0, currentHistoryIndex + 1);
                history.push(currentPath);
                currentHistoryIndex++;
                currentPath = newPath;
                updateFileList(newPath);
                pathElement.value = newPath;
            } else {
                shell.openPath(newPath);
            }
        });
    });
}

// 添加地址栏输入跳转功能
pathElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        navigateTo(pathElement.value)
    }
})

// #endregion

// #region 左栏-驱动器

// 显示驱动器
function showDrives() {
    const drives = [];
    const desktopPath = path.join(os.homedir(), 'Desktop');
    let downloadsPath;

    // 获取实际的下载文件夹路径
    if (process.platform === 'win32') {
        try {
            // 使用注册表获取下载文件夹路径
            const result = execSync('reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders" /v "{374DE290-123F-4565-9164-39C4925E467B}"', { encoding: 'buffer' });
            const match = iconv.decode(result, 'cp936').match(/REG_SZ\s+(.+)/);
            if (match) {
                downloadsPath = match[1].trim();
            } else {
                throw new Error('无法从注册表获取下载文件夹路径');
            }
        } catch (error) {
            console.error('无法获取下载文件夹路径:', error);
            downloadsPath = path.join(os.homedir(), 'Downloads'); // 回退到默认路径
        }
    } else {
        downloadsPath = path.join(os.homedir(), 'Downloads'); // 非Windows系统使用默认路径
    }

    // 添加桌面文件夹
    drives.push({ letter: 'Desktop', path: desktopPath, name: '桌面', icon: '<i class="fas fa-desktop"></i>' });

    // 添加下载文件夹
    drives.push({ letter: 'Downloads', path: downloadsPath, name: '下载', icon: '<i class="fas fa-download"></i>' });

    if (process.platform === 'win32') {
        for (let i = 65; i <= 90; i++) {
            const driveLetter = String.fromCharCode(i);
            if (fs.existsSync(`${driveLetter}:`)) {
                const drivePath = `${driveLetter}:\\`;
                let volumeName = '';
                try {
                    const volOutputBuffer = execSync(`vol ${driveLetter}:`);
                    const volOutput = iconv.decode(volOutputBuffer, 'gbk');
                    const volumeNameMatch = volOutput.match(/驱动器\s+\w+\s+中的卷是\s+(.+)/);

                    if (volumeNameMatch && volumeNameMatch[1]) {
                        volumeName = volumeNameMatch[1].trim();
                    }
                } catch (error) {
                    console.error(`无法获取驱动器 ${driveLetter}: 的卷标名称`, error);
                }
                drives.push({ letter: driveLetter, path: drivePath, name: volumeName, icon: driveIcon });
            }
        }
    } else {
        drives.push({ letter: '/', path: '/', name: 'Root', icon: driveIcon });
    }

    drivesElement.innerHTML = `
    <div class="sidebar-section-header" onclick="toggleSidebarSection('drives')">
      <i class="fas fa-chevron-down sidebar-section-icon"></i>
      <span>此电脑</span>
    </div>
    <div class="sidebar-section-content">
      ${drives.map(drive => `
        <div class="drive-item" data-path="${drive.path}">
          <span class="file-icon">${drive.icon}</span>
          <span>${drive.name || 'Local Disk'} ${!['Desktop', 'Downloads'].includes(drive.letter) ? `(${drive.letter}:)` : ''}</span>
        </div>
      `).join('')}
    </div>
  `;

    // 为每个驱动器项添加点击事件监听器
    document.querySelectorAll('.drive-item').forEach(item => {
        item.addEventListener('click', () => {
            const drivePath = item.getAttribute('data-path');
            navigateTo(drivePath);
        });
    });
}

updateFavorites() // 更新收藏夹
showDrives() // 显示驱动器
updateQuickAccess() // 新快速访问
// #endregion





// 防抖函数
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

// 创建一个防抖版本的 updateRecentTab 函数
const debouncedUpdateRecentTab = debounce(updateRecentTab, 1000); // 1秒延迟