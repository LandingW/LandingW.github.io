# Google 地图接入

> 历史方案，已于 2026-10-12 按所有者要求停用。当前前端已移除 Google SDK、API key 设置和相关请求，改为 Leaflet / OpenStreetMap 免费地图点选；不需要执行以下步骤。旧数据库字段仅保留兼容性，重新手动选点保存时可清除旧关联。当前用法见 [照片服务配置](PHOTOS-SETUP.md)。

## 当前状态

网站已实现 Google Maps JavaScript 地图、Places API（New）地点选择，以及按旅行显示地图标记。当前尚未提供有效的 Google 浏览器 API key，因此不会加载 Google SDK 或发起 Google Places 请求；现有图片和本地世界概览仍可使用。

## 你需要配置的部分

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 选择自己的项目。
2. 按 Google 的要求启用账单，并启用 **Maps JavaScript API** 和 **Places API（New）**。这可能产生费用；本次没有代你开通账单、付费套餐或 Google 项目。
3. 创建 **API key**，应用限制选择 **Websites / HTTP referrers**，只允许 `https://landingw.github.io/*`。如需本地测试，再明确加入本地来源，不要使用无限制 key。
4. API 限制只允许上述两个 API；为对应服务设置配额、预算和告警。不要提供服务账号 JSON、私钥、OAuth 客户端密钥或其他服务的 token。
5. 打开网站 `/travel/manage/`，登录后展开 **Google 地图服务**，填入这个受限的浏览器 key 并保存。浏览器 key 按设计会对访客可见，限制来源和 API 范围是必要步骤。
6. Map ID 可填写你自己的 Google Map ID；留空时使用 Google 官方示例 `DEMO_MAP_ID` 供初步验证。正式使用建议创建自己的 Map ID。

地图配置保存在公开 R2 `maps-config.json`，不是 GitHub 源码；更新配置不需要重建网站。如果替换了页面已经加载的 key，请刷新页面。

## 选旅行地点

在旅行信息里点击 **在 Google 地图选择地点**：

- 搜索城市、景点或具体地址，从候选项选择。
- 或直接点击 Google 地图上的地点/POI；也可点击空白地图或拖动标记来手动放置参考点。
- 保存旅行信息后，该旅行在地图上只显示一个标记。明确选定的旅行地点优先于照片 GPS。
- 地点标签是你自己的文字，可以自己填写；不会自动把 Google 地址文本存入数据库。

选择 Google Places 结果时，服务器只长期保存 **Place ID**，不保存 Google 返回的地址、名称或坐标。实际地点信息在 Google 地图中按需解析、仅在当前页面短暂复用，不放到本地存储或 R2 数据清单中。Google 地点不会被复制到 OpenStreetMap / Natural Earth 底图上。

没有 Google key 时仍可通过外链打开 Google Maps，或暂时使用已有的手动坐标工具；这不是已完成的 Google API 联调。

## 参考文档

- [Place Autocomplete Widget](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new)
- [地图 API key 与限制](https://developers.google.com/maps/documentation/javascript/get-api-key)
- [Places 内容缓存与署名要求](https://developers.google.com/maps/documentation/places/web-service/policies)

Google 地图真实搜索、选点与计费行为必须在用户配置 key 后验收，不能用静态测试代替。
