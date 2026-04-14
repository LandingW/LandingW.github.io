export const profile = {
  name: "Land1ngW",
  nameReal: "王若淼",
  title: "游戏引擎开发 / 图形渲染工程师",
  subtitle: "UE5 · 全局光照 · 渲染管线 · 光线追踪",
  email: "1738832489@qq.com",
  phone: "17304471585",
  zhihu: "https://www.zhihu.com/people/wrm-66-76",
  github: "https://github.com/LandingW",
};

export const education = [
  {
    school: "华南理工大学",
    badge: "985 · 双一流",
    degree: "本科 · 软件工程",
    period: "2024.09 — 至今",
  },
];

export const experiences = [
  {
    company: "米哈游",
    department: "Varsapura",
    role: "图形程序",
    period: "2026.04 — 至今",
    icon: "/company-icons/mhy-cutout.png",
    iconWidth: 262,
    iconHeight: 93,
    iconDisplayHeight: 30,
    highlights: [
      {
        title: "当前状态",
        desc: "2026.04 起在米哈游 Varsapura 工作。",
      },
    ],
  },
  {
    company: "腾讯 IEG",
    department: "天美 G1 工作室",
    role: "游戏引擎图形开发实习生（GI / UE5）",
    period: "2025.05 — 2026.04",
    icon: "/company-icons/tencent.png",
    iconWidth: 420,
    iconHeight: 208,
    iconDisplayHeight: 34,
    highlights: [
      {
        title: "持续一年深度参与自研 GI 系统研发",
        desc: "围绕基于体积 Probe / SH 的自研全局光照系统持续 1 年进行源码级研发，长期覆盖离线烘焙、运行时流式、屏幕采样、时域积累、空间滤波、Sky Visibility 与硬件光追增量更新全链路；能够在 UE 渲染主干、插件模块、Shader 与调试工具之间独立定位并推进复杂问题。",
      },
      {
        title: "核心支撑 G1 预研 3A 项目 GI 方案工程化落地",
        desc: "作为核心开发者推进自研 GI 在预研 3A 项目中的实际接入，搭建面向中低算力平台的离线预计算与运行时采样方案，将 Skylight Visibility 从运行时解耦为离线数据，并兼容 TOD（Time of Day）动态天光变化；系统性缓解漏光、性能瓶颈与画面稳定性问题，方案通过技术评审并进入项目集成。",
      },
      {
        title: "打通 Probe GI 从 Runtime 数据到屏幕结果的完整链路",
        desc: "深度参与 GI Runtime 数据结构、FScene/FViewInfo 桥接、Uniform 填充与 Gather / Temporal / Spatial Pass 实现，支撑 Compute 异步采样与全屏 Pixel 两条路径；围绕世界坐标到 Probe Atlas / Page Texture 的映射、历史结果继承与边缘保护去噪，持续优化复杂场景下的间接光稳定性与一致性。",
      },
      {
        title: "SparseRT 增量更新与多次反弹能力研发",
        desc: "负责基于硬件光追的 Probe 稀疏更新能力建设，参与 active probe 选择、Ray Trace、SH Reduce、Temporal Writeback、Irradiance Upload 等关键环节研发；推进 recursive bounce、probe relocation、Chebyshev / simple occlusion / runtime validity 等机制协同，增强封闭空间、洞穴、薄壳结构附近的能量表现与收敛稳定性。",
      },
      {
        title: "大世界 GI Streaming 与自适应资源调度优化",
        desc: "围绕稀疏存储、indirection / page atlas、brick 升降级与 HZB 遮挡参与流式系统优化，设计异步排序与按帧预算重分配策略，使近场高价值区域优先保留高精度数据，降低大地图场景下因 GI 数据加载、页迁移和资源重分配带来的显存压力与渲染抖动。",
      },
      {
        title: "构建 GI 工具链、可视化与源码文档体系",
        desc: "完善编辑器工具、可视化面板与 Ray Debug 捕获链路，支持 Probe / Brick 状态观察、SparseRT 调试、单 Probe 射线回放与运行时参数诊断；同时沉淀系统级源码说明与维护文档，明确模块职责、关键入口与排障路径，显著提升后续研发、联调与跨团队知识传递效率。",
      },
    ],
  },
  {
    company: "腾讯 IEG",
    department: "游戏前沿技术部",
    role: "腾讯引擎图形学远程人才培养计划",
    period: "2024 — 2025",
    icon: null,
    iconWidth: 0,
    iconHeight: 0,
    iconDisplayHeight: 0,
    highlights: [
      {
        title: "硬件光线追踪光照烘焙器开发",
        desc: "参与并深度开发基于 DXR 硬件光线追踪的自研光照烘焙器，负责扩展材质采样模型，新增对半透明材质、薄玻璃等复杂能量传输路径的支持，完善光线在非不透明介质中的传输与衰减计算，为高质量间接光结果提供更准确的材质响应基础。",
      },
      {
        title: "现代 GI 算法研究与工程实践",
        desc: "系统研究并实践 ReSTIR GI / ReSTIR DI / DDGI 等现代全局光照技术，深入理解各方案的采样策略、收敛特性与工程约束；熟悉 DXR 与 NVIDIA OptiX 完整工作流，具备从加速结构构建、光线调度、着色到降噪协同的全链路工程级理解，并为后续在天美持续一年的自研 GI 与 SparseRT 研发打下扎实基础。",
      },
    ],
  },
];

export const skills = [
  {
    category: "图形 API",
    items: ["OpenGL", "Vulkan", "DirectX 12", "NVIDIA OptiX", "DXR"],
  },
  {
    category: "引擎与语言",
    items: ["UE5 / Unreal Engine", "C++", "HLSL / GLSL", "Python"],
  },
  {
    category: "渲染技术",
    items: [
      "全局光照 (GI)",
      "路径追踪",
      "ReSTIR GI / DI",
      "DDGI",
      "Nanite",
      "光照烘焙",
      "实时光追",
    ],
  },
  {
    category: "GPU 架构",
    items: [
      "TBR / TBDR 移动端架构",
      "SIMT 执行模型",
      "Shader 性能优化",
      "Subpass / Framebuffer Fetch",
    ],
  },
  {
    category: "调试工具",
    items: ["RenderDoc", "PIX", "Nsight", "WinDbg", "LLDB / Rider"],
  },
  {
    category: "工程实践",
    items: [
      "UE5 源码级二次开发",
      "渲染管线定制",
      "Crash Dump 分析",
      "AI 辅助工程（Cursor / Gemini CLI）",
    ],
  },
];

export const navSections = [
  { id: "home", label: "Home" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "articles", label: "Writing" },
];
