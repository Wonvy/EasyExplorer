// #region 库
const fs = require('fs')
const path = require('path')
const { shell, ipcRenderer, clipboard } = require('electron')
const os = require('os')
const { execSync, exec } = require('child_process')  // 修改这行，添加 exec
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
let currentSortMethod = 'name';// 
let currentSortOrder = 'asc';// 排序顺序
let isPreviewResizing = false; // 预览面板拖拽

// 添加新的全局变量
let lastHoveredPath = ''; // 最后划过的文件/文件夹路径
let lastClickedPath = ''; // 最后点击的文件/文件夹路径

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

// 在文件顶部的变量声明区域添加以下变量
let isCalendarView = false;
let currentCalendarYear;
let currentCalendarMonth;
let isFromCalendar = false; // 添加标记变量

const occtimportjs = require('occt-import-js'); 

// 在文件中添加以下新函数
function toggleCalendarView() {
    const now = new Date();
    currentCalendarYear = now.getFullYear();
    currentCalendarMonth = now.getMonth();
    showCalendarView();
}

// 显示日历视图
function showCalendarView() {
  const now = new Date();
  currentCalendarYear = currentCalendarYear || now.getFullYear(); // 如果未设置年份，则使用当前年份
  currentCalendarMonth = currentCalendarMonth !== undefined ? currentCalendarMonth : now.getMonth();

  // 从项置中获取当前年份的项目路径
  const projectPaths = JSON.parse(localStorage.getItem('projectPaths') || '{}');
  const yearPath = projectPaths[currentCalendarYear.toString()];

  if (!yearPath) {
      alert(`设置 ${currentCalendarYear} 年的项目文件夹。请在设置中配置项目文件夹路径。`);
    //   fileListContainer.innerHTML = `
    //   <div class="calendar-error">
    //     未置 ${currentCalendarYear} 年的项目文件夹。
    //     请在设置中配置项目文件夹路径。
    //   </div>`;
    return;
  }

  const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
  const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

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

  console.log('当前月份文件夹路径:', monthFolderPath);
  // 获取当月所有项目文件夹
  let monthFolders = [];
  try {
    if (fs.existsSync(monthFolderPath)) {
      const files = fs.readdirSync(monthFolderPath);
      
      monthFolders = files.map(name => {
        const fullPath = path.join(monthFolderPath, name);
        const stats = fs.statSync(fullPath);
        
        // 尝试从文件夹名称获取日期
        const dateMatch = name.match(/^(\d{4})/);
        let day;
        
        if (dateMatch && !isNaN(parseInt(dateMatch[1]))) {
          // 如果文件夹名称符合格式，使用名称中的日期
          day = parseInt(dateMatch[1].substring(2));
        } else {
          // 如果不符合格式，使用创建时间
          const createDate = new Date(stats.birthtime);
          // 有当创建时间在当前月份时才使用
          if (createDate.getMonth() === currentCalendarMonth && 
              createDate.getFullYear() === currentCalendarYear) {
            day = createDate.getDate();
          }
        }

        return {
          name: name,
          day: day,
          path: fullPath,
          createTime: stats.birthtime
        };
      }).filter(folder => folder.day !== undefined); // 过滤掉没有有效日期的文件夹
      
      // 按创建时间排序，确保同一天的文件夹按时间顺序显示
      monthFolders.sort((a, b) => a.createTime - b.createTime);
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
          ${dayFolders.map(folder => `
            <div class="folder-item" data-path="${folder.path}" title="${folder.name}">
              <span class="folder-icon">${folderIcon}</span>
              <span class="folder-name">${folder.name.match(/^(\d{4})/) ? folder.name.substring(5) : folder.name}</span>
            </div>
          `).join('')}
        </div>
        <div class="add-folder-icon" title="添加新文件夹">
          <i class="fas fa-plus"></i>
        </div>
      </div>
    `;
  }

  calendarHTML += '</div></div>';
  fileListElement.innerHTML = calendarHTML;

  // 添加事件监听器
  document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => changeMonth(1));
  document.getElementById('today-button').addEventListener('click', goToToday);

  // 为文件夹添加点击事件
  document.querySelectorAll('.folder-item').forEach(item => {

    // 修改双击事件为直接打开文件夹
    item.addEventListener('dblclick', (e) => {
        console.log('dblclick', e);
        e.stopPropagation();// 阻止事件冒泡
      const folderPath = item.getAttribute('data-path');
      if (folderPath) {
        console.log('打开文件夹:', folderPath);
        shell.openPath(folderPath); // 使用 shell.openPath 直接打开文件夹
      }
    });

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      // 移除其他文件夹的选中状态
      document.querySelectorAll('.folder-item.selected').forEach(folder => {
        folder.classList.remove('selected');
      });
      // 添加选中状态到当前文件夹
      item.classList.add('selected');
    });


    item.addEventListener('mouseover', (e) => {
      pathElement.value = item.getAttribute('data-path'); // 更新路径输入框的值 
      lastHoveredPath = item.getAttribute('data-path'); // 更新最后划过的路径
    });

  });

  // 修改事件监听器的添加方式
  const calendarControls = document.getElementById('calendar-controls');
  if (calendarControls) {
    calendarControls.addEventListener('wheel', handleCalendarScroll);
  }

  // 移除整个 fileListElement 的滚轮事件监听
  fileListElement.removeEventListener('wheel', handleCalendarScroll);
}

// 跳转到今天
function goToToday() {
  const today = new Date();
  currentCalendarYear = today.getFullYear();
  currentCalendarMonth = today.getMonth();
  showCalendarView();
}

// 切换月份
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

// 修改 handleCalendarScroll 函数
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

            // 当前
            activeTab = tabName;
            localStorage.setItem('activeTab', activeTab);
        });
    });

    // 加载保存的选项卡状态
    activeTab = localStorage.getItem('activeTab') || 'folders';
    const activeTabButton = document.querySelector(`.tab-button[data-tab="${activeTab}"]`);
    if (activeTabButton) {
        activeTabButton.click();
    }

    // 项目理标签页的件监听器
    document.getElementById('custom-projects').addEventListener('click', () => {
        console.log('项目按钮被点击');
    });

    document.getElementById('custom-calendar').addEventListener('click', toggleCalendarView);

    // 添加年报按钮点击事件监听
    const annualReportBtn = document.getElementById('custom-annual-report');
    if (annualReportBtn) {
        annualReportBtn.addEventListener('click', () => {
            console.log('年报按钮被点击');
            showAnnualReport();
        });
    } else {
        console.error('未找到年报按钮元素');
    }
});


let currentReportYear = new Date().getFullYear();

// 在文件顶部添加新的变量
let lastViewState = {
    view: '',
    year: null,
    path: ''
};

// 修改 showAnnualReport 函数，保存状态
function showAnnualReport() {
    const projectPaths = JSON.parse(localStorage.getItem('projectPaths') || '{}');
    let yearPath = projectPaths[currentReportYear.toString()];

    // 如当前年份没有文件夹，则跳转到有文件夹的
    if (!yearPath) {
        console.warn('未找到当前年份的目路径:', currentReportYear);
        return
        // 寻找最近的有文件夹的年份
        let closestYear = currentReportYear;
        while (!yearPath) {
            closestYear--;// 向前寻找
            yearPath = projectPaths[closestYear.toString()];
        }
        console.log('跳转到最近的有文件夹的年份:', closestYear);
        currentReportYear = closestYear;
    }

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

    fileListElement.innerHTML = annualReportHTML;

    // 添加控按钮事件监听
    document.getElementById('prev-year').addEventListener('click', () => {
        changeReportYear(-1);
    });
    document.getElementById('next-year').addEventListener('click', () => {
        changeReportYear(1);
    });

    // 加载年度数据
    loadAnnualData(yearPath);

    // 添加滚轮事件监听
    const timeline = document.querySelector('.annual-timeline');
    if (timeline) {
        let isMouseDown = false;
        let lastX = 0;

        // 鼠标按下事件
        timeline.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            timeline.style.cursor = 'grabbing';
            lastX = e.pageX;
        });

        // 鼠标移动事件 - 改为实时移
        timeline.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            e.preventDefault();
            
            // 计算鼠标移动的距离
            const deltaX = e.pageX - lastX;
            // 更新滚动位置
            timeline.scrollLeft -= deltaX;
            // 更新最后的标位置
            lastX = e.pageX;
        });

        // 鼠标释放事件
        timeline.addEventListener('mouseup', () => {
            isMouseDown = false;
            timeline.style.cursor = 'grab';
        });

        // 鼠标离开事件
        timeline.addEventListener('mouseleave', () => {
            isMouseDown = false;
            timeline.style.cursor = 'grab';
        });

        // 滚轮事件保持不变
        timeline.addEventListener('wheel', (e) => {
            if (!e.ctrlKey && !e.target.closest('.month-content')) {
                e.preventDefault();
                timeline.scrollLeft += e.deltaY;
            }
        }, { passive: false });

        // 设置初始光标样式
        timeline.style.cursor = 'grab';
    }

    // 保存年报视图状态
    lastViewState = {
        view: 'annual-report',
        year: currentReportYear,
        path: yearPath
    };
    localStorage.setItem('lastViewState', JSON.stringify(lastViewState));
}

function generateMonthsTimeline() {
    const months = ["一月", "二", "三月", "四月", "月", "六月", 
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

// 加载年度数据
function loadAnnualData(yearPath) {
    console.log('开始加载年度数据:', yearPath);

    for (let month = 1; month <= 12; month++) {
        const monthPath = path.join(yearPath, `${month}月`);
        console.log('检月份路径:', monthPath);

        try {
            if (fs.existsSync(monthPath)) {
                console.log(`读取 ${month} 月数据`);
                const files = fs.readdirSync(monthPath);
                const monthProjects = document.querySelector(`#month-${month} .month-projects`);

                if (!monthProjects) {
                    console.error(`未找到月份容器: month-${month}`);
                    continue;
                }

                monthProjects.innerHTML = files.map(file => {
                    const filePath = path.join(monthPath, file);
                    const stats = fs.statSync(filePath);
                    
                    // 获取文件夹内最新修时间
                    let lastModified = stats.mtime;
                    try {
                        const subFiles = fs.readdirSync(filePath);
                        subFiles
                            .filter(subFile => subFile.toLowerCase() !== 'thumbs.db')
                            .forEach(subFile => {
                                const subFilePath = path.join(filePath, subFile);
                                try {
                                    const subStats = fs.statSync(subFilePath);
                                    if (subStats.mtime > lastModified) {
                                        lastModified = subStats.mtime;
                                    }
                                } catch (err) {
                                    console.warn(`无法取状态: ${subFilePath}`, err);
                                }
                            });
                    } catch (err) {
                        console.warn(`读取子文夹失败: ${filePath}`, err);
                    }

                    return `
                        <div class="project-item" data-path="${filePath}">
                            <span class="project-icon">${folderIcon}</span>
                            <div class="project-info">
                                <span class="project-name">${file}</span>
                                <div class="project-dates">
                                    <span class="create-date">创建: ${stats.birthtime.toLocaleDateString()}</span>
                                    <span class="modify-date">修改: ${stats.mtime.toLocaleDateString()}</span>
                                </div>
                                <div class="last-modified-date" style="display: none;">
                                    最后更新: ${lastModified.toLocaleDateString()} ${lastModified.toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                // 为每个项目添加鼠标件
                monthProjects.querySelectorAll('.project-item').forEach(item => {
                    const filePath = item.getAttribute('data-path');
                    let lastActiveProject = null; // 记录最后点击的项目
                    let hoverTimer = null; // 添加定时器变量

                    // 双击事件 - 在资源管理器中打开
                    item.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        shell.showItemInFolder(filePath);
                    });

                    // 单击事件 - 立即显示预览和高亮
                    item.addEventListener('click', () => {
                        // 清除任何正在进行的悬停定时器
                        if (hoverTimer) {
                            clearTimeout(hoverTimer);
                            hoverTimer = null;
                        }

                        // 移除其他项目的高亮状态
                        document.querySelectorAll('.project-item.active').forEach(p => {
                            p.classList.remove('active');
                        });
                        
                        // 添加当前项目的高亮状态
                        item.classList.add('active');
                        lastActiveProject = filePath;
                        
                        // 立即更新预览区域
                        updateProjectPreview(filePath);
                    });

                    // 鼠标进入事件 - 延迟预览
                    item.addEventListener('mouseenter', () => {
                        // 更新地址栏和状态栏
                        pathElement.value = filePath;
                        lastHoveredPath = filePath; // 更新最后划过的路径
                        updateStatusBar(filePath);
                        
                        // 如果不是当前高亮的项目，设置延迟预览
                        if (!item.classList.contains('active')) {
                            // 清之的定时器
                            if (hoverTimer) {
                                clearTimeout(hoverTimer);
                            }
                            // 设新的定时器
                            hoverTimer = setTimeout(() => {
                                updateProjectPreview(filePath);
                            }, 600); // 1秒延迟
                        }
                    });

                    // 鼠标离开事件
                    item.addEventListener('mouseleave', () => {
                        // 清除定时器
                        if (hoverTimer) {
                            clearTimeout(hoverTimer);
                            hoverTimer = null;
                        }

                        // 恢复地址栏和状态栏
                        pathElement.value = currentPath;
                        updateStatusBar(currentPath);
                    });
                });

                // 为预览区添加鼠标进事件
                const previewContent = document.querySelector('.preview-content');
                previewContent.addEventListener('mouseenter', () => {
                    // 恢复到最后点击的项目的预览
                    const activeItem = document.querySelector('.project-item.active');
                    if (activeItem) {
                        const activePath = activeItem.getAttribute('data-path');
                        updateProjectPreview(activePath);
                    }
                });
            } else {
                console.log(`${month} 月份文件夹不存在`);
            }
        } catch (err) {
            console.error(`读取 ${month} 月数据时出错:`, err);
        }
    }
}

function changeReportYear(delta) {
    currentReportYear += delta;
    console.log('切换到年份:', currentReportYear);
    showAnnualReport();
}

// 添加新函数：更新项目预览
let previewCache = new Map(); // 添加缓存

// 修改 updateProjectPreview 函数，添加事件委托
function updateProjectPreview(projectPath) {
    if (!projectPath) return;

    const previewHeader = document.querySelector('.preview-header .preview-title');
    const previewContent = document.querySelector('.preview-content');
    const projectName = path.basename(projectPath);
    previewHeader.textContent = projectName;

    // 移除旧的事件监听器
    previewContent.removeEventListener('click', handlePreviewContentClick);
    previewContent.removeEventListener('dblclick', handlePreviewContentDblClick);
    previewContent.removeEventListener('mouseover', handlePreviewContentMouseOver);
    previewContent.removeEventListener('mouseout', handlePreviewContentMouseOut);
    previewContent.removeEventListener('keydown', handlePreviewContentKeyDown);

    // 添加新的事件监听器
    previewContent.addEventListener('click', handlePreviewContentClick);
    previewContent.addEventListener('dblclick', handlePreviewContentDblClick);
    previewContent.addEventListener('mouseover', handlePreviewContentMouseOver);
    previewContent.addEventListener('mouseout', handlePreviewContentMouseOut);
    previewContent.addEventListener('keydown', handlePreviewContentKeyDown);

    // 检查缓存
    if (previewCache.has(projectPath)) {
        previewContent.innerHTML = previewCache.get(projectPath);
        return;
    }

    // 读取项目文件夹内容
    fs.readdir(projectPath, { withFileTypes: true }, (err, files) => {
        if (err) {
            previewContent.innerHTML = `<div class="error">无法读取文件夹内容: ${err.message}</div>`;
            return;
        }

        Promise.all(files.map(file => getFileDetails(projectPath, file)))
            .then(fileDetails => {
                fileDetails.sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });

                const content = fileDetails.map(file => {
                    const filePath = path.join(projectPath, file.name);
                    return `
                        <div class="file-item" data-path="${filePath}" tabindex="0">
                            <span class="file-icon">${file.isDirectory ? folderIcon : getUnknownIcon(path.extname(file.name))}</span>
                            <span class="file-name">${file.name}</span>
                            <span class="file-size">${formatFileSize(file.stats?.size)}</span>
                        </div>
                    `;
                }).join('');

                previewCache.set(projectPath, content);
                previewContent.innerHTML = content;
            });
    });
}

// 事件处理函数
function handlePreviewContentClick(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) return;

    e.stopPropagation();
    const filePath = fileItem.getAttribute('data-path');
    console.log('点击文件项:', filePath);

    // 除其他文件的选中状态
    fileItem.closest('.preview-content').querySelectorAll('.file-item.selected')
        .forEach(item => {
            if (item !== fileItem) {
                item.classList.remove('selected');
            }
        });

    // 切换当前文件的选中状态
    fileItem.classList.toggle('selected');
}

function handlePreviewContentDblClick(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) return;

    e.stopPropagation();
    const filePath = fileItem.getAttribute('data-path');
    console.log('双击打开文件:', filePath);
    shell.openPath(filePath);
    debouncedUpdateRecentTab();
}

function handlePreviewContentMouseOver(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) return;
    
    const filePath = fileItem.getAttribute('data-path');
    lastHoveredPath = filePath; // 更新最后划过的路径
    updateStatusBar(filePath);
}

function handlePreviewContentMouseOut(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem) return;

    console.log('鼠标离开');
    updateStatusBar(currentPath);
}

function handlePreviewContentKeyDown(e) {
    const fileItem = e.target.closest('.file-item');
    if (!fileItem || e.code !== 'Space') return;

    e.preventDefault();
    const filePath = fileItem.getAttribute('data-path');
    console.log('空格键预览:', filePath);
    showFullscreenPreview(filePath);
}


// 添加新函数：格式化文件大小
function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

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
                                    stats: stats
                                });
                            }
                        });
                    }
                });
            })))
            .then(recentItems => {
                recentItems = recentItems.filter(item => item !== null);
                
                // 按访问时间排序，最新的排在前面
                recentItems.sort((a, b) => b.stats.atime - a.stats.atime);

                const timelineContainer = document.createElement('div');
                timelineContainer.className = 'timeline-container';

                let currentDate = null;

                recentItems.forEach(item => {
                    const itemDate = item.stats.atime.toDateString();
                    
                    if (itemDate !== currentDate) {
                        currentDate = itemDate;
                        const dateHeader = document.createElement('div');
                        dateHeader.className = 'timeline-date-header';
                        dateHeader.innerHTML = `
                            <span class="date-text">${formatDate(item.stats.atime)}</span>
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
                            <span class="file-icon">${item.isDirectory ? folderIcon : getUnknownIcon(path.extname(item.name))}</span>
                            <div class="file-info">
                                <span class="file-name">${item.name}</span>
                                <span class="file-parent-dir">${item.parentDir}</span>
                                <div class="file-time">
                                    <span>访问: ${formatTime(item.stats.atime)}</span>
                                    <span>修改: ${formatTime(item.stats.mtime)}</span>
                                </div>
                            </div>
                        </div>
                    `;

                    // 添加事件监听器
                    timelineItem.addEventListener('click', () => {
                        navigateTo(item.path);
                    });

                    timelineItem.addEventListener('mouseover', () => {
                        lastHoveredPath = item.path;
                        updateStatusBar(item.path);
                        updatePreview({
                            name: item.name,
                            isDirectory: item.isDirectory,
                            stats: item.stats
                        });
                    });

                    timelineItem.addEventListener('mouseout', () => {
                        updateStatusBar('');
                        updatePreview(null);
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

// 添加格式化日期的��数
function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('zh-CN', options);
}

// 添加格式化时间的函数
function formatTime(date) {
    const options = { hour: '2-digit', minute: '2-digit' };
    return date.toLocaleTimeString('zh-CN', options);
}



// 在应用程序关闭前保存当前路径和选项卡状态
window.addEventListener('beforeunload', () => {
    try {
        // 保存当前路径和选项卡状态
        localStorage.setItem('lastOpenedPath', currentPath);
        localStorage.setItem('activeTab', activeTab);
        
        // 保存所有分组相关的数据
        localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
        localStorage.setItem('folderOrder', JSON.stringify(folderOrder));
        localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
        localStorage.setItem('groupColors', JSON.stringify(groupColors));
        localStorage.setItem('groupOrder', JSON.stringify(groupOrder));
        
        console.log('保存所有数据成功:', {
            folderGroups,
            folderOrder,
            groupCollapseStates,
            groupColors,
            groupOrder
        });
    } catch (error) {
        console.error('保存数据失败:', error);
    }
});

// #endregion

// #region 通用函数-文件

// 制文件
function copyFile(filePaths) {
    // 判断 filePaths 是否为符串，如果是则转换为数组
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
            console.error('复制件出错:', err);
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
    // 更新进度的辑
});



// #endregion

// #region 布局-整

// 侧栏换
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
function initResize(e) { // 初始化拖拽排
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

// 侧栏切
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
        previewPanel.style.width = '250px';  // 或者使用上次调的宽度
    } else {
        previewPanel.classList.add('collapsed');
        previewPanel.style.width = '0';
    }
});

// #endregion

// #region 右键菜单

// 右键菜单-左
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

// 收夹右键菜单
ipcRenderer.on('favorite-menu-item-clicked', (event, action, path) => {
    switch (action) {
        case 'remove-from-favorites':
            removeFromFavorites(path);
            break;
    }
});

// 显示上下文菜单
function showContextMenu(file, dirPath) {
    const filePath = file ? path.join(dirPath, file.name) : dirPath;
    const isDirectory = file ? (typeof file.isDirectory === 'function' ? file.isDirectory() : file.isDirectory) : true;
    const isFavorite = favorites.includes(filePath);

    const params = {
        isDirectory: isDirectory,
        path: filePath,
        isCurrentDir: !file,
        isFavorite: isFavorite,
        hasSelection: !!file
    };

    ipcRenderer.send('show-context-menu', params);
}

// 右键菜单点击事件
ipcRenderer.on('menu-item-clicked', (event, action, data) => {
    console.log('Menu action:', action, 'Data:', data); // 添加调试日志

    switch (action) {
        case '在资源管理器中打开':
            if (data && data.path) {
                shell.showItemInFolder(data.path);
            }
            break;

        case '移出分组':
            if (data && data.groupName && data.path) {
                removeFromGroup(data.groupName, data.path);
            }
            break;

        case '设置颜色':
            if (data && data.groupName) {
                showColorPicker(data.groupName);
            }
            break;

        case '重命名':
            if (data && data.groupName) {
                showRenameDialog(data.groupName);
            }
            break;

        case '删除分组':
            if (data && data.groupName) {
                deleteGroup(data.groupName);
            }
            break;

        case '添加收藏夹':
            if (data && data.path) {
                addToFavorites(data.path);
            }
            break;

        default:
            console.log('未处理的菜单动作:', action);
            break;
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
                        <span>访问: ${formatDate(file.stats.atime)}</span>
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
                lastHoveredPath = path.join(currentPath, file.name); // 更新最后划的路径
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
    const parentPath = path.dirname(currentPath);
    
    if (isFromCalendar) {
        // 如果是从日历视图跳转来的，返回日历视图
        isFromCalendar = false; // 重置标记
        showCalendarView();
    } else if (parentPath !== currentPath) {
        navigateTo(parentPath);
    } else if (process.platform === 'win32' && /^[A-Z]:$/.test(currentPath)) {
        showDrives();
    }
});

// #endregion

// #region 文件选

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

// 在通用函数区域添加格式化文件大小的数
function formatFileSize(size) {
    if (size === undefined || size === null) return '未知';
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
    if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' MB';
    return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}



// 选择框开始
function handleMouseDown(e) {
    if (e.button !== 0) return; // 只处理左键点击
    const target = e.target;


    // 检查是否在文件项
    if (target.classList.contains('file-item') || target.closest('.file-item')) {
        // console.log('文件上:', target.closest('.file-item').getAttribute('data-path'));
        // // 如果在文件项上，开始拖拽
        // const filePath = target.closest('.file-item').getAttribute('data-path'); // 获取文径
        // const fileData = [Buffer.from(fs.readFileSync(filePath))];
        // e.dataTransfer.setData('text/uri-list', `file://${filePath}`);
        // e.dataTransfer.effectAllowed = 'copy';  // 设置拖拽效果
    } else if (!target.closest('.annual-report-container')) {
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

// 更收藏夹
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

    // 为收藏项添加右键菜和鼠标移入事件
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
            lastHoveredPath = favPath; // 更新最后划过的路径
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

// #region 文-文件列表



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
            const encodedPath = encodeURIComponent(filePath).replace(/%5C/g, '/'); // 对路径进编码并替换反斜杠为正斜杠
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

                // 将图和文件名添加到文件项
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
                    的浏览器不支持 audio 标签。
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
    lastClickedPath = ''; // 重置最后点击的路径
    lastHoveredPath = ''; // 置最后划过路径
    fileListElement.innerHTML = '';
    updatePreview(null);
    
    fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
        if (err) {
            console.error('无法取目录:', err, dirPath);
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
            console.error(`获文件 ${file.name} 详情时出错: ${err}`);
            return null; // 如果获取详情失败，返回null以跳该文件
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

                                // 更新排钮的状态
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
                // fileListElement.innerHTML = `<div class="error-message">获取文件详情出错: ${error.message}</div>`;
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

    // 加拖拽事件监听器
    fileItem.setAttribute('draggable', true); // 使元素可拖拽
    fileItem.addEventListener('dragstart', (e) => {
        e.preventDefault();
        const filePath = path.join(dirPath, file.name); // 确保路格式正确
        const fileData = [new File([fs.readFileSync(filePath)], file.name, { type: 'application/octet-stream' })];

        // 设置拖拽格式为 Files，Photoshop 需要文件句柄来识别
        e.dataTransfer.setData('text/uri-list', `file://${filePath}`);
        e.dataTransfer.effectAllowed = 'copy';  // 设置拖效果
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
                const filePath = path.join(dirPath, file.name);
                lastHoveredPath = filePath; // 更新最后划过的路径
                updateStatusBar(filePath);
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
                console.warn(`无法获取件 ${filePath} 的详细信息: ${err.message}`);
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

        // 根据行排
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


// 获标结果
ipcRenderer.on('file-icon-result', (event, { base64, error }) => {
    if (error) {
        console.warn('获取文件图标时出错:', error);
    }
});  // 这里有语法错误，应该是 }) 而不是 };


// 双击打开文件
fileListContainer.ondblclick = (e) => {
    if (e.target === fileListContainer || e.target === fileListElement) {
        if (isFromCalendar) {
            // 如果是从日历视图跳转来的，返回日历视图
            isFromCalendar = false; // 重置标记
            showCalendarView();
        } else {
            // 正常的向上导航逻辑
            const parentPath = path.dirname(currentPath);
            if (parentPath !== currentPath) {
                navigateTo(parentPath);
            }
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
        lastClickedPath = ''; // 重置最后击的路径
        lastHoveredPath = ''; // 重置最后划过的路径
        if (selectedItem) {
            selectedItem.classList.remove('selected');
            selectedItem = null;
        }
        removeSelectionBox();
    }
});
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

                // 为快访问项添加击事件监听器
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
    console.log('切换主按钮被点击');
    document.body.classList.toggle('dark-theme');
    const isDarkTheme = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    console.log('当前主题：', isDarkTheme ? 'dark' : 'light');
    updateThemeButtonText();
});

// 在页面加载时应用保存的题
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

// 整预览面板大小
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
                <p>创建时间: ${formatDate(file.stats.birthtime)}</p>
                <p>改时间: ${formatDate(file.stats.mtime)}</p>
            `;
        });
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(fileExt)) {
        previewContent.innerHTML = `
            <img src="file://${filePath}" alt="${file.name}" style="max-width: 100%; max-height: 300px;">
            <p>大小: ${formatFileSize(file.stats.size)}</p>
            <p>创建时间: ${formatDate(file.stats.birthtime)}</p>
            <p>修改时间: ${formatDate(file.stats.mtime)}</p>
        `;
    } else if (['.txt', '.md', '.js', '.html', '.css', '.tap', '.nc', '.ini', '.ts'].includes(fileExt)) {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                previewContent.innerHTML = `<p>无法读取文件内容: ${err.message}</p>`;
                return;
            }
            const highlightedCode = hljs.highlightAuto(data.slice(0, 1000)).value;
            previewContent.innerHTML = `
                <pre><code class="${fileExt.replace('.', '')}">${highlightedCode}</code></pre>
                ${data.length > 1000 ? '<p>...</p>' : ''}
                <p>小: ${formatFileSize(file.stats.size)}</p>
                <p>创建时间: ${formatDate(file.stats.birthtime)}</p>
                <p>修改时间: ${formatDate(file.stats.mtime)}</p>
            `;
        });
    } else {
        previewContent.innerHTML = `
            <h3>${file.name}</h3>
            <p>类型: ${fileExt || '未知'}</p>
            <p>大小: ${formatFileSize(file.stats.size)}</p>
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

// 添加新的函数更新状态栏
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

// 添加态栏右键菜单
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

// 状态栏右键菜单击事件
ipcRenderer.on('status-bar-menu-item-clicked', (event, label) => {
    switch (label) {
        case '显示路径':
            statusBarDisplayOptions.showPath = !statusBarDisplayOptions.showPath;
            break;
        case '显示类型':
            statusBarDisplayOptions.showType = !statusBarDisplayOptions.showType;
            break;
        case '显大小':
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

// 处理空格键和ESC键事件
document.addEventListener('keydown', (e) => {
    // 检查是否正在编辑分组名称
    const isEditingGroupName = document.activeElement.classList.contains('group-name');
    
    if (e.code === 'Space' && !isEditingGroupName) { // 添加判断条件
        e.preventDefault(); // 防止页面滚动
        if (lastHoveredPath && fs.existsSync(lastHoveredPath)) {
            if (isPreviewOpen) {
                hideFullscreenPreview();
                isPreviewOpen = false;
            }
            showFullscreenPreview(lastHoveredPath);
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
            updateSelectedItem(prevItem); // 新选中的项目
            const filePath = prevItem.getAttribute('data-path');
            showFullscreenPreview(filePath);
        }
    }
});

// 更新选中的项目
function updateSelectedItem(newSelectedItem) {
    // 取消之前选的项目
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


// 在文件-空格预览部分修改 showFullscreenPreview 函数
function showFullscreenPreview(filePath) {
    // 获取预览设置
    const previewSettings = JSON.parse(localStorage.getItem('previewSettings') || '{}');
    const fileExt = path.extname(filePath).toLowerCase();

    // 检查是否使用 Seer 预览
    if (previewSettings.mode === 'seer') {
        const fileTypes = previewSettings.fileTypes || [];
        // 检查文件类型是否在 Seer 预览列表中
        if (fileTypes.includes(fileExt.replace('.', ''))) {
            openWithSeer(filePath, previewSettings.seerPath);
            return;
        }
    }


    // 如果不使用 Seer 或文件类型不在列表中，使用默认预览
    showDefaultPreview(filePath, fileExt);
}

// 封装调用 Seer 的函数
function openWithSeer(filePath, seerPath) {
    if (seerPath && fs.existsSync(seerPath)) {
        exec(`"${seerPath}" "${filePath}"`, (error) => {
            if (error) {
                console.log('启动 Seer 失败:', error);
                console.log('错误信息:', error.message); 
            }
        });
        return true; // 成功调用 Seer
    }
    return false; // Seer 路径无效
}


// 添加默认预览函数
function showDefaultPreview(filePath, fileExt) {
    isPreviewOpen = true;
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

        // 调试信息：打印字体名称和编后的路径
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

    } else if (fileExt === '.dwg') {
        // 处理 DWG 文件预览
    } else if (fileExt === '.step' || fileExt === '.stp') {
        // 创建预览容器
        const container = document.createElement('div');
        container.style.width = '100%';
        container.style.height = '100%';
        review_content_fullscreen.innerHTML = '';
        review_content_fullscreen.appendChild(container);

        // 添加加载提示
        const loadingDiv = document.createElement('div');
        loadingDiv.style.position = 'absolute';
        loadingDiv.style.top = '50%';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translate(-50%, -50%)';
        loadingDiv.style.color = '#fff';
        loadingDiv.textContent = '加载中...';
        container.appendChild(loadingDiv);

        

        occtimportjs().then((occt) => {
            let fileUrl = filePath;
            let fileContent = fs.readFileSync(fileUrl);
            console.log('fileContent',fileContent)
            let result = occt.ReadStepFile(fileContent);
            console.log('result', result);
        }).catch(err => {
            console.error('加载STEP文件出错:', err);
            loadingDiv.remove();
            container.innerHTML = `
                <div class="error-message">
                    <p>加载STEP文件失败</p>
                    <p>${err.message}</p>
                </div>
            `;
        });



    } else {
        const previewSettings = JSON.parse(localStorage.getItem('previewSettings') || '{}');
        openWithSeer(filePath, previewSettings.seerPath);
        return;
        
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
            console.log(`inputPath: ${inputPath}`);
            console.log(`outputPath: ${outputPath}`);
            console.log(`临时目录: ${tempDir}`);
            // fs.readdir(tempDir, (err, files) => {
            //     if (err) {
            //         console.error('读取临时目录时出错:', err);
            //     } else {
            //         console.log('临时目录中的文件:', files);
            //     }
            // });

            //使用 setTimeout 延迟删除
            // setTimeout(() => {
            //     fsExtra.remove(tempDir) // 使用 fs-extra 的 remove 方法
            //         .then(() => {
            //             console.log(`成功删除临时目录: ${tempDir}`);
            //             resolve();
            //         })
            //         .catch(removeErr => {
            //             console.error('清理临时目录时出错:', removeErr);
            //             resolve(); // 续行，即使清失败
            //         });
            // }, 1000); // 延迟 1 秒
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
    pathElement.select()  // 选中全文本
}

// 地址栏失去焦点事件
function handlePathBlur() {
    pathElement.value = currentPath  // 失去焦点时恢复完整路径
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

    console.log('尝试导航到:', newPath); // 添加调试日志

    newPath = newPath.replace(/\\\\/g, '\\');
    if (process.platform === 'win32' && newPath.length === 2 && newPath[1] === ':') {
        newPath += '\\';  // 确保驱动器路径以反斜杠结尾
    }

    // 检查路径是否存在
    if (!fs.existsSync(newPath)) {
        console.error('路径不存在:', newPath);
        return;
    }

    fs.access(newPath, fs.constants.R_OK, (err) => {
        if (err) {
            console.error('无法访问目录:', err);
            return;
        }
        fs.stat(newPath, (err, stats) => {
            if (err) {
                console.error('无法获取件/目录信息:', err);
                return;
            }
            if (stats.isDirectory()) {
                if (!newPath.endsWith(path.sep)) {
                    newPath += path.sep;
                }
                
                // 检查目录是否为空
                fs.readdir(newPath, (err, files) => {
                    if (err) {
                        console.error('读取目录失败:', err);
                        return;
                    }

                    console.log('目录内容:', files); // 添加调试日志

                    if (files.length === 0 && isFromCalendar) {
                        // 如果是目录且是从日历跳转来的，返回到日历视图
                        isFromCalendar = false; // 重置标记
                        showCalendarView();
                    } else {
                        // 正常导航逻辑
                        history = history.slice(0, currentHistoryIndex + 1);
                        history.push(currentPath);
                        currentHistoryIndex++;
                        currentPath = newPath;
                        updateFileList(newPath);
                        pathElement.value = newPath;
                    }
                });
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
            console.error('法获取下载件夹路径:', error);
            downloadsPath = path.join(os.homedir(), 'Downloads'); // 回退到默认路径
        }
    } else {
        downloadsPath = path.join(os.homedir(), 'Downloads'); // 非Windows系统使用默认路径
    }

    // 添加桌面文件夹
    drives.push({ letter: 'Desktop', path: desktopPath, name: '桌面', icon: '<i class="fas fa-desktop"></i>' });

    // 添加下载文件夹
    drives.push({ letter: 'Downloads', path: downloadsPath, name: '下载', icon: '<i class="fas fa-download"></i>' });

    // 磁盘
    if (process.platform === 'win32') {

        // 获取本地驱动器
        for (let i = 65; i <= 90; i++) {
            const driveLetter = String.fromCharCode(i);// 获取驱动器字母
            // 检查驱动器是否存在
            if (fs.existsSync(`${driveLetter}:`)) {
                const drivePath = `${driveLetter}:\\`;
                let volumeName = '';
                let isNetworkDrive = false; // 新增量判断是否网络驱动器
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

                // 检查是否为网络驱动器
                try {
                    const stats = fs.statSync(drivePath);
                    isNetworkDrive = !stats.isDirectory(); // 如果不是目录，则可能是网络驱动器
                } catch (error) {
                    console.error(`无法获取驱动器 ${driveLetter}: 的信息`, error);
                }

                drives.push({ letter: driveLetter, path: drivePath, name: volumeName, icon: driveIcon, isNetwork: isNetworkDrive });
            }
        }

        // 获取映射驱动器
        try {
            const output = execSync('net use').toString();
            const lines = output.split('\n');
            lines.forEach(line => {
                const match = line.match(/([A-Z]:)\s+([^\s]+)/);
                if (match) {
                    const driveLetter = match[1];
                    const mappedPath = match[2];
                    drives.push({ letter: driveLetter, path: mappedPath, type: 'mapped' });
                }
            });
        } catch (error) {
            console.error('获取映射驱动器时出错:', error);
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
          <span>${drive.name || 'Local Disk'} ${!['Desktop', 'Downloads'].includes(drive.letter) ? `(${drive.letter}:)` : ''} ${drive.isNetwork ? '(网络驱动器)' : ''}</span>
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

// 添加创建文件夹对话框函数
function showCreateFolderDialog(year, month, day) {
  const projectPaths = JSON.parse(localStorage.getItem('projectPaths') || '{}');
  const yearPath = projectPaths[year.toString()];
  const monthPath = path.join(yearPath, `${month}月`);
  const defaultFolderName = `${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')} `;
  
  const dialog = document.createElement('div');
  dialog.className = 'folder-dialog';
  
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  
  dialog.innerHTML = `
    <div class="dialog-header">创建新文件夹</div>
    <div class="dialog-path">
      <div class="path-label">位置：</div>
      <div class="path-value">${monthPath}</div>
    </div>
    <div class="dialog-name">
      <div class="name-label">名称：</div>
      <div class="name-input-group">
        <span class="name-prefix">${defaultFolderName}</span>
        <input type="text" class="dialog-input" placeholder="请输入文件夹名称">
      </div>
    </div>
    <div class="dialog-preview">
      <div class="preview-label">完整路径：</div>
      <div class="preview-path"></div>
    </div>
    <div class="dialog-buttons">
      <button class="cancel">取消</button>
      <button class="confirm">确定</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(dialog);
  
  const input = dialog.querySelector('.dialog-input');
  const previewPath = dialog.querySelector('.preview-path');
  
  // 更新预览路径
  function updatePreviewPath() {
    const inputValue = input.value.trim();
    const fullFolderName = defaultFolderName + inputValue;
    const fullPath = path.join(monthPath, fullFolderName);
    previewPath.textContent = fullPath;
  }
  
  // 初始更新预览路径
  updatePreviewPath();
  
  // 输入时更新预览路径
  input.addEventListener('input', updatePreviewPath);
  
  input.focus();
  
  // 处理按钮点击
  dialog.querySelector('.cancel').addEventListener('click', () => {
    overlay.remove();
    dialog.remove();
  });
  
  dialog.querySelector('.confirm').addEventListener('click', () => {
    const folderName = defaultFolderName + input.value.trim();
    console.log(folderName);
    if (folderName) {
      createFolder(year, month, day, folderName);
    }
    overlay.remove();
    dialog.remove();
  });
  
  // 处理回车键
  input.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      const folderName = defaultFolderName + input.value.trim();
      if (folderName) {
        createFolder(year, month, day, folderName);
      }
      overlay.remove();
      dialog.remove();
    }
  });
}

// 添加创建文件夹函数
function createFolder(year, month, day, folderName) {
  const projectPaths = JSON.parse(localStorage.getItem('projectPaths') || '{}');
  const yearPath = projectPaths[year.toString()];
  console.log('yearPath', yearPath);
  if (!yearPath) {
    console.error('未设置年份路径');
    return;
  }
  
  const monthPath = path.join(yearPath, `${month}月`);
  const folderPath = path.join(monthPath, `${folderName}`);
  
  try {
    // 确保月份文件夹存在
    if (!fs.existsSync(monthPath)) {
      fs.mkdirSync(monthPath, { recursive: true });
    }
    
    // 创建新文件夹
    fs.mkdirSync(folderPath);
    console.log('文件夹创建成功:', folderPath); // 添加调试日志
    
    // 刷新日历视图
    showCalendarView();
    
  } catch (err) {
    console.error('创建文件夹失败:', err);
    // 这里可以添加错误提示
  }
}

// 在 showCalendarView 函数中添加加号图标的点击事件
document.addEventListener('click', (e) => {
  const addIcon = e.target.closest('.add-folder-icon');
  if (addIcon) {
    const dayElement = addIcon.closest('.calendar-day');
    const day = parseInt(dayElement.getAttribute('data-date'));
    showCreateFolderDialog(currentCalendarYear, currentCalendarMonth + 1, day);
  }
});

// 在文件顶部添加新的变量
let folderGroups = JSON.parse(localStorage.getItem('folderGroups')) || {};
let folderOrder = JSON.parse(localStorage.getItem('folderOrder')) || {};
let groupCollapseStates = JSON.parse(localStorage.getItem('groupCollapseStates')) || {};
let groupColors = JSON.parse(localStorage.getItem('groupColors')) || {};
let groupOrder = JSON.parse(localStorage.getItem('groupOrder')) || [];

// 添加分组相关函数
function showAddGroupDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'folder-dialog';
    dialog.innerHTML = `
        <div class="dialog-header">新建分组</div>
        <div class="dialog-name">
            <div class="name-label">名称：</div>
            <input type="text" class="dialog-input" placeholder="请输入分组名称">
        </div>
        <div class="dialog-buttons">
            <button class="cancel">取消</button>
            <button class="confirm">确定</button>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    const input = dialog.querySelector('.dialog-input');
    input.focus();

    dialog.querySelector('.cancel').addEventListener('click', () => {
        overlay.remove();
        dialog.remove();
    });

    dialog.querySelector('.confirm').addEventListener('click', () => {
        const groupName = input.value.trim();
        if (groupName) {
            createGroup(groupName);
        }
        overlay.remove();
        dialog.remove();
    });
}

// 修改 createGroup 函数
function createGroup(groupName) {
    console.log('创建新分组:', groupName); // 添加调试日志

    // 确保所有数据结构都已初始化
    if (!folderGroups) folderGroups = {};
    if (!folderOrder) folderOrder = {};
    if (!groupCollapseStates) groupCollapseStates = {};
    if (!groupColors) groupColors = {};
    if (!groupOrder) groupOrder = [];

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
        
        console.log('分组数据保存成功:', {
            folderGroups,
            folderOrder,
            groupCollapseStates,
            groupColors,
            groupOrder
        });
    } catch (error) {
        console.error('保存分组数据失败:', error);
    }

    // 更新视图
    updateFolderGroups();
}

// 修改 updateFolderGroups 函数
function updateFolderGroups() {
    const groupsList = document.getElementById('folder-groups-list');
    groupsList.innerHTML = '';

    // 获取所有分组条目并排序
    let groupEntries = Object.entries(folderGroups || {});
    if (groupOrder.length > 0) {
        groupEntries.sort((a, b) => {
            const indexA = groupOrder.indexOf(a[0]);
            const indexB = groupOrder.indexOf(b[0]);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }

    groupEntries.forEach(([groupName, folders]) => {
        const groupElement = document.createElement('div');
        groupElement.className = 'folder-group';
        const backgroundColor = groupColors[groupName] || '#2c2c2c';
        
        // 获取或初始化该分组的文件夹顺序
        if (!folderOrder[groupName]) {
            folderOrder[groupName] = folders.map(folder => folder.path);
        }

        // 根据 folderOrder 排序文件夹
        const sortedFolders = [...folders].sort((a, b) => {
            const indexA = folderOrder[groupName].indexOf(a.path);
            const indexB = folderOrder[groupName].indexOf(b.path);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        // 构建分组的 HTML 结构
        groupElement.innerHTML = `
            <div class="group-header${groupCollapseStates[groupName] ? ' collapsed' : ''}" 
                 style="background: ${backgroundColor}">
                <i class="fas fa-chevron-down"></i>
                <span class="group-name" contenteditable="true">${groupName}</span>
                <div class="group-header-controls">
                    <button class="move-up" title="向上移动">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    <button class="move-down" title="向下移动">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="color-picker" title="设置颜色" style="background: ${backgroundColor}"></div>
                    <button class="add-to-group" title="添加当前文件夹到分组">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
            <div class="group-content" style="display: ${groupCollapseStates[groupName] ? 'none' : 'block'}">
                <div class="group-folders-container">
                    ${sortedFolders.map(folder => `
                        <div class="group-folder" data-path="${folder.path}" draggable="true">
                            <span class="file-icon">${folderIcon}</span>
                            <span class="folder-name">${folder.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // 获取DOM元素的引用
        const headerElement = groupElement.querySelector('.group-header');
        const groupNameElement = headerElement.querySelector('.group-name');
        const content = groupElement.querySelector('.group-content');
        const container = groupElement.querySelector('.group-folders-container');

        // 初始化拖拽排序
        Sortable.create(container, {
            animation: 150,
            handle: '.group-folder', // 修改为整行可拖动
            ghostClass: 'folder-ghost',
            chosenClass: 'folder-chosen',
            dragClass: 'folder-drag',
            group: 'shared-folders',
            dragoverBubble: true,
            // 添加拖拽时的视觉效果
            onMove: function(evt) {
                const draggedRect = evt.dragged.getBoundingClientRect();
                const relatedRect = evt.related.getBoundingClientRect();
                const insertBefore = evt.willInsertAfter ? false : true;
                
                // 移除所有现有的指示线
                document.querySelectorAll('.drag-indicator').forEach(el => el.remove());
                
                // 创建新的指示线
                const indicator = document.createElement('div');
                indicator.className = 'drag-indicator';
                indicator.style.position = 'absolute';
                indicator.style.left = '0';
                indicator.style.right = '0';
                indicator.style.height = '2px';
                
                // 设置指示线位置
                if (insertBefore) {
                    indicator.style.top = `${relatedRect.top}px`;
                } else {
                    indicator.style.top = `${relatedRect.bottom}px`;
                }
                
                document.body.appendChild(indicator);
            },
            onEnd: function(evt) {
                // 移除指示线
                document.querySelectorAll('.drag-indicator').forEach(el => el.remove());
                document.body.classList.remove('dragging');

                const fromGroup = evt.from.closest('.folder-group').querySelector('.group-name').textContent;
                const toGroup = evt.to.closest('.folder-group').querySelector('.group-name').textContent;
                const folderPath = evt.item.getAttribute('data-path');
                const folderName = evt.item.querySelector('.folder-name').textContent;

                // 如果是跨分组拖拽
                if (fromGroup !== toGroup) {
                    // 从原分组中移除
                    folderGroups[fromGroup] = folderGroups[fromGroup].filter(f => f.path !== folderPath);
                    
                    // 添加到新分组
                    if (!folderGroups[toGroup]) {
                        folderGroups[toGroup] = [];
                    }
                    folderGroups[toGroup].push({
                        name: folderName,
                        path: folderPath
                    });
                }

                // 更新所有分组的文件夹顺序
                const allGroups = document.querySelectorAll('.folder-group');
                allGroups.forEach(group => {
                    const groupName = group.querySelector('.group-name').textContent;
                    const foldersContainer = group.querySelector('.group-folders-container');
                    const folders = Array.from(foldersContainer.querySelectorAll('.group-folder')).map(folder => ({
                        name: folder.querySelector('.folder-name').textContent,
                        path: folder.getAttribute('data-path')
                    }));

                    // 更新分组数据
                    folderGroups[groupName] = folders;
                    
                    // 更新文件夹顺序
                    folderOrder[groupName] = folders.map(f => f.path);
                });

                // 立即保存所有更新的数据
                try {
                    localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
                    localStorage.setItem('folderOrder', JSON.stringify(folderOrder));
                    console.log('保存拖拽后的数据成功:', {
                        folderGroups,
                        folderOrder
                    });
                } catch (error) {
                    console.error('保存拖拽后的数据失败:', error);
                }
            }
        });

        // 添加分组名称编辑功能
        groupNameElement.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            groupNameElement.contentEditable = 'true';
            groupNameElement.focus();
            // 选中全部文本
            const range = document.createRange();
            range.selectNodeContents(groupNameElement);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });

        // 编辑完成时的处理
        groupNameElement.addEventListener('blur', () => {
            groupNameElement.contentEditable = 'false';
            const newName = groupNameElement.textContent.trim();
            if (newName && newName !== groupName) {
                renameGroup(groupName, newName);
            } else {
                groupNameElement.textContent = groupName;
            }
        });

        // 处理回车键和ESC键
        groupNameElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                groupNameElement.blur();
            } else if (e.key === 'Escape') {
                groupNameElement.textContent = groupName;
                groupNameElement.blur();
            }
        });

        // 修改折叠/展开功能
        let clickTimer = null;
        let isEditing = false;

        headerElement.addEventListener('click', (e) => {
            // 如果点击的是控制按钮或正在编辑，不处理折叠/展开
            if (e.target.closest('.group-header-controls') || 
                e.target === groupNameElement || 
                isEditing) {
                return;
            }

            // 单击处理折叠/展开
            const isCollapsed = headerElement.classList.toggle('collapsed');
            content.style.display = isCollapsed ? 'none' : 'block';
            groupCollapseStates[groupName] = isCollapsed;
            localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
        });

        // 更新编辑状态标记
        groupNameElement.addEventListener('focus', () => {
            isEditing = true;
        });

        groupNameElement.addEventListener('blur', () => {
            isEditing = false;
        });

        // 为分组标题添加右键菜单
        headerElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showGroupContextMenu(e, groupName);
        });

        // 为分组中的文件夹添加事件
        groupElement.querySelectorAll('.group-folder').forEach(folder => {
            folder.addEventListener('click', () => {
                const folderPath = folder.getAttribute('data-path');
                navigateTo(folderPath);
            });

            folder.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const folderPath = folder.getAttribute('data-path');
                showGroupFolderContextMenu(e, groupName, folderPath);
            });
        });

        // 添加移动按钮事件监听器
        const moveUpBtn = groupElement.querySelector('.move-up');
        const moveDownBtn = groupElement.querySelector('.move-down');

        moveUpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            moveGroup(groupName, 'up');
        });

        moveDownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            moveGroup(groupName, 'down');
        });

        // 添加折叠/展开功能
        headerElement.addEventListener('click', (e) => {
            if (!e.target.closest('.add-to-group')) {
                const isCollapsed = headerElement.classList.toggle('collapsed');
                content.style.display = isCollapsed ? 'none' : 'block';
                groupCollapseStates[groupName] = isCollapsed;
                localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
            }
        });

        // 添加当前文件夹到分组
        groupElement.querySelector('.add-to-group').addEventListener('click', (e) => {
            e.stopPropagation();
            handleAddToGroup(groupName);
        });

        groupsList.appendChild(groupElement);
    });

    // 更新 groupOrder
    groupOrder = groupEntries.map(([name]) => name);
    localStorage.setItem('groupOrder', JSON.stringify(groupOrder));
}

// 修改 addToGroup 函数
function addToGroup(groupName, folder) {
    // 检查文件夹是否已存在
    const existingFolder = folderGroups[groupName].find(f => f.path === folder.path);
    if (existingFolder) {
        // 如果文件夹已存在，展开分组并高亮该文件夹
        groupCollapseStates[groupName] = false; // 展开分组
        localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
        
        updateFolderGroups();
        
        // 找到并高亮对应的文件夹
        setTimeout(() => {
            const folderElement = document.querySelector(`.folder-group .group-folder[data-path="${folder.path}"]`);
            if (folderElement) {
                // 移除其他高亮
                document.querySelectorAll('.group-folder.highlighted').forEach(el => {
                    el.classList.remove('highlighted');
                });
                
                // 添加高亮效果
                folderElement.classList.add('highlighted');
                
                // 滚动到高亮的文件夹
                folderElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // 3秒后移除高亮效果
                setTimeout(() => {
                    folderElement.classList.remove('highlighted');
                }, 3000);
            }
        }, 100);
    } else {
        // 如果文件夹不存在，则添加到分组
        folderGroups[groupName].push(folder);
        localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
        updateFolderGroups();
    }
}

// 修改添加到分组按钮的点击事件处理
function handleAddToGroup(groupName) {
    // 获取当前选中的文件夹
    const selectedItems = fileListContainer.querySelectorAll('.file-item.selected');
    const selectedFolders = Array.from(selectedItems).filter(item => {
        const itemPath = item.getAttribute('data-path');
        try {
            return fs.statSync(itemPath).isDirectory();
        } catch (err) {
            return false;
        }
    });

    if (selectedFolders.length > 0) {
        // 如果有选中的文件夹，添加所有选中的文件夹
        selectedFolders.forEach(folder => {
            const folderPath = folder.getAttribute('data-path');
            addToGroup(groupName, {
                name: path.basename(folderPath),
                path: folderPath
            });
        });
    } else if (currentPath) {
        // 如果没有选中的文件夹，添加当前视图的文件夹
        addToGroup(groupName, {
            name: path.basename(currentPath),
            path: currentPath
        });
    }
}

function removeFromGroup(groupName, folderPath) {
    console.log('Removing from group:', groupName, folderPath); // 添加调试日志
    if (folderGroups[groupName]) {
        folderGroups[groupName] = folderGroups[groupName].filter(f => f.path !== folderPath);
        
        // 果分组为空，可以选择删除分组
        if (folderGroups[groupName].length === 0) {
            delete folderGroups[groupName];
            delete groupCollapseStates[groupName];
            delete groupColors[groupName];
        }
        
        localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
        localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
        localStorage.setItem('groupColors', JSON.stringify(groupColors));
        
        updateFolderGroups();
    }
}

// 修改分组文件夹的右键菜单函数
function showGroupFolderContextMenu(e, groupName, folderPath) {
    const params = {
        hasSelection: true,
        isDirectory: true,
        path: folderPath,
        groupName: groupName,
        template: [
            {
                label: '在资源管理器中打开'
            },
            {
                label: '移出分组'
            },
            {
                label: '添加到收藏夹'
            }
        ]
    };

    ipcRenderer.send('show-context-menu', params);
}

// 在 DOMContentLoaded 事件中添加
document.addEventListener('DOMContentLoaded', () => {
    // 现有代码...

    // 添加新分组按钮事件
    const addGroupBtn = document.getElementById('add-group-btn');
    if (addGroupBtn) {
        addGroupBtn.addEventListener('click', () => {
            console.log('点击添加分组按钮'); // 添加调试日志
            
            // 创建新分组
            const tempName = '新建分组';
            createGroup(tempName);
            
            // 获取新创建的分组名称元素并触发编辑
            setTimeout(() => {
                const groupNameElement = document.querySelector(`.folder-group:last-child .group-name`);
                if (groupNameElement) {
                    groupNameElement.focus();
                    // 选中全部文本
                    const range = document.createRange();
                    range.selectNodeContents(groupNameElement);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }, 0);
        });
    } else {
        console.error('未找到添加分组按钮');
    }

    // 初始化分组显示
    updateFolderGroups();
});

// 在窗口关闭前保存状态
window.addEventListener('beforeunload', () => {
    localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
    localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
});

// 添加分组标题右键菜单
function showGroupHeaderContextMenu(e, groupName) {
    e.preventDefault();
    e.stopPropagation();
    
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = groupColors[groupName] || '#2c2c2c';
    
    colorPicker.addEventListener('change', (event) => {
        groupColors[groupName] = event.target.value;
        localStorage.setItem('groupColors', JSON.stringify(groupColors));
        updateFolderGroups();
    });
    
    colorPicker.click();
}

// 添加分组标题的右键菜单函数
function showGroupContextMenu(e, groupName) {
    const params = {
        hasSelection: true,
        groupName: groupName,
        template: [
            {
                label: '删除分组'
            }
        ]
    };

    ipcRenderer.send('show-context-menu', params);
}

// 添加预定义颜色数组
const defaultColors = [
    '#2c2c2c', // 深灰
    '#e74c3c', // 红色
    '#e67e22', // 橙色
    '#f1c40f', // 黄色
    '#2ecc71', // 绿色
    '#3498db', // 蓝色
    '#9b59b6', // 紫色
    '#1abc9c', // 青色
    '#34495e', // 深蓝
    '#7f8c8d'  // 灰色
];

// 添加颜色选择器对话框
function showColorPicker(groupName) {
    const dialog = document.createElement('div');
    dialog.className = 'color-picker-dialog';
    
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    dialog.innerHTML = `
        <div class="dialog-header">设置颜色</div>
        <div class="default-colors">
            ${defaultColors.map(color => 
                `<div class="color-option" style="background-color: ${color}" data-color="${color}"></div>`
            ).join('')}
        </div>
        <div class="custom-color">
            <label>自定义颜色:</label>
            <input type="color" value="${groupColors[groupName] || '#2c2c2c'}">
        </div>
        <div class="dialog-buttons">
            <button class="cancel">取消</button>
            <button class="confirm">确定</button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    let selectedColor = groupColors[groupName] || '#2c2c2c';
    const colorInput = dialog.querySelector('input[type="color"]');

    // 默认颜色点击事件
    dialog.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', () => {
            selectedColor = option.dataset.color;
            colorInput.value = selectedColor;
            // 移除其他选中状态
            dialog.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
        });
    });

    // 自定义颜色变化事件
    colorInput.addEventListener('input', (e) => {
        selectedColor = e.target.value;
        // 移除默认颜色的选中状态
        dialog.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    });

    // 取消按钮
    dialog.querySelector('.cancel').addEventListener('click', () => {
        overlay.remove();
        dialog.remove();
    });

    // 确定按钮
    dialog.querySelector('.confirm').addEventListener('click', () => {
        groupColors[groupName] = selectedColor;
        localStorage.setItem('groupColors', JSON.stringify(groupColors));
        updateFolderGroups();
        overlay.remove();
        dialog.remove();
    });
}

// 添加重命名对话框
function showRenameDialog(groupName) {
    const dialog = document.createElement('div');
    dialog.className = 'rename-dialog';
    
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    dialog.innerHTML = `
        <div class="dialog-header">重命名分组</div>
        <div class="dialog-content">
            <input type="text" class="rename-input" value="${groupName}">
        </div>
        <div class="dialog-buttons">
            <button class="cancel">取消</button>
            <button class="confirm">确定</button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    const input = dialog.querySelector('.rename-input');
    input.focus();
    input.select();

    // 取消按钮
    dialog.querySelector('.cancel').addEventListener('click', () => {
        overlay.remove();
        dialog.remove();
    });

    // 确定按钮
    dialog.querySelector('.confirm').addEventListener('click', () => {
        const newName = input.value.trim();
        if (newName && newName !== groupName) {
            renameGroup(groupName, newName);
        }
        overlay.remove();
        dialog.remove();
    });

    // 回车确认
    input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            const newName = input.value.trim();
            if (newName && newName !== groupName) {
                renameGroup(groupName, newName);
            }
            overlay.remove();
            dialog.remove();
        }
    });
}

// 添加重命名分组���数
function renameGroup(oldName, newName) {
    if (folderGroups[oldName]) {
        // 保存旧数据
        const oldFolders = folderGroups[oldName];
        const oldColor = groupColors[oldName];
        const oldCollapseState = groupCollapseStates[oldName];
        const oldOrder = folderOrder[oldName];
        
        // 在 groupOrder 中替换名称，保持原有位置
        const orderIndex = groupOrder.indexOf(oldName);
        if (orderIndex !== -1) {
            groupOrder[orderIndex] = newName;
        }
        
        // 使用新名称创建条目，保持原有数据
        folderGroups[newName] = oldFolders;
        groupColors[newName] = oldColor;
        groupCollapseStates[newName] = oldCollapseState;
        folderOrder[newName] = oldOrder;
        
        // 删除旧名称的数据
        delete folderGroups[oldName];
        delete groupColors[oldName];
        delete groupCollapseStates[oldName];
        delete folderOrder[oldName];
        
        // 保存更新后的数据
        localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
        localStorage.setItem('groupColors', JSON.stringify(groupColors));
        localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
        localStorage.setItem('folderOrder', JSON.stringify(folderOrder));
        localStorage.setItem('groupOrder', JSON.stringify(groupOrder));
        
        // 更新视图
        updateFolderGroups();
    }
}

// 添加删除分组函数
function deleteGroup(groupName) {
    delete folderGroups[groupName];
    delete groupColors[groupName];
    delete groupCollapseStates[groupName];
    
    // 从 groupOrder 中移除
    const index = groupOrder.indexOf(groupName);
    if (index > -1) {
        groupOrder.splice(index, 1);
    }
    
    localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
    localStorage.setItem('groupColors', JSON.stringify(groupColors));
    localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
    localStorage.setItem('groupOrder', JSON.stringify(groupOrder));
    
    updateFolderGroups();
}

// 修改 moveGroup 函数，立即保存分组顺序
function moveGroup(groupName, direction) {
    const currentIndex = groupOrder.indexOf(groupName);
    if (currentIndex === -1) return;

    let newIndex;
    if (direction === 'up') {
        if (currentIndex === 0) return;
        newIndex = currentIndex - 1;
    } else {
        if (currentIndex === groupOrder.length - 1) return;
        newIndex = currentIndex + 1;
    }

    // 交换位置
    [groupOrder[currentIndex], groupOrder[newIndex]] = [groupOrder[newIndex], groupOrder[currentIndex]];
    
    // 立即保存分组顺序
    try {
        localStorage.setItem('groupOrder', JSON.stringify(groupOrder));
        console.log('保存分组顺序成功:', groupOrder);
    } catch (error) {
        console.error('保存分组顺序失败:', error);
    }
    
    updateFolderGroups();
}

// 添加数据初始化验证
function validateAndInitData() {
    // 确保所有数据结构都存在
    if (!folderGroups) folderGroups = {};
    if (!folderOrder) folderOrder = {};
    if (!groupCollapseStates) groupCollapseStates = {};
    if (!groupColors) groupColors = {};
    if (!groupOrder) groupOrder = [];

    // 确保每个分组都有对应的顺序数据
    Object.keys(folderGroups).forEach(groupName => {
        if (!folderOrder[groupName]) {
            folderOrder[groupName] = folderGroups[groupName].map(f => f.path);
        }
    });

    // 保存初始化后的数据
    localStorage.setItem('folderGroups', JSON.stringify(folderGroups));
    localStorage.setItem('folderOrder', JSON.stringify(folderOrder));
    localStorage.setItem('groupCollapseStates', JSON.stringify(groupCollapseStates));
    localStorage.setItem('groupColors', JSON.stringify(groupColors));
    localStorage.setItem('groupOrder', JSON.stringify(groupOrder));
}

// 在应用启动时初始化数据
document.addEventListener('DOMContentLoaded', () => {
    validateAndInitData();
    updateFolderGroups();
});
