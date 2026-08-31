# Metadata Remove Pro —— AI 水印/元数据 检测与清理工具

把图片或视频交给它,它会:
1. **检测** 文件里的 AI 生成痕迹(C2PA 内容凭证、生成器签名、AI 标记、可见水印色块、各类元数据);
2. **清理** 这些痕迹,输出干净的文件,或**原地覆盖**原文件(覆盖前自动备份)。

支持格式:PNG / JPG / JPEG / WebP / GIF / BMP / TIFF / AVIF / HEIC / HEIF / SVG 图片,MP4 / MOV / MKV / WebM 等视频。

> HEIC/HEIF(iPhone 照片)无法无损剥离, 清理时会转码为**同名 .jpg**(约 92 质量); 原地模式下原 .heic 在备份后删除。
> SVG(矢量图)为 XML 文本级剥离(注释/metadata 块/generator 属性), 像素级操作不可用。

---

## 快速开始

### 方式一:图形界面(推荐)

双击 **run.bat** → 自动打开浏览器进入界面(现代暗色风格):

1. **直接把图片/视频拖进页面**(或点击选择),自动检测 AI 痕迹,卡片展示风险等级和每一项发现
2. 勾选清理选项 → 点「清理此文件」或「全部清理」
3. 清理后直接点「下载清理后的文件」;或切换到「本地文件夹」标签,原地处理磁盘上的文件(自动备份)

- 「拖入文件」标签 → 文件只传到本机工作区处理,清理后一键下载
- 「本地文件夹」标签 → 输入路径扫描,支持原地覆盖+备份、递归子文件夹
- 全部处理只在本机进行,不会上传到任何服务器

界面功能:
- **简洁主界面**: 上传区 + 唯一的「清理模式」选择(普通/深度两个胶囊) + 行式文件列表, 主界面零开关
- **普通模式**: 不检测隐形水印, 无损剥离全部元数据/AI痕迹/C2PA, 像素一个不动
- **深度模式**: 检测并报告 SD 像素级隐形水印, 图片重编码 + 修补右下角可见水印 + 破坏隐形水印(色度低通+重采样+旋转, 画质轻微变化); 视频则完全转码
- **高级选项抽屉**: ⚙ 按钮滑出侧栏(清理强度/隐形水印对抗/伪造人类痕迹/文件夹模式), 自由组合; 改动后自动标记「自定义」并重扫; 每个选项鼠标悬停弹出通俗解释(随语言); GPS/地区 未勾选「相机 EXIF」时自动置灰, 备份未勾选「原地覆盖」时置灰
- **中英文切换**(右上角 EN/中文 按钮, 记忆选择); 检测结果与清理说明随语言切换
- **使用条款子页面**(/terms): 完整免责声明, 中英文按语言匹配显示(不同时显示); 首页含合法使用横幅与上传同意提示
- **深浅主题切换**(右上角 ☀️/🌙 按钮, 记忆选择)
- 每行文件默认折叠「ⓘ 痕迹与元数据」详情(含完整元数据清单); 清理后显示**大小对比**(如 128 KB → 96 KB, 省 25%)
- 批量上传/文件夹批量清理; **视频处理显示真实进度百分比**(ffmpeg -progress 轮询)

### 方式二:命令行

    :: 检测
    py ai_clean.py scan 图片.png 视频.mp4
    py ai_clean.py scan 素材文件夹 --recursive

    :: 清理:输出到 cleaned 文件夹(原文件不动, 无损不降画质)
    py ai_clean.py clean 素材文件夹 --recursive

    :: 清理:原地覆盖, 自动备份到 backup
    py ai_clean.py clean 素材文件夹 --recursive --inplace

    :: 更强清理:图片重编码 + 修补可见水印色块
    py ai_clean.py clean 图.jpg --recompress --remove-visible

    :: 对抗隐形水印(Stable Diffusion dwtDct 方案, 三级强度, 每次随机)
    py ai_clean.py clean 图.png --anti-wm medium

    :: 伪造人类痕迹(相机 EXIF + 唯一序列号 + Lightroom 编辑历史 + 城市池 GPS)
    :: 默认地区为美国; 用 --forge-region 切换 cn/eu/jp
    py ai_clean.py clean 图.jpg --forge-meta --forge-gps random
    py ai_clean.py clean 图.jpg --forge-meta --forge-gps random --forge-region eu

    :: 视频完全转码(默认只做无损重封装剥元数据)
    py ai_clean.py clean 视频.mp4 --transcode

### 方式三:监视文件夹(全自动)

    py ai_clean.py watch 待处理文件夹

把文件丢进这个文件夹,几秒内自动清理到「待处理文件夹\已清理」。
加 --inplace 则原地替换并把原文件备份到 backup。Ctrl+C 退出。

---

## 清理选项说明

| 选项 | 作用 | 代价 |
|---|---|---|
| (默认) | 无损剥离全部元数据/AI水印/C2PA,像素一个不动 | 无画质损失 |
| --remove-visible | 修补右下角可见水印色块列(如 DALL-E 彩色方格) | 色块区域轻微模糊 |
| --recompress | 图片完全重编码(还会顺手把照片方向摆正) | 画质略降(约 93 质量) |
| --aggressive | 重编码 + 轻微重采样扰动,对抗像素级隐形水印 | 画质轻微变化 |
| --transcode | 视频完全转码(H.264/AAC) | 重新压缩,画质略降 |
| --keep-icc | 保留色彩配置(PNG iCCP / JPEG APP2 / WebP ICCP, 默认也一并移除) | — |
| --anti-wm light/medium/strong | 对抗隐形水印: 色度低通 → 加重采样+旋转 → 加噪声; 每文件每次随机, 扰动后闭环复验 | 画质轻微变化 |
| --forge-meta | 伪造人类痕迹: 随机真实机型 EXIF + 每文件唯一序列号 + 编辑历史(XMP); 字节级注入, **像素无损** | — |
| --forge-gps off/random/lat,lng | 伪造 GPS(城市池随机坐标 + 抖动; 需 --forge-meta) | — |
| --forge-region us/cn/eu/jp | 伪造地区(默认美国): 城市池、时区、国家代码、机型过滤(如华为仅中国区) | — |
| --forge-icc | 附带 sRGB 色彩配置(独立开关) | — |
| --forge-pixel | 像素级相机感: 按 ISO 的泊松噪声 + 轻微暗角(独立开关, 默认关闭) | 画质轻微变化 |
| --forge-time-window "2023-01-01..now" | 拍摄时间窗(默认近 2 年随机; 需 --forge-meta) | — |
| --forge-batch | 同批文件共享机型/场景/地点, 唯一 ID 仍每文件不同(需 --forge-meta) | — |
| --seed HEX | 随机种子(调试复现; 默认每次运行都不同) | — |

> 默认模式对 PNG/JPEG/WebP 是**字节级无损剥离**(直接摘除元数据块,重算校验和),像素与原文件完全一致。

---

## 能检测到什么

- **C2PA 内容凭证**(DALL-E、Firefly、Photoshop 生成填充等写入的官方 AI 声明; 并解析清单里的 claim_generator 生成器与签名发行者)
- **生成器签名**:Midjourney / DALL-E / Stable Diffusion(A1111、ComfyUI 参数)/ Firefly / Flux / Sora / Runway / Kling 可灵 / 即梦 / Pika / Veo / 海螺 等
- **AI 标记字段**:DigitalSourceType、AIGC、AI-Generated、深度合成标记等
- **可见水印色块列**:右下角疑似生成器水印的彩色方格列
- **隐形水印**:Stable Diffusion 的 dwtDct 方案(DWT+DCT 扩频, 官方 Stability/SDXL diffusers 使用)——仅报告高置信信号(实测真实水印强度约 0.75, 阈值 0.65), 避免自然图像统计误报; 检出的水印用 --anti-wm(深度模式)必然可破坏。对抗见 --anti-wm(需先运行 fetch_deps.py --wm 安装检测栈)
- **各类元数据**:EXIF(相机型号、GPS 定位、拍摄时间)、XMP、IPTC、PNG 文本块、视频容器/流标签、内嵌封面等

---

## 效果边界(请务必了解)

1. **元数据清理 ≠ 绕过所有 AI 检测**。平台识别 AI 内容的手段除了元数据/C2PA 之外,还有**像素级分类器**(直接看画面判断是否 AI 生成)。这类检测看的是图像内容本身,任何元数据清理都无法消除。本工具能确保:文件里不再携带任何可被读取的 AI 声明与来源信息。
2. **隐形水印**:已实现对 Stable Diffusion dwtDct 方案(官方 96 位与 SDXL 48 位消息)的检测与闭环对抗(--anti-wm);Google SynthID 等**未公开检测方法**的方案不承诺检测,扰动可能削弱其鲁棒性但**不保证**。注意:默认无损剥离不改变像素,因此**不会**破坏像素级隐形水印,需显式加 --anti-wm(或 --recompress 输出为 JPEG 等降色度编码)。
3. **伪造人类痕迹(--forge-meta)只影响元数据信号**,对只看画面本身的像素级分类器无效;伪造内容与画面矛盾(如动漫风配"Canon 实拍")反而可疑。--forge-pixel 的相机噪声对部分检测器有效、对利用噪声特征的检测器可能适得其反,效果不确定,默认关闭。
4. 视频默认的「无损重封装」只剥离元数据,不改变画面;要改变画面比特流用 --transcode。

## 法律与平台合规提示

- 中国《人工智能生成合成内容标识办法》自 **2025 年 9 月 1 日**起施行,要求 AI 生成合成内容同时添加**显式标识**(如「本内容由 AI 生成」提示)和**隐式标识**(元数据/数字水印)。刻意去除隐式标识(--anti-wm)或**伪造来源信息**(--forge-*)后发布,可能违反该规定及平台规则;伪造的元数据对像素级 AI 分类器无效,请勿用于规避平台内容审核。
- Instagram/Facebook 等平台对**逼真**的 AI 生成内容有标注义务要求,检测到未标注可能限流甚至封号——风险比「被识别为 AI」本身更大。
- 本工具更适合这些正当用途:**清除照片 GPS 定位与相机信息保护隐私**、**用随机序列号替换真实机身序列号防止跨平台追踪**(--forge-meta)、清理自己的作品文件里的冗余元数据、文件精简、研究测试。请只处理你拥有权利的内容,去除他人水印可能构成侵权。

---

## 文件说明

| 文件 | 作用 |
|---|---|
| web_gui.py | Web 图形界面服务(启动后自动打开浏览器) |
| web/index.html | Web 界面页面(暗色现代风格, 支持拖拽文件, 中英双语) |
| web/terms.html | 使用条款子页面(免责声明, 中英文按语言匹配显示) |
| ai_clean.py | 核心引擎(检测+清理+命令行) |
| forge.py + camera_db.json | 伪人类痕迹引擎 + 真实机型档案库 |
| run.bat | 双击启动 Web 图形界面 |
| fetch_deps.py | 自动下载 Pillow + pillow-heif 到 vendor; --wm 下载隐形水印检测栈(numpy/opencv/PyWavelets)到 vendor_wm |
| make_samples.py | 生成带 AI 水印的测试样本 |
| verify.py | 清理效果自动验证(22 项检查) |
| vendor | 自带的 Pillow + pillow-heif 库(免安装, 支持 AVIF/HEIC) |
| 测试样本 | 演示用样本(含 cleaned 清理结果) |

## 纯前端 Web 版(webapp, GitHub Pages)

面向全球用户的零后端版本, 全部逻辑在浏览器内完成:

- 目录: `webapp/`(纯静态文件, 可直接整体上传 GitHub Pages; `index.html` + `terms.html`)
- 功能(P1+P2): PNG/JPG/WebP/SVG 字节级无损剥离 + GIF/BMP 重编码清理; C2PA/生成器签名扫描; EXIF/XMP 元数据清单; 普通/深度两模式(深度=检测并破坏 SD 隐形水印+重编码+修补可见水印); **伪造人类痕迹**(相机 EXIF+唯一序列号+编辑历史+城市池 GPS+地区联动+ICC+像素级相机感, 字节级注入像素无损); 批量处理; 中英双语(浏览器语言自适应); 深浅主题; 使用条款; 版权防护
- 功能(P3): **视频容器级元数据剥离**(MP4/MOV 盒遍历原位零化 udta/meta 与含 C2PA 的 uuid 为 free; MKV/WebM 的 Tags/Attachments/Info:Title/DateUTC 原位替换为 Void; AVI 的 LIST:INFO 原位替换为 JUNK — 全部保偏移、不转码、可直接播放)+ 视频元数据扫描(标题/作者/注释/编码器/C2PA/尺寸/时长); **HEIC 支持**(纯 JS 提取 Exif item 扫描 + libheif.wasm 懒加载解码转 JPEG, wasm 优先 fetch、file:// 下回退到内嵌 base64 脚本); 深度模式对视频同样仅容器级(诚实提示)
- 本地开发: 直接双击 `webapp/index.html` 即可; 单元测试: `node webapp/tests/*.test.mjs`(engine/antiwm/forge/i18n/video, 与桌面版 Python 引擎共用同一批测试样本做对照)
- 部署构建(防盗版): 保留 `webapp/js` 可读源码, 上线前用 javascript-obfuscator 压缩+混淆后上传
- 后续批次: P4 云端适配(视频转码/逐帧水印兜底)

## 环境要求(桌面版)

- Windows + Python 3.10+(已自带 vendor/Pillow 与 pillow-heif,无需 pip 安装)
- 视频处理需要 **ffmpeg** 在 PATH 中(https://www.gyan.dev/ffmpeg/builds/ 下载解压后把 bin 加入 PATH)
