# Aperture — Award-Winning Login Interface

极简、精致、极具高级感的现代 Web 登录界面。荣获 Awwwards 级别设计标准。

## 设计亮点

| 特性 | 说明 |
|------|------|
| **弥散渐变背景** | 多层 CSS blur blob + SVG 噪点纹理，营造温润质感 |
| **悬浮感卡片** | 三重环境阴影（ambient/medium/directional）+ 1px 半透内发光边框 |
| **Spring Physics 入场动画** | Framer Motion 驱动，交错淡入上浮，阻尼弹跳 |
| **无边框输入框** | Focus 时底部光晕优雅展开，Label 浮动标签 |
| **玻璃拟态按钮** | 微渐变 + hover 流光 + 悬浮抬升 + 阴影扩散 |
| **Password 显隐** | Eye/EyeOff 图标切换，过渡如丝般顺滑 |
| **错误反馈** | Shake 抖动动画 + 柔和红色文字渐显，拒绝生硬弹窗 |
| **Loading 状态** | 自定义 spinner，零布局偏移 |

## 技术栈

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS 3** — 设计令牌驱动
- **Framer Motion 11** — Spring physics 动画
- **Lucide React** — 统一线性图标

## 快速开始

```bash
# 1. 进入项目目录
cd 登录

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 打开浏览器访问
# http://localhost:5173
```

## 构建生产版本

```bash
npm run build
npm run preview
```

## 项目结构

```
登录/
├── index.html                    # 入口 HTML
├── package.json                  # 依赖管理
├── vite.config.ts                # Vite 配置
├── tailwind.config.js            # Tailwind 设计令牌
├── postcss.config.js             # PostCSS 配置
├── tsconfig*.json                # TypeScript 配置
└── src/
    ├── main.tsx                  # 应用入口
    ├── App.tsx                   # 根组件
    ├── index.css                 # 全局样式 + 自定义 CSS
    ├── vite-env.d.ts             # Vite 类型声明
    └── components/
        ├── LoginPage.tsx         # 主页面（表单 + 动画 + 校验）
        ├── InputField.tsx        # 可复用输入组件（浮动标签 + 光晕）
        └── MeshBackground.tsx    # 弥散渐变背景 + 噪点纹理
```

## 设计理念

- **呼吸感**: 大量留白、低对比度配色、克制的视觉层级
- **物理深度**: 多层阴影 + 弹簧动画模拟真实物理世界
- **无声引导**: 浮动标签、底部光晕、焦点自动定位
- **优雅降级**: 在所有状态（加载/空/错误/成功）下保持一致的美学
