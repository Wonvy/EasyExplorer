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


let currentPath = ''
const pathElement = document.createElement('input')
pathElement.id = 'path'
pathElement.type = 'text'
document.querySelector('#main').insertBefore(pathElement, document.querySelector('#path-container'))
const fileListElement = document.getElementById('file-list')
if (!fileListElement) {
    console.error('无法找到 file-list 元素');
}
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

const fileListContainer = document.getElementById('file-list-container')

const previewPanel = document.getElementById('preview-panel')
const previewToggle = document.getElementById('preview-toggle')
const previewResizer = document.getElementById('preview-resizer')
const previewContent = document.getElementById('preview-content')

let history = []
let currentHistoryIndex = -1
let favorites = JSON.parse(localStorage.getItem('favorites')) || []

// 加载自定义图标
let customIcons = {};
fs.readFile(path.join(__dirname, 'icons.json'), 'utf8', (err, data) => {
    if (err) {
        console.error('无法加载图标文件:', err);
        return;
    }
    customIcons = JSON.parse(data);
});


const favoriteIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" ><path d="M23.9986 5L17.8856 17.4776L4 19.4911L14.0589 29.3251L11.6544 43L23.9986 36.4192L36.3454 43L33.9586 29.3251L44 19.4911L30.1913 17.4776L23.9986 5Z" fill="#333" stroke="#333" stroke-width="4" stroke-linejoin="round"/></svg>`
const driveIconsvg1 = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M44 29H4V42H44V29Z" fill="#333" stroke="#333" stroke-width="4" stroke-linejoin="round"/><path d="M4 28.9998L9.03837 4.99902H39.0205L44 28.9998" stroke="#333" stroke-width="4" stroke-linejoin="round"/><path d="M19 12C16.2386 12 14 14.2386 14 17C14 19.7614 16.2386 22 19 22" stroke="#333" stroke-width="4" stroke-linecap="round"/><path d="M29 22C31.7614 22 34 19.7614 34 17C34 14.2386 31.7614 12 29 12" stroke="#333" stroke-width="4" stroke-linecap="round"/><path d="M20 17H28" stroke="#333" stroke-width="4" stroke-linecap="round"/></svg>`
const driveIcon = `<img src="./assets/icons/driveIcon.png" />`
const folderIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f1c40f"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 1.99 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`
const fileIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3498db"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2h16c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`
const backIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ffffff"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`
const forwardIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>`
const upIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ffffff"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>`


let isGroupView = false; // 是否为分组视图

// 修改视图模相关的变量和函数
let currentViewMode = localStorage.getItem('viewMode') || 'list';


// 修改视图模式
function setViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('viewMode', mode);
    // console.log('View mode set to:', mode);
    
    // 更新 file-list 的 class
    const fileList = document.getElementById('file-list');
    fileList.className = mode === 'list' ? 'file-list-list' : mode === 'group' ? 'file-list-group' : 'file-list-icons'; // 修改这一行

    // 添加类样式到 file-list-container
    const fileListContainer = document.getElementById('file-list-container');
    fileListContainer.className = mode === 'list' ? 'list-view' : mode === 'group' ? 'group-view' : 'icon-view'; // 修改这一行

    // 更新视图按钮的激活状态
    const viewButtons = document.querySelectorAll('#view-options button');
    viewButtons.forEach(button => {
        console.log('mode', mode);
        if (button.id === `${mode}-view-btn`) {
            button.classList.add('active'); // 添加激活类
        } else {
            button.classList.remove('active'); // 移除激活类
        }
    });


    updateFileList(currentPath);
}


// 添加地址栏输入跳转功能
pathElement.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        navigateTo(pathElement.value)
    }
})

// 修改 updateFileList 函数中的文件图标逻辑
function getFileIcon(file) {
    return new Promise((resolve) => {
        const isDir = typeof file.isDirectory === 'function' ? file.isDirectory() : file.isDirectory;
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
            const encodedPath = encodeURIComponent(filePath).replace(/%5C/g, '/'); // 对路径进行编码并替换反斜杠为正斜杠
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
                    您的浏览器不支持 video 标签。
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
            const unknownSvg = getUnknownIcon(ext); // 使用新函数
            resolve(unknownSvg);
        }
    });
}

function getUnknownIcon(ext, defaultIcon = '.unknown') {
    return customIcons[ext] || customIcons[defaultIcon].replace('XXX', ext.replace(".", ""));
}


// 在文件顶部添加一个新的变量来跟踪选中的项目
let selectedItem = null;

// 修改 updateFileList 函中的事件监听器部分
function updateFileList(dirPath, isQuickAccess = false) {
 
    fileListElement.innerHTML = ''; 
    updatePreview(null); 

    fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
        if (err) {
            console.error('无法读取目录:', err);
            fileListElement.innerHTML = `<div class="error-message">无法读取目录: ${err.message}</div>`;
            return;
        }


        if (!isQuickAccess) {
            currentPath = dirPath;
            pathElement.value = dirPath;
        }

        // 取文件详细信息并排序
        Promise.all(files.map(file => getFileDetails(dirPath, file)))
            .then(fileDetails => {
                sortFiles(fileDetails);
                fileListElement.innerHTML = '';
                if (isGroupView) {
                    const groupedFiles = groupFilesByType(fileDetails);
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
                } else{
                    fileDetails.forEach(file => {
                        const fileItem = createFileItem(file, dirPath);
                        fileListElement.appendChild(fileItem);
                    });

                }
            })
            .catch(error => {
                console.error('获取文件详情时出错:', error);
                fileListElement.innerHTML = `<div class="error-message">获取文件详情时出错: ${error.message}</div>`;
            });
    });

    fileListContainer.addEventListener('mousedown', handleMouseDown);
    fileListContainer.addEventListener('mousemove', handleMouseMove);
    fileListContainer.addEventListener('mouseup', handleMouseUp);
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
                resolve({
                    name: file.name,
                    isDirectory: stats.isDirectory(),
                    stats: stats
                });
            }
        });
    });
}

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
            console.error('无法访问目录:', err);
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
      updateStatusBar('');
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

// 显示驱动器
function showDrives() {
  const drives = [];
  if (process.platform === 'win32') {
    for (let i = 65; i <= 90; i++) {
      const driveLetter = String.fromCharCode(i);
      if (fs.existsSync(`${driveLetter}:`)) {
        const drivePath = `${driveLetter}:\\`;
        let volumeName = '';
        try {
          const volOutputBuffer = execSync(`vol ${driveLetter}:`);
          const volOutput = iconv.decode(volOutputBuffer, 'gbk');
        //   console.warn('卷标内容', '|' + volOutput + '|');
          
          // 更新正则表达式匹配模式
          const volumeNameMatch = volOutput.match(/驱动器\s+\w+\s+中的卷是\s+(.+)/);
          
          if (volumeNameMatch && volumeNameMatch[1]) {
            volumeName = volumeNameMatch[1].trim();
          }
        //   console.warn('volumeName', volumeName);   
        } catch (error) {
          console.error(`无法获取驱动器 ${driveLetter}: 的卷标名称`, error);
        }
        drives.push({ letter: driveLetter, path: drivePath, name: volumeName });
      }
    }
  } else {
    drives.push({ letter: '/', path: '/', name: 'Root' });
  }


  drivesElement.innerHTML = `
    <div class="sidebar-section-header" onclick="toggleSidebarSection('drives')">
      <i class="fas fa-chevron-down sidebar-section-icon"></i>
      <span>此电脑</span>
    </div>
    <div class="sidebar-section-content">
      ${drives.map(drive => `
        <div class="drive-item" data-path="${drive.path}">
          <span class="file-icon">${driveIcon}</span>
          <span>${drive.name || 'Local Disk'} (${drive.letter}:)</span>
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

// 显示快速访问
function updateQuickAccess() {
    const quickAccessPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Recent')
    console.log('quickAccessPath:', quickAccessPath);
    fs.readdir(quickAccessPath, (err, files) => {
        if (err) {
            console.error('无法读取快速访问目录:', err)
            return
        }
        // 过滤并处理快捷方式
        Promise.all(files.filter(file => path.extname(file).toLowerCase() === '.lnk')
            .map(file => new Promise((resolve) => {
                const filePath = path.join(quickAccessPath, file);
                windowsShortcuts.query(filePath, (error, shortcut) => {
                    if (error) {
                        console.error('无法读取快捷方式:', error);
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
    })
}

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





// 修改 ipcRenderer.on('menu-item-clicked') 事件处理
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
                pasteFile(currentPath, filePath); // 将文件粘贴到当前路径
            });
            updateFileList(currentPath); // 更新文件列表以显示新粘贴的文件
        }

  }
});


// 复制文件
function copyFile(filePaths) {
    // 判断 filePaths 是否为字符串，如果是则转换为数组
    if (typeof filePaths === 'string') {
        filePaths = [filePaths]; // 将字符串包装在数组中
    }

    clipboardEx.writeFilePaths(filePaths); // 将 filePaths 写入剪贴板
    const copiedPaths = clipboardEx.readFilePaths();
    console.log('filePath:', copiedPaths);
}

ipcRenderer.on('copy-progress', (data) => {
    // 解析进度信息并更新进度条
    console.log('复制进度:', data);
    // 更新进度条的逻辑
});


// 粘贴文件
function pasteFile(targetDir, source) {
    const fileName = path.basename(source);
    const destination = path.join(targetDir, fileName);

    fs.copyFile(source, destination, (err) => {
        if (err) {
            console.error('复制文件时出错:', err);
        } else {
            console.log(`文件已粘贴到: ${destination}`);
            // updateFileList(targetDir); // 更新文件列表
        }
    });
}



// 添加以下函数来处理左侧面板的展开/折叠
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

// 修改 updateFavorites, showDrives, 和 updateQuickAccess 数
function updateFavorites() {
  favoritesElement.innerHTML = `
    <div class="sidebar-section-header" onclick="toggleSidebarSection('favorites')">
      <i class="fas fa-chevron-down sidebar-section-icon"></i>
      <span>收藏夹</span>
    </div>
    <div class="sidebar-section-content">
      ${favorites.map(fav => `
        <div class="favorite-item" data-path="${fav.replace(/\\/g, '\\')}" onclick="navigateTo('${fav.replace(/\\/g, '\\\\')}')">
          <span class="file-icon">${favoriteIcon}</span>
          <span>${path.basename(fav)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

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
}

// 修改 openQuickAccessItem 函数
function openQuickAccessItem(filePath) {
  console.warn('openQuickAccessItem:', filePath);
  console.log('openQuickAccessItem:', filePath);
  fs.stat(filePath, (err, stats) => {
    if (err) {
      console.error('无法获取文件信息:', err);
      return;
    }
    if (stats.isDirectory()) {
      updateFileList(filePath, true);
    } else {
      shell.openPath(filePath);
    }
  });
}


updateFavorites() // 更新收藏夹
showDrives() // 显示驱动器
updateQuickAccess() // 新快速访问

// 添加以下函数来处理地址栏的焦点
function handlePathFocus() {
    pathElement.select()  // 选中全部文本
}

function handlePathBlur() {
    pathElement.value = currentPath  // 失去焦点时恢复为完整路径
}

// 在文件部添加以下事件监听器
pathElement.addEventListener('focus', handlePathFocus)
pathElement.addEventListener('blur', handlePathBlur)

// 在文件末尾添加以下代码
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const main = document.getElementById('main');
let isResizing = false;
let lastX = 0;




// 拖拽-左栏
resizer.addEventListener('mousedown', initResize);

function initResize(e) { // 初始化拖拽排序
    isResizing = true;
    resizer.classList.add('resizing');
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'none';
}

function resize(e) {
    if (!isResizing) return;
    requestAnimationFrame(() => {
        const newWidth = e.clientX < 0 ? 1 : e.clientX; // 修改这一行
        console.log('e.clientX', e.clientX);
        console.log('window.innerWidth', window.innerWidth);

        if (newWidth > 0 && newWidth < window.innerWidth) {
            sidebar.style.width = `${newWidth}px`;
        }
    });
}

function stopResize() {
    isResizing = false;
    resizer.classList.remove('resizing');
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.userSelect = '';
}




// 修改现有的 sidebarToggle 件监听器
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


// 在 updateFileList 函件的末加以下代码
fileListContainer.ondblclick = (e) => {
    if (e.target === fileListContainer || e.target === fileListElement) {
        const parentPath = path.dirname(currentPath)
        if (parentPath !== currentPath) {
            navigateTo(parentPath)
        }
    }
}

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
                        console.error('无法获取文件信息:', err)
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

// 添加一个点击事件监听器到 fileListContainer，用于取消选择
fileListContainer.addEventListener('click', (e) => {
    if (e.target === fileListContainer || e.target === fileListElement) {
        if (selectedItem) {
            selectedItem.classList.remove('selected');
            selectedItem = null;
        }
        removeSelectionBox(); // 移除选择框
    }
})

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


// 在 updateFileList 函件末尾添加以下代码
fileListContainer.addEventListener('contextmenu', (e) => {
    if (e.target === fileListContainer || e.target === fileListElement) {
        e.preventDefault();
        showContextMenu(null, currentPath);
    }
});

// 在件顶部添加以下变
let currentSortMethod = 'name';
let currentSortOrder = 'asc';

// 修改 updateFileList 函件
function updateFileList(dirPath, isQuickAccess = false) {
    fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
        if (err) {
            // console.error('无法读取目录:', err)
            return
        }

        if (!isQuickAccess) {
            currentPath = dirPath
            pathElement.value = dirPath
        }
        // 清空 fileListElement 的 HTML 内容
        fileListElement.innerHTML = ''; // 修改这一行
        updatePreview(null);  // 添加这一行

        // 获取文件详细信息并排序
        Promise.all(files.map(file => getFileDetails(dirPath, file)))
            .then(fileDetails => {
                sortFiles(fileDetails);
                fileListElement.innerHTML = '';

                if (isGroupView) {
                    const groupedFiles = groupFilesByType(fileDetails);
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
                } else{
                    fileDetails.forEach(file => {
                        const fileItem = createFileItem(file, dirPath);
                        fileListElement.appendChild(fileItem);
                    });

                }

            })
            .catch(error => {
                console.error('获取文件详情时出错:', error);
            });
    });

    fileListContainer.addEventListener('mousedown', handleMouseDown);
    fileListContainer.addEventListener('mousemove', handleMouseMove);
    fileListContainer.addEventListener('mouseup', handleMouseUp);
}


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

// 添加以下新函数
function getFileDetails(dirPath, file) {
    return new Promise((resolve) => {
        const filePath = path.join(dirPath, file.name);
        fs.stat(filePath, (err, stats) => {
            if (err) {
                // console.warn(`无法获文件 ${filePath} 的详细信息: ${err.message}`);
                resolve({
                    name: file.name,
                    isDirectory: file.isDirectory(),
                    stats: null,
                    error: err.code
                });
            } else {
                resolve({
                    name: file.name,
                    isDirectory: stats.isDirectory(),
                    stats: stats
                });
            }
        });
    });
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

        // 最后根据前排序方法进行排序
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

// 修改 createFileItem 函件
function createFileItem(file, dirPath) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    if (file.error) {
        fileItem.classList.add('error');
    }

 
    fileItem.setAttribute('data-path', path.join(dirPath, file.name)); // 确保设置 data-path

    const icon = document.createElement('span');
    icon.className = 'file-icon';

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;

    // 获取文件图标
    getFileIcon(file).then(iconHtml => {
        icon.innerHTML = iconHtml;
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
            }
        });

        // 右键菜单
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
            });

            fileItem.addEventListener('mouseout', () => {
                updateStatusBar(currentPath);
                updatePreview(null);
            });
        }
    }

    return fileItem;
}

// 添加这些辅助函数
function formatFileSize(size) {
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
    if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' MB';
    return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(date) {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// 加排序按钮点击件处理函数
function handleSortClick(sortMethod) {
    if (currentSortMethod === sortMethod) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortMethod = sortMethod;
        currentSortOrder = 'asc';
    }
    updateFileList(currentPath);
}

document.getElementById('sort-name').addEventListener('click', () => handleSortClick('name'));
document.getElementById('sort-date').addEventListener('click', () => handleSortClick('date'));
document.getElementById('sort-modified').addEventListener('click', () => handleSortClick('modified'));
document.getElementById('sort-type').addEventListener('click', () => handleSortClick('type'));

function debug(message) {
    console.log(`[DEBUG] ${message}`);
}

// 在文件底部添加
document.addEventListener('DOMContentLoaded', () => {
    let initialPath;
    if (process.platform === 'win32') {
        initialPath = process.env.USERPROFILE || 'C:\\';
    } else {
        initialPath = process.env.HOME || '/';
    }

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
});

// 添加 removeFromFavorites 函数
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

// 添加新函数来显示收藏夹项的右键菜单
function showFavoriteContextMenu(favPath, x, y) {
  ipcRenderer.send('show-favorite-context-menu', { path: favPath, x, y });
}

// 在文件底部添加以下事件监听器
ipcRenderer.on('favorite-menu-item-clicked', (event, action, path) => {
  switch (action) {
    case 'remove-from-favorites':
      removeFromFavorites(path);
      break;
  }
});

// 在件底部添加以下代码来置事件监听器
document.addEventListener('DOMContentLoaded', () => {
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

    // 设置序按钮事件
    document.getElementById('sort-name').addEventListener('click', () => handleSortClick('name'));
    document.getElementById('sort-date').addEventListener('click', () => handleSortClick('date'));
    document.getElementById('sort-modified').addEventListener('click', () => handleSortClick('modified'));
    document.getElementById('sort-type').addEventListener('click', () => handleSortClick('type'));

    // 初始化文件列表
    const initialPath = process.platform === 'win32' ? 'C:\\' : '/';
    updateFileList(initialPath);

    // 更新侧边栏内容
    updateFavorites();//更新收藏夹
    showDrives();//显示驱动器
    updateQuickAccess();//更新快速访问
});

// 在文件底部添加以下代码
ipcRenderer.on('file-icon-result', (event, { base64, error }) => {
    if (error) {
        console.warn('获取文件图标时出错:', error);
    }
});





// 预览面板拖拽
let isPreviewResizing = false;
let lastPreviewX = 0;

previewResizer.addEventListener('mousedown', initPreviewResize);

function initPreviewResize(e) {
    isPreviewResizing = true; //开始调整
    lastPreviewX = e.clientX;
    document.addEventListener('mousemove', resizePreview);
    document.addEventListener('mouseup', stopPreviewResize);
}
function resizePreview(e) {
    if (!isPreviewResizing) return;
    lastPreviewX = e.clientX;
    const newWidth = window.innerWidth  - e.clientX;
    // console.log('e.clientX:', e.clientX, 'newWidth:', newWidth)
    if (newWidth >= 0 && newWidth < window.innerWidth - 400) {
        previewPanel.style.width = `${newWidth}px`;
    }
}
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
    } else if (['.ttf', '.otf'].includes(fileExt)) {
        const fontName = path.basename(filePath, path.extname(filePath)); // 获取字体名称
        const encodedPath = encodeURIComponent(filePath).replace(/%5C/g, '/'); // 对路径进行编码并替换反斜杠为正斜杠
        const fontFace = new FontFace(fontName, `url(file://${encodedPath})`);

        fontFace.load().then(() => {
            document.fonts.add(fontFace);
            previewContent.innerHTML = `
            <div style="font-family: '${fontName}'; text-align: center;">
                <h1 style="font-size: 48px;">${fontName}</h1>
                <h2 style="font-size: 36px;">Font Preview</h2>
                <p style="font-size: 24px;">中文测试: 你好，世界！</p>
                <p style="font-size: 24px;">English Test: Hello, World!</p>
                <p style="font-size: 24px;">数字测试: 1234567890</p>
            </div>
        `;
        }).catch(err => {
            previewContent.innerHTML = `<p>无法加载字体: ${err.message}</p>`;
        });
    
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(fileExt)) {
        previewContent.innerHTML = `<img src="file://${filePath}" alt="${file.name}" style="max-width: 100%; max-height: 300px;">`;
    
    } else if (['.txt', '.md', '.js', '.html', '.css', '.tap', '.nc', '.ini', '.ts'].includes(fileExt)) {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                previewContent.innerHTML = `<p>无法读取文件内容: ${err.message}</p>`;
                return;
            }
            // ${ data.slice(0, 1000) }${ data.length > 1000 ? '...' : '' }
            const highlightedCode = hljs.highlightAuto(data).value; 
            previewContent.innerHTML = ` <pre><code class="${fileExt.replace('.', '')}">${highlightedCode}</code></pre>`;
           
        });
    } else {
        previewContent.innerHTML = `<p>无法预览此类型的文件</p>`;
    }
}

// 列表视图
listViewBtn.addEventListener('click', () => {
    isGroupView = false;
    updateFileList(currentPath); // 直接更新文件列表
    setViewMode('list');
});

// 图标视图
iconViewBtn.addEventListener('click', () => {
    isGroupView = false;
    updateFileList(currentPath); // 直接更新文件列表
    setViewMode('icon');
});

// 分组视图
groupViewBtn.addEventListener('click', () => {
    setViewMode('group');
    isGroupView = !isGroupView;
    updateFileList(currentPath);
});



// 在文件顶部添加新的常量
let statusBarDisplayOptions = JSON.parse(localStorage.getItem('statusBarDisplayOptions')) || {
    showPath: true,
    showType: true,
    showSize: true,
    showDate: true
};

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


const statusBar = document.getElementById('status-bar');

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



let isSelecting = false;
let selectionBox = null;
let startX, startY;

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

// 移除选择框
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

// 添加设置图标的事件监听器
const settingsIcon = document.getElementById('settings');
const settingsMenu = document.getElementById('settings-menu');

// 当点击设置图标时，切换菜单的隐藏状态
settingsIcon.addEventListener('click', () => {
    settingsMenu.classList.toggle('hidden');
});

// 主题切换功能
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
});

// 打开设置窗口
document.getElementById('open-settings').addEventListener('click', () => {
    // 这里可以实现打开设置窗口的逻辑
    console.log('打开设置窗口');
});


// 全屏窗口

let fullscreen_preview = document.getElementById('fullscreen-preview');
let review_content_fullscreen = document.getElementById('preview-content-fullscreen');
let isPreviewOpen = false; // 添加一个变量来跟踪预览状态


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

// 处理鼠标滚轮事件以放大缩小图片
document.addEventListener('wheel', (e) => {
    const img = review_content_fullscreen.querySelector('img');
    if (img) {
        e.preventDefault();
        const scale = e.deltaY < 0 ? 1.1 : 0.9; // 向上滚动放大，向下滚动缩小
        img.style.transform = `scale(${(parseFloat(img.style.transform.replace('scale(', '').replace(')', '')) || 1) * scale})`;
    }
});



// 修改 showFullscreenPreview 函数
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
                <p style="font-size: 24px;">中文测试: 你好，世界！</p>
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
        console.log(`尝试打开PSD文件: ${filePath}`); // 添加调试信息
        
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

// 将 buffer 转换为 Base64 格式
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// 将 Buffer 转换为 Base64
function bufferToBase64(buffer) {
    return buffer.toString('base64');
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