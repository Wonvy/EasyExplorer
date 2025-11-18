# PDF 预览 - 简化终极方案

## 当前状态

✅ 已移除 PDF.js 依赖  
⚠️ `<object>`/`<embed>` 方案在 Tauri 中可能被阻止  
✅ 已配置 `assetProtocol`

## 🎯 测试步骤

### 1. 重启应用
```bash
# 先停止当前运行的应用
# 然后运行：
npm run dev
```

### 2. 打开 PDF 文件
- 点击任意 PDF 文件
- 查看预览面板
- 查看控制台输出 PDF URL

### 3. 检查结果

#### ✅ 成功的表现
- 预览面板显示 PDF 内容
- 可以滚动查看
- 有 PDF 工具栏（缩放、打印等）

#### ⚠️ 部分成功
- 显示"浏览器不支持内嵌 PDF 预览"
- 但有"使用默认程序打开"按钮
- 点击按钮可以打开

#### ❌ 失败的表现
- 控制台显示错误
- 预览区域空白
- 需要使用备选方案

## 🔄 如果失败了：最简方案

如果 `<object>` 标签仍然不工作，我建议使用最简单可靠的方案：

###直接打开外部程序

修改代码为：

```javascript
// PDF 文件预览 - 最简方案
if (ext === '.pdf') {
    previewContent.innerHTML = `
        <div class="preview-header">
            <i class="fas fa-file-pdf" style="color: #c0392b; font-size: 64px;"></i>
            <h3>${fileName}</h3>
        </div>
        <div class="preview-info">
            <p><i class="fas fa-file-pdf"></i> PDF 文档</p>
            <p><i class="fas fa-hdd"></i> 大小: ${formatBytes(fileInfo.size || 0)}</p>
            ${fileInfo.created ? `<p><i class="fas fa-calendar-plus"></i> 创建时间: ${formatDate(fileInfo.created)}</p>` : ''}
            ${fileInfo.modified ? `<p><i class="fas fa-calendar-alt"></i> 修改时间: ${formatDate(fileInfo.modified)}</p>` : ''}
            <button class="preview-open-btn" onclick="window.__TAURI__.shell.open('${filePath.replace(/\\/g, '\\\\')}')">
                <i class="fas fa-external-link-alt"></i> 打开 PDF
            </button>
            <p style="margin-top: 15px; color: #999; font-size: 12px;">
                <i class="fas fa-info-circle"></i> 提示：双击文件也可以快速打开
            </p>
        </div>
    `;
    return;
}
```

### 为什么这是最好的方案？

1. **100% 可靠** - 没有兼容性问题
2. **速度最快** - 瞬间打开
3. **功能最全** - 使用专业 PDF 阅读器
4. **用户习惯** - 符合文件管理器的使用习惯
5. **代码最简** - 只需 10 行代码

## 📊 方案总结

| 方案 | 可靠性 | 速度 | 功能 | 复杂度 | 推荐 |
|-----|--------|------|------|--------|------|
| 外部打开 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 🥇 **最推荐** |
| object/embed | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🥈 可以尝试 |
| PDF.js | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ | 🥉 不推荐 |

## 💡 我的建议

**对于 EasyExplorer 这样的文件管理器**，最好的方案是：

1. **主要操作**：双击文件 → 外部打开
2. **预览面板**：显示文件信息 + "打开"按钮
3. **快捷键**：Space 键 → 快速打开
4. **右键菜单**："打开方式" 选项

这样的设计：
- ✅ 符合用户对文件管理器的预期
- ✅ 性能最优
- ✅ 功能最全
- ✅ 没有技术债务

## 🎨 UI 参考

```
┌─────────────────────────────┐
│        📄                   │
│   document.pdf             │
│                            │
│   大小：2.3 MB             │
│   页数：15 页              │
│   创建：2025-11-18         │
│                            │
│   ┌─────────────────┐      │
│   │  📖 打开 PDF    │      │
│   └─────────────────┘      │
│                            │
│   💡 双击文件快速打开      │
└─────────────────────────────┘
```

简洁、清晰、高效！

---

**建议**: 测试当前的 `object` 方案，如果有问题就改用"外部打开"方案  
**时间**: 5 分钟测试 + 5 分钟修改（如需要）  
**结果**: 一个快速、可靠的 PDF 预览功能 ✨

