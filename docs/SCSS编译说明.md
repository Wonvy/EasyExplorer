# SCSS 编译说明

## 📋 概述

项目使用 SASS/SCSS 来管理样式，所有样式源文件位于 `src/scss/` 目录，编译后输出到 `src/css/`。

---

## 📁 目录结构

```
src/scss/
├── styles.sass              # 主样式文件（入口）
├── _theme.sass              # 主题定义（亮色/暗色）
├── _view.sass               # 视图样式
├── base/                    # 基础样式
│   ├── _base.sass          # 基础样式
│   └── _reset.sass         # CSS 重置
├── components/              # 组件样式
│   └── _resizer.sass       # 调整大小组件
├── layout/                  # 布局样式（空）
├── themes/                  # 主题变体（空）
└── view/                    # 视图变体（空）

src/css/                     # 编译输出目录
├── styles.css              # 编译后的 CSS
├── styles.css.map          # Source Map
├── all.min.css             # Font Awesome
└── settings.css            # 设置页面样式
```

---

## 🚀 使用方法

### 开发模式（自动监听）

**方式 1: 集成开发（推荐）**
```bash
npm run dev
```
这会同时启动：
- HTTP 服务器（端口 8080）
- SCSS 自动编译（监听文件变化）
- Tauri 开发服务器

**方式 2: 单独运行 SCSS 监听**
```bash
npm run sass
```
只启动 SCSS 编译监听，适合单独调试样式。

---

### 生产构建

```bash
npm run build
```
这会：
1. 先编译 SCSS → CSS
2. 然后构建 Tauri 应用

**单独编译 CSS**
```bash
npm run sass:build
```

---

## ✏️ 修改样式

### 1. 修改现有样式

编辑对应的 `.sass` 文件：

**例如：修改主题颜色**
```bash
# 编辑文件
src/scss/_theme.sass
```

**例如：修改视图样式**
```bash
# 编辑文件
src/scss/_view.sass
```

保存后，如果运行了 `npm run dev` 或 `npm run sass`，CSS 会自动重新编译。

---

### 2. 添加新样式文件

**步骤 1: 创建文件**
```bash
# 例如：创建新组件样式
src/scss/components/_button.sass
```

**步骤 2: 在主文件中导入**
编辑 `src/scss/styles.sass`：
```sass
@use 'base/_base'
@use 'base/_reset'
@use '_theme'
@use '_view'
@use 'components/_resizer'
@use 'components/_button'  // 添加这行
```

**步骤 3: 查看效果**
保存后 CSS 会自动重新编译。

---

## 🎨 主题系统

### 亮色主题
在 `src/scss/_theme.sass` 中定义：
```sass
@mixin light-theme
  // 亮色主题变量
  background-color: #ffffff
  color: #000000
```

### 暗色主题
```sass
@mixin dark-theme
  // 暗色主题变量
  background-color: #1e1e1e
  color: #ffffff
```

### 使用主题
在 `src/scss/styles.sass` 中应用：
```sass
// 默认亮色主题
body
  @include theme.light-theme

// 暗色主题（当 body 有 dark-theme 类时）
.dark-theme
  @include theme.dark-theme
```

---

## 📝 SASS 语法提示

项目使用 `.sass` 格式（缩进语法），不是 `.scss`（括号语法）。

### SASS 语法示例
```sass
// 嵌套
.container
  width: 100%
  
  .item
    padding: 10px
    
    &:hover
      background-color: #f0f0f0

// 变量
$primary-color: #007bff

.button
  background: $primary-color

// Mixin
@mixin flex-center
  display: flex
  justify-content: center
  align-items: center

.centered
  @include flex-center
```

### SCSS 语法对比（如果需要转换）
```scss
// SCSS 使用花括号和分号
.container {
  width: 100%;
  
  .item {
    padding: 10px;
    
    &:hover {
      background-color: #f0f0f0;
    }
  }
}
```

---

## 🔧 常见问题

### Q1: 修改 SASS 文件后样式没变化？

**解决方案**:
1. 确认运行了 `npm run dev` 或 `npm run sass`
2. 检查终端是否有编译错误
3. 浏览器强制刷新 `Ctrl + F5`
4. 检查 `src/css/styles.css` 是否更新

### Q2: SASS 编译报错？

**常见错误**:
```
Error: Invalid CSS after "...": expected "{"
```
**原因**: 可能混用了 SCSS 和 SASS 语法

**解决**: 
- SASS 不需要 `{}`
- SASS 不需要 `;`
- SASS 使用缩进表示嵌套

### Q3: 导入文件找不到？

**错误示例**:
```
Error: Can't find stylesheet to import.
```

**检查**:
1. 文件路径是否正确
2. 文件名是否以 `_` 开头（partial）
3. `@use` 语句中不需要 `_` 和 `.sass`

**正确示例**:
```sass
@use 'components/button'  // 文件: _button.sass
```

### Q4: 如何禁用自动编译？

如果只想手动编译：
```bash
# 不要运行 npm run dev
# 而是分别运行
npm run serve  # 只启动 HTTP 服务器
tauri dev      # 只启动 Tauri

# 需要编译时手动运行
npm run sass:build
```

---

## 🎯 最佳实践

### 1. 文件组织
- **基础样式** → `base/`
- **组件样式** → `components/`
- **布局样式** → `layout/`
- **主题变量** → `_theme.sass`
- **视图样式** → `_view.sass`

### 2. 命名规范
- Partial 文件以 `_` 开头：`_button.sass`
- 使用小写和连字符：`_button-group.sass`
- Mixin 使用动词：`@mixin flex-center`
- 变量使用描述性名称：`$primary-color`

### 3. 避免深层嵌套
```sass
// ❌ 不好：嵌套太深
.sidebar
  .menu
    .item
      .link
        color: blue

// ✅ 好：保持简单
.sidebar-menu-link
  color: blue
```

### 4. 使用变量和 Mixin
```sass
// 定义变量
$spacing-unit: 8px
$primary-color: #007bff

// 定义 Mixin
@mixin card-shadow
  box-shadow: 0 2px 4px rgba(0,0,0,0.1)

// 使用
.card
  padding: $spacing-unit * 2
  @include card-shadow
```

---

## 📊 性能优化

### 开发时
- ✅ 使用 `--watch` 模式自动编译
- ✅ 使用 Source Map 调试
- ✅ 拆分多个文件便于维护

### 生产时
- ✅ 编译为单个 CSS 文件
- ✅ 自动添加浏览器前缀（如需要可配置）
- ⏳ 考虑添加 CSS 压缩（可选）

---

## 🔄 更新流程

### 修改样式的完整流程

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **修改 SASS 文件**
   ```bash
   # 例如
   编辑 src/scss/_theme.sass
   ```

3. **自动编译**
   - 保存文件后自动触发
   - 终端显示编译结果
   - `src/css/styles.css` 自动更新

4. **查看效果**
   - 浏览器自动刷新（如果配置了）
   - 或手动刷新 `F5`

5. **提交更改**
   ```bash
   # 提交源文件
   git add src/scss/
   
   # 通常也提交编译后的 CSS
   git add src/css/styles.css
   git add src/css/styles.css.map
   ```

---

## 📚 扩展阅读

### SASS 官方文档
- [SASS 语法](https://sass-lang.com/documentation/syntax)
- [SASS 函数](https://sass-lang.com/documentation/modules)

### 项目相关
- [主题切换功能](./功能还原说明.md#主题切换)
- [开发指南](./本次会话总结.md)

---

## 🎉 快速开始

**最简单的方式**:
```bash
# 一键启动（包含 SCSS 自动编译）
npm run dev
```

**就这么简单！** 修改 SASS 文件，保存，查看效果。✨

---

**更新时间**: 2025-11-17  
**SASS 版本**: 1.80.3  
**状态**: ✅ 已配置并可用

