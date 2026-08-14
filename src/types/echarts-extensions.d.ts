/** echarts-gl (bar3D/surface/grid3D — buildBar3DOption, buildPie3DOption)
 * and echarts-liquidfill (buildWaveOption) are both plain side-effect
 * imports — `import "echarts-gl"` — that register new chart types on the
 * shared `echarts` module instance; nothing is ever imported *from* them
 * by name. Neither package ships its own TypeScript declarations (and
 * there's no @types package for either), so without this file `tsc`
 * fails the build with "implicitly has an 'any' type" the moment either
 * module is imported anywhere (see ChartRenderer.tsx's lazy `import()`
 * calls). Declaring them as untyped modules is correct here, not a
 * workaround: there's no API surface from these packages we actually
 * call directly, so there's nothing meaningful to type. */
declare module "echarts-gl";
declare module "echarts-liquidfill";
