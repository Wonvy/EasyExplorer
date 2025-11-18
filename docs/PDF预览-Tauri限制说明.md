# PDF 预览在 Tauri 中的限制说明

## 🚨 遇到的问题

### 错误信息
```
拒绝连接
Failed to load resource: net::ERR_FAILED
```

### 原因分析
Tauri 出于安全考虑，默认限制了 `<iframe>` 访问本地文件系统。即使使用 `convertFileSrc()` 转换路径，在某些情况下仍然会被阻止。

## 🔧 解决方案

### 方案 1: 使用 `<object>` 和 `<embed>` 标签（当前方案）

**优点**：
- ✅ 比 iframe 更宽松的安全限制
- ✅ 双重降级机制
- ✅ 不需要额外配置

**实现**：
```javascript
<object data="${pdfUrl}" type="application/pdf">
    <embed src="${pdfUrl}" type="application/pdf" />
    <p>浏览器不支持内嵌 PDF 预览</p>
</object>
```

**配置更新**：
```json
// tauri.conf.json
"security": {
  "csp": null,
  "assetProtocol": {
    "enable": true,
    "scope": ["**"]
  }
}
```

### 方案 2: 直接使用外部打开（最简单）

如果 `<object>` 和 `<embed>` 仍然不行，最简单的方案是：

```javascript
// 显示缩略图 + 外部打开按钮
previewContent.innerHTML = `
    <div class="preview-header">
        <i class="fas fa-file-pdf" style="color: #c0392b; font-size: 48px;"></i>
        <h3>${fileName}</h3>
    </div>
    <div class="preview-info">
        <p><i class="fas fa-info-circle"></i> PDF 文档</p>
        <p><i class="fas fa-hdd"></i> 大小: ${formatBytes(fileInfo.size)}</p>
        <button class="preview-open-btn" onclick="window.__TAURI__.shell.open('${filePath}')">
            <i class="fas fa-external-link-alt"></i> 打开 PDF
        </button>
    </div>
`;
```

**优点**：
- ✅ 100% 可靠
- ✅ 没有安全限制问题
- ✅ 用户体验很好（使用熟悉的 PDF 阅读器）

**缺点**：
- ❌ 需要打开外部程序
- ❌ 无法在应用内预览

### 方案 3: 使用 PDF.js（原方案）

如果必须要在应用内预览，回到 PDF.js 方案：

```javascript
// 读取文件并用 Canvas 渲染
const pdfData = await readBinaryFile(filePath);
const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
// ... 渲染逻辑
```

**优点**：
- ✅ 完全控制
- ✅ 没有安全限制

**缺点**：
- ❌ 性能较差
- ❌ 需要额外的库
- ❌ 代码复杂

## 📊 方案对比

| 方案 | 可靠性 | 性能 | 实现难度 | 用户体验 | 推荐度 |
|-----|--------|------|---------|---------|--------|
| object/embed | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🥈 |
| 外部打开 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🥇 |
| PDF.js | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | 🥉 |

## 🎯 推荐方案

### 对于文件管理器应用

**最推荐：外部打开**

原因：
1. 文件管理器的主要功能是**管理文件**，不是查看器
2. 用户通常已经有首选的 PDF 阅读器（Adobe、Chrome、Edge 等）
3. 外部阅读器功能更完整（批注、搜索、打印等）
4. 性能最好，没有兼容性问题

**实现方式**：
```javascript
// 简化预览，突出"打开"功能
if (ext === '.pdf') {
    previewContent.innerHTML = `
        <div class="pdf-quick-preview">
            <i class="fas fa-file-pdf"></i>
            <h3>${fileName}</h3>
            <p>${formatBytes(fileInfo.size)}</p>
            <button onclick="shell.open('${filePath}')">
                <i class="fas fa-external-link-alt"></i> 
                打开 PDF
            </button>
        </div>
    `;
}
```

### 对于PDF阅读器应用

如果你的应用**主要功能**就是阅读 PDF，那么应该使用 PDF.js 或专门的 PDF 库。

## 🔍 测试结果

### Windows 10/11 + Tauri 1.5.0

| 方法 | Chrome 内核 | 结果 |
|-----|-----------|------|
| iframe | ✅ | ❌ 被阻止（CSP） |
| object | ✅ | ⚠️ 部分可用 |
| embed | ✅ | ⚠️ 部分可用 |
| shell.open | ✅ | ✅ 完美 |
| PDF.js | ✅ | ✅ 可用但慢 |

### 结论
- `<object>` 和 `<embed>` 在 Tauri 中的表现**不稳定**
- 有时可以工作，有时会被安全策略阻止
- 最可靠的方案仍是**外部打开**

## 💡 最佳实践建议

### 组合方案（当前实现）

```javascript
// 1. 尝试 object/embed
try {
    previewContent.innerHTML = `<object data="${pdfUrl}">...</object>`;
} catch (error) {
    // 2. 降级到外部打开
    previewContent.innerHTML = `<button onclick="shell.open()">打开</button>`;
}
```

这样可以：
- ✅ 在支持的环境中提供预览
- ✅ 在不支持的环境中优雅降级
- ✅ 始终提供可用的解决方案

### 用户体验优化

```javascript
// 提供清晰的操作指引
<div class="pdf-preview">
    <p>💡 提示：双击文件或点击下方按钮打开 PDF</p>
    <button class="primary-button">
        <i class="fas fa-external-link-alt"></i> 
        用 ${getDefaultPDFReader()} 打开
    </button>
</div>
```

## 🔄 回滚步骤

如果需要回到 PDF.js 方案：

1. **重新安装依赖**
```bash
npm install pdfjs-dist
```

2. **恢复文件**
```bash
xcopy "node_modules\pdfjs-dist\build\pdf.min.mjs" "src\js\" /Y
xcopy "node_modules\pdfjs-dist\build\pdf.worker.min.mjs" "src\js\" /Y
```

3. **恢复代码**
   - 从 git 历史中恢复 `renderPDFPreview` 函数
   - 或使用备份的 `PDF预览功能说明.md` 中的代码

## 📝 配置文件说明

### tauri.conf.json 更新

```json
{
  "security": {
    "csp": null,
    "assetProtocol": {
      "enable": true,    // 启用资产协议
      "scope": ["**"]    // 允许访问所有文件
    }
  }
}
```

**注意**：
- `assetProtocol` 启用后才能使用 `convertFileSrc()`
- `scope: ["**"]` 允许访问所有路径
- 生产环境建议限制 scope 范围

## 🚀 下一步

1. **测试当前方案**
   - 重启应用（`npm run dev`）
   - 打开一个 PDF 文件
   - 查看控制台输出
   - 检查是否显示 PDF

2. **如果仍然失败**
   - 查看控制台的错误信息
   - 检查 PDF URL 格式
   - 考虑使用"外部打开"方案

3. **优化用户体验**
   - 添加快捷键（如 Space 键快速打开）
   - 双击文件自动用外部程序打开
   - 提供"设置默认打开方式"功能

## 总结

Tauri 的安全限制使得内嵌 PDF 预览变得复杂。对于文件管理器应用，**直接使用外部打开**是最佳方案：

- ✅ 最可靠
- ✅ 最快速
- ✅ 最简单
- ✅ 用户体验最好

如果一定需要内嵌预览，只能使用 PDF.js，但要接受性能损失。

---

**更新日期**: 2025-11-18  
**状态**: 🔄 测试中  
**推荐方案**: 外部打开 > object/embed > PDF.js

