# Metadata Remove Pro Web(纯前端版)设计方案

> 部署目标: GitHub Pages 静态托管, 无后端。
> 核心原则: 核心功能零依赖、纯浏览器内完成 -- "100% 本地处理"绝对成立; 重活(视频/HEIC/未来转码)走**可选模块 + 预留云端端口**。

---

## 1. 目标与约束

| 项 | 说明 |
|---|---|
| 部署 | GitHub Pages, 纯静态文件, 无构建工具也可直接上线 |
| 隐私 | 文件永不离开浏览器(核心功能); 承诺文案随模式切换 |
| 与桌面版关系 | Python 桌面版保留为高级工具; Web 版面向快捷场景, 两版共享测试样本与算法语义 |
| 兼容 | Chrome/Edge/Firefox/Safari 现代版本; 高级能力做能力检测降级 |

## 2. 架构总览

```
+---------------------------------------------------+
|  UI 层(复用现有暗色风格): 拖拽/卡片/清单/下载        |
+---------------------------------------------------+
|  核心引擎(必载, 零依赖):                            |
|   parsers(字节级) / scan / c2pa / forge /          |
|   antiwm / visible-wm (canvas)                     |
+---------------------------------------------------+
|  可选模块(懒加载):                                  |
|   video.js(纯JS容器剥离) / heic.js(libheif)        |
+---------------------------------------------------+
|  处理器适配层 ProcessorAdapter:                     |
|   local(浏览器内) | remote(未来云端端口)            |
+---------------------------------------------------+
```

## 3. 模块划分与 Python 版对照

| Web 模块 | 职责 | 对应 Python |
|---|---|---|
| core/parsers/png.js | PNG chunk 解析/剥离(tEXt/zTXt/iTXt/eXIf/caBX/tIME/iCCP, CRC 重算) | png_chunks / strip_png / inject_png_meta |
| core/parsers/jpeg.js | JPEG 段解析/剥离(APP*/COM, 最小方向头注入) | jpeg_segments / strip_jpeg / inject_jpeg_meta |
| core/parsers/webp.js | WebP RIFF 块剥离(EXIF/XMP/ICCP + VP8X 标志位同步) | strip_webp / inject_webp_meta |
| core/parsers/iso.js | ISOBMFF 盒遍历(MP4/MOV 元数据盒, 供 video.js) | 无(新增) |
| core/c2pa.js | C2PA 字节扫描 + JUMBF 盒解析 + 清单字段提取 | parse_jumf_boxes / extract_c2pa_info |
| core/signatures.js | 生成器/AI标记/应用签名库(JSON 直译) | AI_GENERATORS 等 |
| core/scan.js | 检测管线: 字节扫描 + EXIF/XMP 解析 + 裁决 | scan_image / scan_xmp_text |
| core/exif.js | EXIF/XMP/GPS 解析(纯 JS 读 TIFF IFD) | Pillow 交叉检查部分 |
| core/forge.js | 伪造引擎: 相机档案 + 曝光一致性 + EXIF/XMP 生成 | forge.py(算法直译, camera_db.json 原样复用) |
| core/antiwm.js | 隐形水印统计检测 + 色度低通/重采样/旋转对抗(canvas) | wm_stats / wm_detect / apply_anti_wm |
| core/visible.js | 可见水印色块检测与修补(ImageData) | detect_visible_grid / patch_visible_box |
| optional/video.js | 视频容器级元数据剥离(见第5节) | clean_video 的元数据部分 |
| optional/heic.js | HEIC 解码(libheif.wasm 约1.5MB, 懒加载) | pillow-heif 部分 |
| ui/ | 现有界面移植(卡片/清单/下载/承诺横幅) | web/index.html |
| ui/i18n.js | 中英文词条表(与桌面版共用词条语义) + 语言切换持久化 | 新增 |
| ui/theme.js | 深浅主题切换(CSS 变量) + 持久化 | 新增 |

## 4. 数据流

File -> ArrayBuffer -> scan(字节级 + canvas 解码) -> 卡片展示(风险 + 元数据清单) -> clean(内存中字节重写, 无落盘) -> Blob -> 一键下载

- 图片全程内存处理; 大视频用 Blob.slice 分块遍历, 避免整文件进内存
- canvas 仅用于需要像素的功能(可见水印/隐形水印/伪造像素级), 纯元数据操作不碰像素, 保持无损

## 5. 视频方案(按需求: 可选模块 + 未来云端)

**本期(可选模块, 懒加载): 纯 JS 容器级剥离, 不重编码**

- MP4/MOV: 遍历 box, 移除 udta/meta/keys/ilst 等元数据盒(保留 ftyp/moov 结构必需部分)
- MKV/WebM: EBML 遍历, 移除 Tags/Info 中的标题等元数据元素
- AVI: RIFF 遍历, 移除 LIST:INFO
- 优点: 零依赖、秒级、体积只减不增; 边界: 冷门变体可能剥离不彻底, UI 诚实提示已剥离/未发现

**未来(预留, 本期不实现): 云端端口模式**

- 适配层 ProcessorAdapter: local(浏览器内, 默认) | remote(配置后端地址后启用)
- remote 模式用于: 视频转码、未知格式兜底等重活
- **隐私提示联动**: 切换 remote 时, 页面横幅自动从 100% 本地处理 变为 云端模式(文件将上传到你指定的服务器处理), 需用户手动确认
- 云端服务本期不开发, 只留接口签名与文案位

## 6. 功能范围与分批

| 批次 | 内容 | 状态 |
|---|---|---|
| P1 | 骨架 + F-01(JPEG/PNG/WebP/SVG 剥离) + F-03(C2PA) + F-05/06/07/08 + F-09(多格式) + F-10(大小对比) + F-11(批量) + F-13(深浅主题) + 中英文 i18n + 使用条款子页面(terms.html, 按语言匹配显示) | **已完成**(含普通/深度两模式与 SD 隐形水印检测对抗) |
| P2 | 伪造人类痕迹(forge, 含地区/GPS) + 隐形水印检测/对抗 + 可见水印 | 功能对齐桌面版 |
| P3 | 视频容器剥离(optional/video.js) + 视频进度 + HEIC(optional/heic.js) | 可选模块 |
| P4 | 云端适配器 remote + 后端服务 | 未来 |

## 7. 目录结构

```
webapp/
  index.html
  terms.html               # 使用条款(免责声明, 中英文按语言匹配显示)
  css/style.css
  js/app.js                # UI 编排
  js/core/
    signatures.js  exif.js  parsers/{png,jpeg,webp,iso}.js
    c2pa.js  scan.js  forge.js  antiwm.js  visible.js
  js/optional/{video,heic}.js
  data/camera_db.json      # 从桌面版复制, 两版共用同一档案
  DESIGN.md
```

## 8. 测试策略

1. **Node 单测**(字节级解析无需浏览器): 与 Python 引擎做**对照测试** -- 同一批 测试样本/, 两个引擎的输出做字节级/结构级一致性校验(Python 版作为参考实现)
2. **浏览器 E2E**: 测试样本走全流程(上传/检测/清理/下载), 校验下载文件字节
3. **回归**: 桌面版 verify.py/web_test.py 保持通过, 两版互不影响

## 8b. 部署与防盗版(上线前执行)

- **语言自动适配**: 首次进入按 navigator.language 判定, 中文则中文, 其余一律英文; 手动切换后 localStorage 记忆优先(桌面版已实现, webapp 同样逻辑)
- **版权防护**(必备, 零成本): 页脚 © 2026 版权行 + JS 头部版权注释块 + 控制台彩色版权水印
- **构建流程**(webapp 专属, 桌面版不做): 保留可读源码于 webapp/src/; 部署时用 javascript-obfuscator(免费开源)执行 压缩+混淆, 输出到 webapp/dist/ 上传 GitHub Pages
- **不做的事(有损无益)**: ① 禁用右键/F12 — 用户体验差且可绕过, 看源码不等于抄袭; ② 硬性域名锁定 — GitHub Pages 子域名与本地测试会被误锁, 且删一行即绕过; 如需仅保留控制台软提示。核心算法在引擎层, 前端防护只是延缓阅读
- **法律兜底**: 使用条款 + 版权声明 + 代码水印(混淆工具内置)作为维权证据链

## 9. 风险与边界(诚实声明)

| 风险 | 对策 |
|---|---|
| 视频冷门变体剥离不彻底 | UI 报告实际移除项; 未来 remote 兜底 |
| AVIF 无法在 canvas 重编码 | 清理后输出 PNG/JPEG/WebP(提示用户) |
| Safari 无 File System Access API | 文件夹批量降级为拖拽批量 |
| iOS Safari 内存限制(超大视频) | 分块处理 + 大小上限提示 |
| 像素级分类器无法绕过 | 沿用桌面版文档声明, 不做虚假承诺 |
