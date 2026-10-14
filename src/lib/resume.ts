export const profile = {
  name: "Land1ngW",
  nameReal: "王若淼",
  title: "图形程序 · 游戏引擎开发",
  email: "1738832489@qq.com",
  qq: "1738832489",
  wechat: "17304471585",
  zhihu: "https://www.zhihu.com/people/wrm-66-76",
  github: "https://github.com/LandingW",
};

// 公开技术栈与职责；不包含内部项目名称、算法细节、未公开画面或性能指标。
export const experiences = [
  {
    company: "米哈游",
    logo: { src: "/company-icons/mhy-cutout.png", width: 262, height: 93 },
    department: "Varsapura",
    role: "图形程序",
    period: "2026.04 — 至今",
    current: true,
    summary: "Nanite 光栅化与 PS5 图形开发",
    description:
      "在 Varsapura 项目做 UE5 渲染开发，主要涉及 Nanite Raster、GPU Shader 和 PS5 平台。日常工作包括修改渲染代码、排查画面问题，以及分析 GPU 的执行和资源开销。",
    tags: [
      "Nanite Raster",
      "GPU Programming",
      "PS5",
      "AMD RDNA",
      "C++ / HLSL / PSSL",
    ],
    highlights: [
      {
        title: "Nanite Raster",
        desc: "开发和调试 Nanite 的硬件、软件光栅路径，涉及 Visibility Buffer、屏幕覆盖和 Virtual Shadow Maps。排查几何与可见性问题，并对照主视图和阴影中的渲染结果。",
      },
      {
        title: "GPU Shaders / AMD RDNA",
        desc: "用 HLSL / PSSL 写 Shader。结合帧捕获、硬件计数器和 Shader ISA，检查 wave 执行、寄存器占用、访存、缓存与同步，再用实际场景验证分析结果。",
      },
      {
        title: "PC / PS5",
        desc: "处理 PC 与 PS5 上的 Shader 编译、变体和数值精度差异。复现几何、可见性与阴影异常后，通过帧捕获逐步定位出问题的渲染阶段。",
      },
      {
        title: "引擎集成与调试工具",
        desc: "维护 C++ 与 Shader 的数据接口，处理资源生命周期、异步任务和更新时序。编写几何与运行状态的可视化工具，辅助定位问题。",
      },
    ],
  },
  {
    company: "腾讯 IEG",
    logo: { src: "/company-icons/tencent.png", width: 420, height: 208 },
    department: "天美 G1 工作室",
    role: "游戏引擎图形开发",
    period: "2025.05 — 2026.04",
    current: false,
    summary: "UE5 全局光照系统",
    description:
      "参与 UE5 自研 GI 系统开发，做过离线烘焙、运行时采样、动态更新和大世界数据流式加载。工作涉及 Lightmass、渲染管线、Shader 和编辑器工具，也排查过漏光、噪声和闪烁问题。",
    tags: ["Unreal Engine 5", "Probe GI / SH", "DXR", "GI Streaming"],
    highlights: [
      {
        title: "Probe GI / SH",
        desc: "参与基于 Probe / SH 的 GI 方案，处理离线烘焙、数据存储和运行时查询。工作涉及漫反射间接光、天光可见性，以及天光变化时的数据更新。",
      },
      {
        title: "GI 采样与时空滤波",
        desc: "参与屏幕空间 GI 采样、时域积累和空间滤波。通过深度、法线、采样权重等中间结果，排查漏光、噪声、历史数据失效和移动视角时的闪烁。",
      },
      {
        title: "DXR / 动态 GI 更新",
        desc: "参与基于硬件光追的稀疏光照更新，处理动态几何和光照变化下的积累、收敛问题。检查光照、遮挡和 Probe 位置是否对应，并接入运行时采样。",
      },
      {
        title: "GI Streaming / 调试工具",
        desc: "参与大世界 GI 数据流式加载、分级资源调度和异步处理，检查显存占用和每帧的更新量。编写 Probe / Brick 状态显示、射线调试工具和编辑器面板。",
      },
    ],
  },
  {
    company: "腾讯 IEG",
    logo: { src: "/company-icons/tencent.png", width: 420, height: 208 },
    department: "游戏前沿技术部",
    role: "引擎图形学远程人才培养计划",
    period: "2024 — 2025",
    current: false,
    summary: "DXR 光照烘焙与 GPU 编程",
    description:
      "在远程培养计划中参与 DXR 光照烘焙器开发，学习材质采样与光线传输。同时学习 CUDA、OptiX、ReSTIR 和 DDGI，并整理相关笔记。",
    tags: ["DXR", "CUDA / OptiX", "ReSTIR / DDGI", "光照烘焙"],
    highlights: [
      {
        title: "DXR / 材质采样",
        desc: "参与硬件光追烘焙器开发，扩展材质采样，研究半透明、薄玻璃材质的反射、折射和能量响应。",
      },
      {
        title: "CUDA / OptiX / ReSTIR",
        desc: "学习 CUDA 与 OptiX，练习加速结构、Shader Binding Table、光线生成及命中着色。阅读和实践 ReSTIR DI / GI、DDGI，研究采样与收敛。",
      },
    ],
  },
];

export const skills = [
  {
    number: "01",
    title: "图形与渲染",
    english: "Rendering",
    description: "工作和学习中接触的渲染技术。",
    items: [
      "Global Illumination",
      "Ray Tracing",
      "Nanite HW / SW Raster",
      "Virtual Shadow Maps",
      "ReSTIR / DDGI",
    ],
  },
  {
    number: "02",
    title: "GPU 与主机",
    english: "GPU & Console",
    description: "Shader、平台开发和 GPU 调试。",
    items: [
      "PS5 Graphics Development",
      "AMD RDNA / Wavefronts",
      "HLSL / PSSL / GLSL",
      "Shader ISA / Occupancy",
      "PIX / Nsight / RenderDoc",
    ],
  },
  {
    number: "03",
    title: "引擎与计算",
    english: "Engine & Compute",
    description: "主要使用的引擎、API 和工具。",
    items: [
      "Unreal Engine 5 / C++",
      "CUDA / NVIDIA OptiX",
      "DirectX 12 / Vulkan / DXR",
      "Render Graph / Async Tasks",
      "Python / WinDbg",
    ],
  },
];

export const navSections = [
  { id: "experience", label: "经历" },
  { id: "skills", label: "技术" },
  { id: "articles", label: "文章" },
  { id: "travel", label: "旅行" },
];
