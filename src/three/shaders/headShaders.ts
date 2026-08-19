// 头部「浮雕」平面的自定义着色器：
// 用视差贴图（Parallax Mapping）在片元着色器里按视角偏移 UV 采样，
// 不挤出顶点 —— 因此完全没有网格棱角，效果平滑细腻；配合法线贴图光照 + 边缘光，
// 并用 alpha 贴图裁剪背景。

export const HEAD_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vViewDir;   // 切线空间（局部）视角方向，Z 朝平面法线
  varying mat3 vRot;

  void main() {
    vUv = uv;

    // 局部空间下的视线方向：平面在 XY 面、法线为 +Z
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec3 toCamera = cameraPosition - worldPos.xyz;
    // 把世界视线转到模型的局部空间（平面未旋转时即切线空间）
    vViewDir = normalize(mat3(inverse(modelMatrix)) * toCamera);

    // 模型的旋转矩阵，用于把切线空间法线贴图变换到世界空间
    vRot = mat3(modelMatrix);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

export const HEAD_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uDiffuse;
  uniform sampler2D uAlpha;
  uniform sampler2D uDepth;
  uniform sampler2D uNormal;

  uniform float uDepthScale;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform float uLightStrength;
  uniform vec3 uAmbientColor;
  uniform vec3 uRimColor;
  uniform float uRimStrength;
  uniform float uNormalStrength;
  uniform float uAlphaCutoff;

  varying vec2 vUv;
  varying vec3 vViewDir;
  varying mat3 vRot;

  // 视差贴图：根据视角偏移 UV。depth 越亮越靠近相机，偏移越大。
  vec2 parallaxUv(vec2 uv, vec3 viewDir) {
    // 只在切线平面 (XY) 上偏移，强度由视线 Z 分量控制
    float depth = texture2D(uDepth, uv).r;
    vec2 offset = viewDir.xy / max(viewDir.z, 0.2) * (depth * uDepthScale);
    return uv + offset;
  }

  void main() {
    vec3 V = normalize(vViewDir);
    vec2 uv = parallaxUv(vUv, V);

    // 超出贴图范围（视差拉到边界外）直接丢弃，避免采样到相邻边缘
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;

    vec4 diffuse = texture2D(uDiffuse, uv);
    vec4 alphaMap = texture2D(uAlpha, uv);
    vec3 normalMap = texture2D(uNormal, uv).xyz;

    // diffuse 已设置 colorSpace = SRGBColorSpace，GPU 采样时自动完成 sRGB → 线性解码，
    // 这里不能再 pow(2.2) 二次解码，否则中灰会被压成 0.032，颜色严重变暗。
    vec3 albedo = diffuse.rgb;

    // 法线贴图 → 世界空间光照
    vec3 nTex = normalMap * 2.0 - 1.0;
    nTex.xy *= uNormalStrength;
    vec3 N = normalize(vRot * normalize(nTex));
    vec3 L = normalize(uLightDir);
    V = normalize(V);

    float diff = max(dot(N, L), 0.0);
    float wrap = diff * 0.6 + 0.4;

    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec3 color = albedo * (uAmbientColor + uLightColor * uLightStrength * wrap);
    // color += uRimColor * rim * uRimStrength;

    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, alphaMap.r);
  }
`
