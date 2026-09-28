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
    summary: "从 Nanite 光栅化，到主机平台上的每一帧。",
    description:
      "参与 Unreal Engine 5 实时几何与渲染管线研发，工作覆盖 Nanite Raster、GPU Shader 编程、PS5 图形开发与引擎集成。从几何数据与可见性，到最终像素和阴影结果，关注不同渲染路径下的正确性、资源开销与工程稳定性。",
    tags: [
      "Nanite Raster",
      "GPU Programming",
      "PS5",
      "AMD RDNA",
      "C++ / HLSL / PSSL",
    ],
    highlights: [
      {
        title: "Nanite Raster / Virtualized Geometry",
        desc: "参与 Nanite 硬件与软件光栅路径的开发和调试，涉及实时几何细节、Visibility Buffer、屏幕覆盖与 Virtual Shadow Maps。沿几何处理、可见性与光栅化链路分析问题，关注主视图、阴影及不同路径之间的表现一致性。",
      },
      {
        title: "GPU Shaders / AMD RDNA",
        desc: "使用 HLSL / PSSL 进行 GPU 侧开发，结合帧捕获、硬件计数器和 Shader ISA 理解执行行为。分析 wave 执行、寄存器占用、访存、缓存与同步依赖，并把静态指令分析与实际场景中的测量对应起来。",
      },
      {
        title: "PS5 / Platform Development",
        desc: "围绕 PC 与 PS5 的图形开发处理着色器编译兼容性、Shader 变体、数值精度及平台差异问题。通过场景复现、帧捕获和逐阶段排查，定位几何、可见性与阴影相关的渲染异常。",
      },
      {
        title: "Engine Integration / Tooling",
        desc: "维护 C++ 与 Shader 之间的数据约定，处理资源生命周期、异步任务、线程边界及运行时更新时序。建设几何与状态可视化工具，把最终画面中的问题追溯到具体模块，并结合代码审查整理职责与接口。",
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
    summary: "让全局光照从研究走向实际场景。",
    description:
      "持续参与 UE5 自研全局光照系统研发，从离线光照数据生产，到运行时采样、动态更新与大世界资源管理，连接 Lightmass、渲染管线、Shader 和编辑器工具。工作重点是间接光表现、数据一致性以及复杂场景下的问题定位。",
    tags: ["Unreal Engine 5", "Probe GI / SH", "DXR", "GI Streaming"],
    highlights: [
      {
        title: "Probe GI / Light Transport",
        desc: "参与基于 Probe / SH 的全局光照方案，覆盖离线烘焙、光照数据组织和运行时查询。围绕漫反射间接光、天光可见性与动态天光变化，衔接预计算数据和实时渲染结果。",
      },
      {
        title: "Sampling / Temporal & Spatial Filtering",
        desc: "参与屏幕空间 GI 采样、时域积累和空间滤波，分析漏光、噪声、历史数据失效与画面闪烁等问题。结合深度、法线和采样权重检查中间结果，关注移动视角与复杂几何附近的稳定性。",
      },
      {
        title: "DXR / Dynamic GI Updates",
        desc: "参与基于硬件光追的稀疏光照更新，研究动态几何与光照变化下的响应、积累和收敛。处理光照、遮挡信息及 Probe 位置之间的数据一致性，将实时更新接入既有运行时采样链路。",
      },
      {
        title: "Streaming / GPU Debug Tools",
        desc: "参与大世界 GI 数据流式、分级资源调度和异步处理，关注页资源、显存与按帧工作量。制作 Probe / Brick 状态可视化、射线调试和编辑器面板，结合 GPU capture 与源码分析建立可复现的排查路径。",
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
    summary: "从光线出发，理解渲染。",
    description:
      "参与 DXR 光照烘焙器开发，研究材质采样与光线传输；学习与实践 ReSTIR、DDGI、NVIDIA OptiX 等现代渲染技术。",
    tags: ["DXR", "CUDA / OptiX", "ReSTIR / DDGI", "光照烘焙"],
    highlights: [
      {
        title: "DXR / Lighting & Material Sampling",
        desc: "参与硬件光追光照烘焙器开发，学习并扩展材质采样与光线传输，研究半透明、薄玻璃等材质中的反射、折射和能量响应，将渲染理论与具体的 GPU 实现对应起来。",
      },
      {
        title: "CUDA / OptiX / GI Research",
        desc: "学习 CUDA 与 NVIDIA OptiX 的 GPU 编程流程，实践加速结构、Shader Binding Table、光线生成及命中着色。结合 ReSTIR DI / GI、DDGI 等技术理解采样、收敛和实时渲染中的工程取舍，并整理学习笔记。",
      },
    ],
  },
];

export const skills = [
  {
    number: "01",
    title: "图形与渲染",
    english: "Rendering",
    description: "从光的传输，到屏幕上的每一个像素。",
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
    description: "理解 GPU 的执行方式，把每一帧的问题讲清楚。",
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
    description: "把算法、工具与系统连接成可以持续演进的工程。",
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
  { id: "skills", label: "专注" },
  { id: "articles", label: "文字" },
];
