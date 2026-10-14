import { MAX_INK_SURFACES, type InkSurface } from "./ink-field";

const vertex = `attribute vec2 a_position;
varying vec2 v_uv;
void main() { v_uv = (a_position + 1.0) * .5; gl_Position = vec4(a_position, 0.0, 1.0); }`;

// One precomputed texture sample. No fractal iteration, time noise or blur pass.
export const INK_FRAGMENT = `precision highp float;
varying vec2 v_uv;
uniform sampler2D u_ink;
uniform vec2 u_size;
uniform float u_offset;
uniform int u_count;
uniform vec4 u_boxes[6];
uniform float u_radii[6];
void main() {
  vec2 p = vec2(v_uv.x, 1.0 - v_uv.y) * u_size;
  vec2 displacement = vec2(0.0);
  float weightSum = 0.0;
  float paper = 1.0;
  float reach = u_size.x < 600.0 ? 32.0 : 62.0;
  for (int i = 0; i < 6; i++) {
    if (i < u_count) {
      vec4 box = u_boxes[i];
      float r = min(u_radii[i], min(box.z, box.w) * .5);
      vec2 local = p - box.xy - box.zw * .5;
      vec2 q = abs(local) - box.zw * .5 + r;
      vec2 outside = max(q, 0.0);
      float len = length(outside);
      float distance = len + min(max(q.x, q.y), 0.0) - r;
      float margin = min(reach, min(box.z, box.w) * .22);
      float t = clamp(abs(distance) / max(margin, 1.0), 0.0, 1.0);
      float w = (1.0 - t*t) * (1.0 - t*t);
      vec2 normal = len > .001 ? outside / len : (q.x > q.y ? vec2(1., 0.) : vec2(0., 1.));
      displacement += sign(local) * normal * w * margin * .23;
      weightSum += w;
      paper = min(paper, smoothstep(-3.0, 18.0, distance));
    }
  }
  p -= displacement / max(1.0, weightSum);
  vec2 uv = vec2((p.x / u_size.x + .06) / 1.12, (p.y - u_offset) / u_size.y / 1.4);
  vec4 ink = texture2D(u_ink, clamp(uv, 0.0, 1.0));
  vec3 color = mix(vec3(247.,245.,239.) / 255., ink.rgb, ink.a * paper);
  gl_FragColor = vec4(color, 1.0);
}`;

export function createInkRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram(),
    buffer = gl.createBuffer(),
    texture = gl.createTexture();
  const dispose = () => {
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteProgram(program);
    gl.deleteBuffer(buffer);
    gl.deleteTexture(texture);
  };
  try {
    if (!program || !buffer || !texture)
      throw new Error("Ink resources unavailable");
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, INK_FRAGMENT],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Ink shader unavailable");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("Ink shader unsupported");
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Ink program unsupported");
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const size = uniform("u_size"),
      offset = uniform("u_offset"),
      count = uniform("u_count"),
      boxes = uniform("u_boxes[0]"),
      radii = uniform("u_radii[0]");
    gl.uniform1i(uniform("u_ink"), 0);
    const rects = new Float32Array(MAX_INK_SURFACES * 4),
      corners = new Float32Array(MAX_INK_SURFACES);
    return {
      upload(image: HTMLImageElement) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          image,
        );
      },
      draw(
        width: number,
        height: number,
        camera: number,
        surfaces: InkSurface[],
      ) {
        surfaces.forEach((box, i) => {
          rects.set([box.x, box.y, box.width, box.height], i * 4);
          corners[i] = box.radius;
        });
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(size, width, height);
        gl.uniform1f(offset, camera);
        gl.uniform1i(count, surfaces.length);
        gl.uniform4fv(boxes, rects);
        gl.uniform1fv(radii, corners);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      dispose,
    };
  } catch {
    dispose();
    return null;
  }
}
