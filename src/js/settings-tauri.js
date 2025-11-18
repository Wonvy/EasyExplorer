/**
 * Settings - Tauri 版本
 * 设置页面的 JavaScript 逻辑
 */

let projectYears = [2023, 2024, 2025]; // 初始年份列表
let invoke, openDialog;

// 等待 Tauri API 加载
async function initTauriAPIs() {
    let attempts = 0;
    while (typeof window.__TAURI__ === 'undefined' && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
    }
    
    if (typeof window.__TAURI__ === 'undefined') {
        console.error('Tauri API 加载失败');
        return false;
    }
    
    ({ invoke } = window.__TAURI__.tauri);
    ({ open: openDialog } = window.__TAURI__.dialog);
    
    console.log('✅ Tauri API 已在设置页面加载');
    return true;
}

document.addEventListener('DOMContentLoaded', async () => {
    // 初始化 Tauri API
    await initTauriAPIs();
    
    const sidebar = document.getElementById('settings-sidebar');
    const content = document.getElementById('settings-content');
    const tabs = sidebar.querySelectorAll('li');
    const tabContents = content.querySelectorAll('.tab-content');

    function setActiveTab(tabId) {
        tabs.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(tabContent => tabContent.classList.remove('active'));

        const activeTab = sidebar.querySelector(`[data-tab="${tabId}"]`);
        const activeContent = content.querySelector(`#${tabId}`);

        if (activeTab && activeContent) {
            activeTab.classList.add('active');
            activeContent.classList.add('active');
        }
    }

    sidebar.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const tabId = e.target.getAttribute('data-tab');
            setActiveTab(tabId);
        }
    });

    content.addEventListener('scroll', () => {
        const scrollPosition = content.scrollTop;
        let activeTabId = null;

        tabContents.forEach(tabContent => {
            const tabTop = tabContent.offsetTop;
            const tabBottom = tabTop + tabContent.offsetHeight;

            if (scrollPosition >= tabTop && scrollPosition < tabBottom) {
                activeTabId = tabContent.id;
            }
        });

        if (activeTabId) {
            setActiveTab(activeTabId);
        }
    });

    // 初始化项目年份列表
    initProjectYears();

    // 添加新年份按钮点击事件
    document.getElementById('add-year-btn').addEventListener('click', showAddYearDialog);

    // 预览设置相关的代码
    const previewMode = document.getElementsByName('preview-mode');
    const seerPathContainer = document.querySelector('.seer-path-container');
    const seerPathInput = document.getElementById('seer-path');
    const selectSeerPathBtn = document.getElementById('select-seer-path');
    const newFileTypeInput = document.getElementById('new-file-type');
    const addFileTypeBtn = document.getElementById('add-file-type');
    const fileTypesList = document.getElementById('file-types-list');
    const fileTypesSection = document.querySelector('.file-types');

    // 加载保存的设置
    const loadPreviewSettings = () => {
        const settings = JSON.parse(localStorage.getItem('previewSettings') || '{}');
        
        // 设置预览模式
        const mode = settings.mode || 'default';
        const modeRadio = document.querySelector(`input[name="preview-mode"][value="${mode}"]`);
        if (modeRadio) {
            modeRadio.checked = true;
        }
        
        // 设置 Seer 路径
        if (settings.seerPath) {
            seerPathInput.value = settings.seerPath;
        }
        
        // 显示/隐藏 Seer 相关设置
        const showSeerSettings = mode === 'seer';
        seerPathContainer.style.display = showSeerSettings ? 'block' : 'none';
        fileTypesSection.style.display = showSeerSettings ? 'block' : 'none';
        
        // 加载文件类型列表
        updateFileTypesList(settings.fileTypes || []);
    };

    // 更新文件类型列表
    const updateFileTypesList = (fileTypes) => {
        fileTypesList.innerHTML = fileTypes.map(type => `
            <tr>
                <td>.${type}</td>
                <td>
                    <button class="delete-type" data-type="${type}">删除</button>
                </td>
            </tr>
        `).join('');

        // 保存设置
        savePreviewSettings();
    };

    // 保存设置
    const savePreviewSettings = () => {
        const checkedRadio = document.querySelector('input[name="preview-mode"]:checked');
        const settings = {
            mode: checkedRadio ? checkedRadio.value : 'default',
            seerPath: seerPathInput.value,
            fileTypes: Array.from(fileTypesList.querySelectorAll('tr')).map(
                row => row.querySelector('td').textContent.slice(1)
            )
        };
        localStorage.setItem('previewSettings', JSON.stringify(settings));
    };

    // 预览模式切换事件
    previewMode.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const showSeerSettings = e.target.value === 'seer';
            seerPathContainer.style.display = showSeerSettings ? 'block' : 'none';
            fileTypesSection.style.display = showSeerSettings ? 'block' : 'none';
            savePreviewSettings();
        });
    });

    // 选择 Seer 路径按钮点击事件
    selectSeerPathBtn.addEventListener('click', async () => {
        try {
            const result = await openDialog({
                title: '选择 Seer.exe',
                filters: [{
                    name: 'Executable',
                    extensions: ['exe']
                }]
            });
            
            if (result) {
                seerPathInput.value = result;
                savePreviewSettings();
            }
        } catch (error) {
            console.error('选择 Seer.exe 时出错:', error);
        }
    });

    // Seer 路径输入框变化事件
    seerPathInput.addEventListener('change', savePreviewSettings);

    // 添加文件类型按钮点击事件
    addFileTypeBtn.addEventListener('click', () => {
        let newType = newFileTypeInput.value.trim().toLowerCase();
        if (newType) {
            if (newType.startsWith('.')) {
                newType = newType.slice(1);
            }
            
            const currentTypes = Array.from(fileTypesList.querySelectorAll('tr'))
                .map(row => row.querySelector('td').textContent.slice(1));
            
            if (!currentTypes.includes(newType)) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>.${newType}</td>
                    <td>
                        <button class="delete-type" data-type="${newType}">删除</button>
                    </td>
                `;
                fileTypesList.appendChild(tr);
                newFileTypeInput.value = '';
                savePreviewSettings();
            }
        }
    });

    // 删除文件类型按钮点击事件
    fileTypesList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-type')) {
            e.target.closest('tr').remove();
            savePreviewSettings();
        }
    });

    // 初始加载设置
    loadPreviewSettings();
});

// 初始化项目年份列表
function initProjectYears() {
    // 从 localStorage 加载保存的年份列表
    const savedYears = JSON.parse(localStorage.getItem('projectYears') || '[]');
    projectYears = savedYears.length > 0 ? savedYears : [2023, 2024, 2025];
    
    // 更新显示
    updateProjectYearsList();
}

// 更新显示的路径
function updateProjectPath(year, path) {
    const yearElements = document.querySelectorAll('.project-year-item');
    const yearElement = Array.from(yearElements).find(el => 
        el.querySelector('.year-column').textContent === year
    );

    if (yearElement) {
        const pathDisplay = yearElement.querySelector('.path-display');
        pathDisplay.textContent = path || '未设置';
        pathDisplay.title = path || '未设置';
        
        if (path) {
            pathDisplay.style.cursor = 'pointer';
            pathDisplay.classList.add('has-path');
            
            // 移除旧的事件监听器（如果存在）
            if (pathDisplay.clickHandler) {
                pathDisplay.removeEventListener('click', pathDisplay.clickHandler);
            }
            
            // 添加新的事件监听器
            pathDisplay.clickHandler = async () => {
                try {
                    await invoke('show_in_explorer', { path });
                } catch (error) {
                    console.error('打开路径失败:', error);
                }
            };
            pathDisplay.addEventListener('click', pathDisplay.clickHandler);
        } else {
            pathDisplay.style.cursor = 'default';
            pathDisplay.classList.remove('has-path');
        }
    }
}

// 更新项目年份列表显示
function updateProjectYearsList() {
    const container = document.querySelector('.project-years-list');
    container.innerHTML = projectYears
        .sort((a, b) => a - b) // 按年份排序
        .map(year => `
            <div class="project-year-item">
                <span class="year-column">${year}</span>
                <div class="path-column">
                    <span class="path-display" title="未设置">未设置</span>
                </div>
                <div class="action-column">
                    <button class="select-folder-btn" title="选择文件夹">
                        <i class="fas fa-folder-open"></i>
                    </button>
                    <button class="delete-year-btn" data-year="${year}" title="删除年份">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

    // 重新加载已保存的路径
    const projectPaths = JSON.parse(localStorage.getItem('projectPaths') || '{}');
    projectYears.forEach(year => {
        if (projectPaths[year]) {
            updateProjectPath(year.toString(), projectPaths[year]);
        }
    });

    // 添加删除年份按钮的事件监听
    document.querySelectorAll('.delete-year-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const year = parseInt(e.currentTarget.getAttribute('data-year'));
            deleteProjectYear(year);
        });
    });

    // 重新绑定选择文件夹按钮事件
    document.querySelectorAll('.select-folder-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const yearElement = btn.closest('.project-year-item');
            const year = yearElement.querySelector('.year-column').textContent;
            
            try {
                const result = await openDialog({
                    directory: true,
                    title: `选择 ${year} 年项目文件夹`
                });
                
                if (result) {
                    updateProjectPath(year, result);
                    
                    // 保存到 localStorage
                    const projectPaths = JSON.parse(localStorage.getItem('projectPaths') || '{}');
                    projectPaths[year] = result;
                    localStorage.setItem('projectPaths', JSON.stringify(projectPaths));
                }
            } catch (error) {
                console.error('选择文件夹时出错:', error);
            }
        });
    });
}

// 显示添加年份对话框
function showAddYearDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'year-dialog';
    
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    dialog.innerHTML = `
        <div class="dialog-header">添加新年份</div>
        <div class="dialog-content">
            <input type="number" id="new-year-input" min="1900" max="9999" placeholder="请输入年份">
        </div>
        <div class="dialog-buttons">
            <button class="cancel">取消</button>
            <button class="confirm">确定</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    
    const input = dialog.querySelector('#new-year-input');
    input.value = new Date().getFullYear() + 1; // 默认显示下一年
    input.focus();
    
    // 处理按钮点击
    dialog.querySelector('.cancel').addEventListener('click', () => {
        overlay.remove();
        dialog.remove();
    });
    
    dialog.querySelector('.confirm').addEventListener('click', () => {
        const year = parseInt(input.value);
        if (isValidYear(year)) {
            addProjectYear(year);
            overlay.remove();
            dialog.remove();
        } else {
            alert('请输入有效的年份（1900-9999）');
        }
    });
    
    // 处理回车键
    input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            const year = parseInt(input.value);
            if (isValidYear(year)) {
                addProjectYear(year);
                overlay.remove();
                dialog.remove();
            } else {
                alert('请输入有效的年份（1900-9999）');
            }
        }
    });
}

// 验证年份是否有效
function isValidYear(year) {
    return !isNaN(year) && year >= 1900 && year <= 9999 && !projectYears.includes(year);
}

// 添加新年份
function addProjectYear(year) {
    if (!projectYears.includes(year)) {
        projectYears.push(year);
        localStorage.setItem('projectYears', JSON.stringify(projectYears));
        updateProjectYearsList();
    }
}

// 删除年份
function deleteProjectYear(year) {
    if (confirm(`确定要删除 ${year} 年的项目设置吗？`)) {
        projectYears = projectYears.filter(y => y !== year);
        
        // 同时删除该年份的路径设置
        const projectPaths = JSON.parse(localStorage.getItem('projectPaths') || '{}');
        delete projectPaths[year];
        
        // 保存更新后的设置
        localStorage.setItem('projectYears', JSON.stringify(projectYears));
        localStorage.setItem('projectPaths', JSON.stringify(projectPaths));
        
        // 更新显示
        updateProjectYearsList();
    }
}

