// 头部「浮雕」平面的自定义着色器：
// 顶点着色器采样 depth 贴图把平面沿视线挤出立体轮廓；片元着色器做
// 法线贴图光照 + 边缘光，并用 alpha 贴图裁剪背景。

export const HEAD_VERTEX_SHADER = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;

  varying vec2 vUv;
  varying vec3 vViewDir;
  varying mat3 vRot;

  void main() {
    vUv = uv;

    // depth 贴图里越亮表示离相机越近，沿视线方向挤出顶点
    float depth = texture2D(uDepth, uv).r;

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec3 toCamera = cameraPosition - worldPos.xyz;
    vec3 viewDir = normalize(toCamera);
    worldPos.xyz += viewDir * depth * uDepthScale;

    // 模型的旋转矩阵，用于把切线空间法线贴图变换到世界空间
    vRot = mat3(modelMatrix);
    vViewDir = -viewDir;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

export const HEAD_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uDiffuse;
  uniform sampler2D uAlpha;
  uniform sampler2D uNormal;

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

  void main() {
    vec4 diffuse = texture2D(uDiffuse, vUv);
    vec4 alphaMap = texture2D(uAlpha, vUv);
    vec3 normalMap = texture2D(uNormal, vUv).xyz;

    // sRGB → 线性：diffuse 是颜色贴图，直接在 gamma 空间做光照乘法会让颜色变灰发闷。
    // 先解码到线性空间计算，最后再编码回 sRGB 输出。
    vec3 albedo = pow(diffuse.rgb, vec3(2.2));

    // 法线贴图 → 世界空间光照（uNormalStrength 可整体调弱法线强度）
    vec3 nTex = normalMap * 2.0 - 1.0;
    nTex.xy *= uNormalStrength;
    vec3 N = normalize(vRot * normalize(nTex));
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(vViewDir);

    // 半兰伯特 + wrap：暗部保留一定亮度，避免阴影死黑导致画面灰暗
    float diff = max(dot(N, L), 0.0);
    float wrap = diff * 0.6 + 0.4;

    // 边缘光：让头部边缘带一层冷色描边，更有「全息投影」的感觉
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec3 color = albedo * (uAmbientColor + uLightColor * uLightStrength * wrap);
    color += uRimColor * rim * uRimStrength;

    // 线性 → sRGB：恢复到显示器上的正确颜色
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, alphaMap.r);
  }
`
