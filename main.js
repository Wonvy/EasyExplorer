const { app, BrowserWindow, Menu, ipcMain, clipboard, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process');

let mainWindow;
let devToolsWindow;
let settingsWindow = null;

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
        },
        {
          label: '打开方式',
          click: () => {
            ipcMain.emit('open-file-dialog', event, params.path); // 调用打开方式对话框
          }
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

    // 粘贴选项
    template.push(
      {
        label: '粘贴',
        click: () => event.reply('menu-item-clicked', 'paste', params.path)
      }
    );

    // 状态栏
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

  // 状态栏
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

  // 在文件顶部添加
  function createSettingsWindow() {
    if (settingsWindow) {
      settingsWindow.focus();
      return;
    }

    settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    settingsWindow.loadFile('settings.html');
    settingsWindow.webContents.openDevTools();

    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });
  }

  // 在 ipcMain.on('show-context-menu', ...) 之前添加以下监听器
  ipcMain.on('open-settings', () => {
    createSettingsWindow();
  });

  // 在现有的 ipcMain 监听器部分添加
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    console.log(result);
    return result;
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

// 复制文件
ipcMain.on('perform-paste', (event, targetPath, filePaths) => {
  filePaths.forEach(filePath => {
    const destination = path.join(targetPath, path.basename(filePath));

    const command = `robocopy "${path.dirname(filePath)}" "${targetPath}" "${path.basename(filePath)}" /E /Z /R:3 /W:5`;

    console.log('command', command);
    const child = exec(command);
    event.sender.send('copy-progress', command); // 发送进度信息

    child.stdout.on('data', (data) => {
      // 解析进度信息并发送到渲染进程
      console.log(data);
      event.sender.send('copy-progress', command); // 发送进度信息
    });

    child.stderr.on('data', (data) => {
      console.error('错误信息:', data);
    });

    child.on('close', (code) => {
      console.log(`复制过程结束，退出码: ${code}`);
      event.sender.send('update-file-list', targetPath);
    });
  });
});

// 打开方式
ipcMain.on('open-file-dialog', (event, filePath) => {
  const command = `rundll32.exe shell32.dll,OpenAs_RunDLL "${filePath}"`; // 添加引号以处理路径中的空格
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`执行出错: ${error}`);
      return;
    }
    console.log(`标准输出: ${stdout}`);
  });
});
