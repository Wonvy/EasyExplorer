# PDF 预览功能实现说明

## 功能概述

为 EasyExplorer 添加了 PDF 文件的实时预览功能，用户可以在预览面板中直接查看 PDF 内容，无需打开外部程序。

## 实现细节

### 1. 依赖安装

安装了 `pdfjs-dist` 库，这是 Mozilla 的 PDF.js 项目的 npm 包：

```bash
npm install pdfjs-dist
```

### 2. 代码修改

#### 2.1 全局变量声明 (`src/renderer-tauri.js`)

```javascript
// PDF.js 全局变量
let pdfjsLib = null;
```

#### 2.2 初始化 PDF.js

在 `init()` 函数中添加了 PDF.js 的初始化：

```javascript
async function initPDFJS() {
    try {
        // 动态加载 PDF.js
        if (!pdfjsLib) {
            const pdfjs = await import('../node_modules/pdfjs-dist/build/pdf.min.mjs');
            pdfjsLib = pdfjs;
            
            // 设置 worker 路径
            pdfjsLib.GlobalWorkerOptions.workerSrc = '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
            
            console.log('✅ PDF.js 已加载');
        }
    } catch (error) {
        console.error('❌ PDF.js 加载失败:', error);
    }
}
```

#### 2.3 PDF 预览渲染函数

新增 `renderPDFPreview()` 函数，实现 PDF 的渲染：

**主要功能：**
- 读取 PDF 文件的二进制数据
- 使用 PDF.js 解析 PDF 文档
- 在 Canvas 上渲染 PDF 页面
- 支持多页 PDF 的翻页功能
- 显示页码信息和文件元数据

**关键代码：**
```javascript
async function renderPDFPreview(filePath, fileName, fileInfo) {
    // 1. 读取 PDF 二进制数据
    const { readBinaryFile } = window.__TAURI__.fs;
    const pdfData = await readBinaryFile(filePath);
    
    // 2. 加载 PDF 文档
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    
    // 3. 获取并渲染第一页
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    
    // 4. 在 Canvas 上渲染
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
    
    // 5. 添加翻页控制（如果是多页 PDF）
    // ...
}
```

#### 2.4 更新预览函数

修改 `updatePreview()` 函数中的 PDF 处理部分：

```javascript
// PDF 文件
if (ext === '.pdf') {
    try {
        await renderPDFPreview(filePath, fileName, fileInfo);
    } catch (error) {
        // 显示错误信息和备用方案
    }
    return;
}
```

### 3. 功能特性

✅ **实时预览**：直接在预览面板中显示 PDF 内容
✅ **多页支持**：可以通过前进/后退按钮浏览多页 PDF
✅ **页码显示**：显示当前页码和总页数（例如：1 / 5）
✅ **加载状态**：显示加载进度提示
✅ **错误处理**：加载失败时提供错误信息和打开按钮
✅ **文件信息**：显示文件大小、创建时间、修改时间等
✅ **外部打开**：提供按钮使用默认 PDF 阅读器打开

### 4. UI 设计

#### 预览布局：
```
┌─────────────────────────────┐
│   PDF 图标 + 文件名         │
├─────────────────────────────┤
│                             │
│    PDF Canvas 渲染区域      │
│       (带灰色背景)          │
│                             │
├─────────────────────────────┤
│  ◀  页码 (1 / 5)  ▶        │  ← 翻页控制
├─────────────────────────────┤
│  文件信息：                 │
│  • PDF 文档 (5 页)          │
│  • 大小：2.3 MB             │
│  • 创建时间                 │
│  • [使用默认程序打开]       │
└─────────────────────────────┘
```

#### 样式特点：
- Canvas 使用白色背景，带阴影效果
- 预览区使用深灰色背景 (#525659)
- 翻页控制采用半透明黑色背景的圆角按钮
- 页码信息居中显示，白色文字

### 5. 技术亮点

1. **Canvas 渲染**：使用 HTML5 Canvas API 渲染 PDF 页面
2. **Worker 线程**：PDF.js 使用 Web Worker 进行解析，不阻塞主线程
3. **动态加载**：使用 ES6 动态 import，按需加载 PDF.js
4. **Tauri 集成**：使用 Tauri 的文件系统 API 读取二进制数据
5. **响应式设计**：Canvas 大小自适应预览面板宽度

### 6. 性能优化

- **按需加载**：只在应用启动时加载 PDF.js，不使用时不占用内存
- **页面缓存**：已渲染的页面可以快速切换
- **缩放控制**：使用 1.5 倍缩放，平衡清晰度和性能
- **限制预览**：在预览面板中只显示单页，避免内存占用过大

### 7. 潜在问题和解决方案

#### 问题1：PDF.js Worker 路径问题
**解决方案**：尝试多种路径导入方式，包括相对路径和绝对路径

#### 问题2：大文件加载慢
**解决方案**：
- 显示加载状态提示
- 使用较小的缩放比例
- 考虑添加文件大小限制

#### 问题3：某些 PDF 格式不兼容
**解决方案**：
- 添加错误处理
- 提供"使用默认程序打开"的备用选项

### 8. 后续改进建议

🔧 **功能增强**：
- [ ] 添加缩放控制（放大/缩小）
- [ ] 支持连续滚动模式
- [ ] 添加搜索功能
- [ ] 支持文本选择和复制
- [ ] 添加打印功能
- [ ] 支持批注和标记

⚡ **性能优化**：
- [ ] 实现页面懒加载
- [ ] 添加预加载机制（预先加载前后页）
- [ ] 使用虚拟滚动优化长文档
- [ ] 添加渲染队列控制

🎨 **UI 改进**：
- [ ] 添加缩略图导航
- [ ] 支持全屏预览模式
- [ ] 添加深色主题适配
- [ ] 改进翻页动画

## 使用说明

1. 在文件列表中点击任意 PDF 文件
2. 预览面板会自动显示 PDF 内容
3. 如果是多页 PDF，使用底部的 ◀ ▶ 按钮翻页
4. 点击"使用默认程序打开"按钮可以用系统默认的 PDF 阅读器打开

## 测试建议

1. 测试单页 PDF 文件
2. 测试多页 PDF 文件（翻页功能）
3. 测试大文件 PDF（> 10MB）
4. 测试加密或受保护的 PDF
5. 测试不同版本的 PDF 格式
6. 测试包含图片的 PDF
7. 测试包含表单的 PDF

## 相关文件

- `src/renderer-tauri.js` - 主要实现代码
- `package.json` - 依赖配置
- `src/index.html` - HTML 结构

## 版本信息

- PDF.js 版本：5.4.394
- 实现日期：2025-11-18
- 开发者：EasyExplorer Team


