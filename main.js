const { app, BrowserWindow, Menu, ipcMain, clipboard, shell } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow;
let devToolsWindow;

// 创建主窗口
function createWindow () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true  // 启用 remote 模块
    }
  })

  mainWindow.loadFile('index.html')

  // 隐藏默认菜单
  Menu.setApplicationMenu(null)

  // 创建开发者工具窗口
  devToolsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Developer Tools'
  })

  // 打开开发者工具并将其附加到主窗口
  mainWindow.webContents.setDevToolsWebContents(devToolsWindow.webContents)
  mainWindow.webContents.openDevTools({ mode: 'detach' })

  // 处理右键菜单请求
  ipcMain.on('show-context-menu', (event, params) => {
    const template = [];

    if (params.hasSelection) {
      // 只有在选中文件或文件夹时才添加这些选项
      template.push(
        {
          label: '在资源管理器中打开',
          click: () => event.reply('menu-item-clicked', 'open-in-explorer', params.path)
        },
        {
          label: '复制',
          click: () => event.reply('menu-item-clicked', 'copy', params.path)
        }
      );

      if (params.isDirectory) {
        if (params.isFavorite) {
          template.push({
            label: '从收藏夹中移除',
            click: () => event.reply('menu-item-clicked', 'remove-from-favorites', params.path)
          });
        } else {
          template.push({
            label: '添加到收藏夹',
            click: () => event.reply('menu-item-clicked', 'add-to-favorites', params.path)
          });
        }
      }
    }

    // 无论是否选中文件或文件夹，都添加粘贴选项
    template.push(
      {
        label: '粘贴',
        click: () => event.reply('menu-item-clicked', 'paste', params.path),
        enabled: clipboard.readText().startsWith('file://')
      }
    );

    if (params.isCurrentDir) {
      // 如果是当前目录（空白处右键），修改第一个选项的标签
      if (template.length > 0 && template[0].label === '在资源管理器中打开') {
        template[0].label = '在资源管理器中打开当前文件夹';
      }
    }

    const menu = Menu.buildFromTemplate(template);
    menu.popup(BrowserWindow.fromWebContents(event.sender));
  })

  // 添加新的 ipcMain 监听器
  ipcMain.on('show-favorite-context-menu', (event, params) => {
    const template = [
      {
        label: '取消收藏',
        click: () => event.reply('favorite-menu-item-clicked', 'remove-from-favorites', params.path)
      },
      {
        label: '在资源管理器中打开',
        click: () => shell.showItemInFolder(params.path)
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender), x: params.x, y: params.y });
  });

  // 当主窗口关闭时，关闭开发者工具窗口
  mainWindow.on('closed', () => {
    if (devToolsWindow && !devToolsWindow.isDestroyed()) {
      devToolsWindow.close()
    }
  })

  ipcMain.on('show-status-bar-menu', (event, options) => {
    const template = options.map(option => ({
      label: option.label,
      type: 'checkbox',
      checked: option.checked,
      click: () => event.reply('status-bar-menu-item-clicked', option.label)
    }));

    const menu = Menu.buildFromTemplate(template);
    menu.popup(BrowserWindow.fromWebContents(event.sender));
  });
}

// 当Electron完成初始化时创建窗口
app.whenReady().then(createWindow)

// 当所有窗口被关闭时退出应用（Windows & Linux）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 在macOS上，当所有窗口都被关闭时重新创建一个窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 获取文件图标
ipcMain.handle('get-file-icon', async (event, filePath) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    return icon.toDataURL();
  } catch (error) {
    console.error('获取文件图标时出错:', error);
    return null;
  }
});

// 复制文件路径到剪贴板
ipcMain.on('copy-files-to-clipboard', (event, filePaths) => {
  console.log('接收到复制文件请求:', filePaths);
  if (filePaths && filePaths.length > 0) {
    const fileList = filePaths.map(file => `file://${file}`).join('\n');
    clipboard.writeText(fileList);
    console.log('文件路径已复制到剪贴板');
  } else {
    console.log('没有文件路径可复制');
  }
});