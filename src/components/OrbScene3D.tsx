import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AssistantStatus } from "../types";

const sphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const sphereFragmentShader = `
  uniform float uEnergy;
  uniform float uBreath;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(vNormal, viewDirection), 0.0);
    float fresnel = pow(1.0 - facing, 2.15);
    float hardRim = pow(1.0 - facing, 6.5);
    float lower = smoothstep(0.2, -0.96, vNormal.y);
    float upper = smoothstep(-0.1, 0.92, vNormal.y);
    float lowerArc = exp(-pow(vNormal.y + 0.86, 2.0) * 18.0) * pow(1.0 - facing, 0.55);
    float topFalloff = smoothstep(0.04, 0.9, vNormal.y) * pow(facing, 0.8);
    float bottomCore = exp(-pow(vNormal.y + 0.72, 2.0) * 10.0) * pow(facing, 1.25);

    vec3 voidBlue = vec3(0.0006, 0.006, 0.026);
    vec3 deepBlue = vec3(0.002, 0.019, 0.095);
    vec3 rimBlue = vec3(0.0, 0.25, 1.0);
    vec3 iceBlue = vec3(0.55, 0.86, 1.0);

    vec3 color = mix(voidBlue, deepBlue, pow(facing, 1.45) * 0.5);
    color *= 1.0 - upper * 0.74 - topFalloff * 0.18;
    color += deepBlue * lower * (0.2 + uBreath * 0.05);
    color += rimBlue * bottomCore * (0.08 + uBreath * 0.04);
    color += rimBlue * fresnel * (0.68 + uEnergy * 0.12);
    color += iceBlue * hardRim * (0.82 + uEnergy * 0.15);
    color += rimBlue * lowerArc * (0.5 + uBreath * 0.18);

    float alpha = 0.9 + hardRim * 0.1;
    gl_FragColor = vec4(color, alpha);
  }
`;

const haloFragmentShader = `
  uniform float uEnergy;
  uniform float uBreath;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 viewDirection = normalize(-vViewPosition);
    float facing = max(dot(vNormal, viewDirection), 0.0);
    float rim = pow(1.0 - facing, 1.85);
    float lower = smoothstep(0.05, -0.9, vNormal.y);
    float alpha = rim * (0.2 + uBreath * 0.08 + uEnergy * 0.08) + lower * rim * 0.12;
    vec3 color = mix(vec3(0.0, 0.08, 0.75), vec3(0.1, 0.55, 1.0), rim);
    gl_FragColor = vec4(color, alpha);
  }
`;

const nebulaVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nebulaFragmentShader = `
  uniform float uTime;
  uniform float uEnergy;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - vec2(0.5);
    float distanceFromCenter = length(vec2(p.x * 0.82, p.y * 1.16));
    float edgeFade = 1.0 - smoothstep(0.34, 0.5, length(p));
    float haze = (1.0 - smoothstep(0.08, 0.5, distanceFromCenter)) * edgeFade;
    float sideGlow = exp(-pow((p.x + 0.08) * 1.28, 2.0) - pow((p.y + 0.06) * 1.9, 2.0));
    sideGlow *= edgeFade;
    float pulse = 0.82 + sin(uTime * 0.65) * 0.18;
    float alpha = (haze * 0.018 + sideGlow * 0.036) * pulse * (0.88 + uEnergy * 0.22);
    vec3 color = vec3(0.0, 0.19, 0.95);
    gl_FragColor = vec4(color, alpha);
  }
`;

const particleVertexShader = `
  uniform float uTime;
  uniform float uActivity;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute float aScale;
  attribute float aPhase;
  varying float vAlpha;

  void main() {
    vec3 animated = position;
    animated.x += sin(uTime * (0.14 + uActivity * 0.06) + aPhase) * (0.004 + aScale * 0.004);
    animated.y += cos(uTime * (0.11 + uActivity * 0.05) + aPhase * 1.3) * (0.004 + aScale * 0.005);

    vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uSize * uPixelRatio * (0.55 + aScale * 0.9) * (1.0 + uActivity * 0.05);
    vAlpha = (0.42 + aScale * 0.58) * (0.72 + sin(uTime * (0.7 + aScale * 0.4) + aPhase) * 0.28);
  }
`;

const particleFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float d = length(p);
    float core = 1.0 - smoothstep(0.0, 0.16, d);
    float glow = 1.0 - smoothstep(0.08, 0.5, d);
    float alpha = (core + glow * 0.45) * vAlpha * uOpacity;
    if (alpha < 0.012) discard;
    vec3 color = mix(uColor, vec3(0.76, 0.92, 1.0), core * 0.7);
    gl_FragColor = vec4(color, alpha);
  }
`;

function stateEnergy(status: AssistantStatus, time: number) {
  if (status === "listening") return 0.74 + Math.abs(Math.sin(time * 4.8)) * 0.24;
  if (status === "thinking") return 0.64 + Math.sin(time * 2.8) * 0.1;
  if (status === "responding") return 0.82 + Math.abs(Math.sin(time * 7.6)) * 0.42;
  return 0.18;
}

function stateActivity(status: AssistantStatus) {
  if (status === "thinking") return 3;
  if (status === "responding") return 2.15;
  if (status === "listening") return 1.62;
  return 1;
}

function stateScale(status: AssistantStatus, time: number) {
  if (status === "listening") return 1.052 + Math.sin(time * 4.8) * 0.014;
  if (status === "responding") return 1.03 + Math.sin(time * 7.6) * 0.012;
  if (status === "thinking") return 1.012 + Math.sin(time * 2.4) * 0.006;
  return 1 + Math.sin(time * 1.15) * 0.004;
}

function lerpUniform(material: THREE.ShaderMaterial | null, name: string, target: number, amount = 0.08) {
  if (!material) return;
  material.uniforms[name].value += (target - material.uniforms[name].value) * amount;
}

function pseudoRandom(index: number, salt: number) {
  const value = Math.sin((index + 1) * (12.9898 + salt * 19.731)) * 43758.5453;
  return value - Math.floor(value);
}

function createStarCloud(count: number, radius: number, shell = false) {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const a = pseudoRandom(index, shell ? 4.2 : 1.1);
    const b = pseudoRandom(index, shell ? 6.7 : 2.3);
    const c = pseudoRandom(index, shell ? 8.1 : 3.9);
    const theta = a * Math.PI * 2;
    const phi = Math.acos(2 * b - 1);
    const distribution = shell ? 0.86 + c * 0.16 : Math.pow(c, 0.52);
    const r = radius * distribution;
    const lowerBias = shell ? 0 : -0.08 * Math.pow(pseudoRandom(index, 13.2), 1.7);

    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[index * 3 + 1] = Math.cos(phi) * r * (shell ? 0.98 : 0.92) + lowerBias;
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r * 0.58;
    scales[index] = shell
      ? 0.18 + Math.pow(pseudoRandom(index, 10.4), 3.2) * 1.08
      : 0.16 + Math.pow(pseudoRandom(index, 11.6), 2.7) * 1.55;
    phases[index] = theta + pseudoRandom(index, 12.8) * Math.PI * 2;
  }

  return { positions, scales, phases };
}

function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.zoom = 120 * Math.min(1, size.width / 500);
    camera.updateProjectionMatrix();
  }, [camera, size.width]);

  return null;
}

function OrbGeometry({ status }: { status: AssistantStatus }) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const haloMeshRef = useRef<THREE.Mesh>(null);
  const rimRef = useRef<THREE.Mesh>(null);
  const rimGlowRef = useRef<THREE.Mesh>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const haloRef = useRef<THREE.ShaderMaterial>(null);
  const nebulaRef = useRef<THREE.ShaderMaterial>(null);
  const innerStarRef = useRef<THREE.Points>(null);
  const shellStarRef = useRef<THREE.Points>(null);
  const innerMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const shellMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const rimMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const rimGlowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  const pixelRatio = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio, 1.75);
  const innerStars = useMemo(() => createStarCloud(460, 1.12), []);
  const shellStars = useMemo(() => createStarCloud(220, 1.22, true), []);

  const sphereUniforms = useMemo(() => ({
    uEnergy: { value: 0.18 },
    uBreath: { value: 0 },
  }), []);
  const haloUniforms = useMemo(() => ({
    uEnergy: { value: 0.18 },
    uBreath: { value: 0 },
  }), []);
  const nebulaUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uEnergy: { value: 0.18 },
  }), []);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const energy = stateEnergy(status, elapsed);
    const breath = Math.sin(elapsed * 1.2) * 0.5 + 0.5;
    const activity = stateActivity(status);
    const visualScale = stateScale(status, elapsed);

    if (shaderRef.current) {
      shaderRef.current.uniforms.uEnergy.value += (energy - shaderRef.current.uniforms.uEnergy.value) * 0.08;
      shaderRef.current.uniforms.uBreath.value = breath;
    }
    if (haloRef.current) {
      haloRef.current.uniforms.uEnergy.value += (energy - haloRef.current.uniforms.uEnergy.value) * 0.08;
      haloRef.current.uniforms.uBreath.value = breath;
    }
    if (nebulaRef.current) {
      nebulaRef.current.uniforms.uTime.value = elapsed;
      nebulaRef.current.uniforms.uEnergy.value += (energy - nebulaRef.current.uniforms.uEnergy.value) * 0.08;
    }
    if (sphereRef.current) {
      sphereRef.current.scale.lerp(new THREE.Vector3(visualScale, visualScale, visualScale), 0.08);
      sphereRef.current.rotation.y += delta * (0.018 + activity * 0.008);
    }
    if (haloMeshRef.current) {
      const haloScale = 1.06 + (visualScale - 1) * 0.85 + energy * 0.012;
      haloMeshRef.current.scale.lerp(new THREE.Vector3(haloScale, haloScale, haloScale), 0.08);
    }
    if (rimRef.current) {
      rimRef.current.scale.lerp(new THREE.Vector3(visualScale, visualScale, visualScale), 0.08);
    }
    if (rimGlowRef.current) {
      const glowScale = 1.018 + (visualScale - 1) * 1.1;
      rimGlowRef.current.scale.lerp(new THREE.Vector3(glowScale, glowScale, glowScale), 0.08);
    }
    if (rimMaterialRef.current) {
      rimMaterialRef.current.opacity += ((status === "responding" ? 1 : status === "listening" ? 0.96 : status === "thinking" ? 0.88 : 0.82) - rimMaterialRef.current.opacity) * 0.08;
    }
    if (rimGlowMaterialRef.current) {
      const targetOpacity = status === "responding" ? 0.43 : status === "listening" ? 0.38 : status === "thinking" ? 0.31 : 0.22;
      rimGlowMaterialRef.current.opacity += (targetOpacity - rimGlowMaterialRef.current.opacity) * 0.08;
    }
    if (innerStarRef.current) {
      innerStarRef.current.rotation.y += delta * 0.035 * activity;
      innerStarRef.current.rotation.z -= delta * 0.01;
    }
    if (shellStarRef.current) {
      shellStarRef.current.rotation.y -= delta * 0.018 * activity;
      shellStarRef.current.rotation.x += delta * 0.004;
    }
    if (innerMaterialRef.current) {
      innerMaterialRef.current.uniforms.uTime.value = elapsed;
      lerpUniform(innerMaterialRef.current, "uActivity", activity, 0.06);
      lerpUniform(innerMaterialRef.current, "uOpacity", status === "thinking" ? 0.9 : status === "responding" ? 0.86 : status === "listening" ? 0.82 : 0.68, 0.06);
      lerpUniform(innerMaterialRef.current, "uSize", status === "responding" ? 2.42 : status === "listening" ? 2.3 : status === "thinking" ? 2.22 : 2.12, 0.06);
    }
    if (shellMaterialRef.current) {
      shellMaterialRef.current.uniforms.uTime.value = elapsed;
      lerpUniform(shellMaterialRef.current, "uActivity", activity, 0.06);
      lerpUniform(shellMaterialRef.current, "uOpacity", status === "thinking" ? 0.62 : status === "responding" ? 0.58 : status === "listening" ? 0.54 : 0.42, 0.06);
      lerpUniform(shellMaterialRef.current, "uSize", status === "thinking" ? 2.1 : status === "responding" ? 2.02 : 1.82, 0.06);
    }
  });

  return (
    <>
      <mesh position={[0, -0.03, -0.8]} scale={[2.05, 1.48, 1]} renderOrder={0}>
        <circleGeometry args={[1, 128]} />
        <shaderMaterial
          ref={nebulaRef}
          vertexShader={nebulaVertexShader}
          fragmentShader={nebulaFragmentShader}
          uniforms={nebulaUniforms}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={sphereRef} renderOrder={3}>
        <sphereGeometry args={[1.42, 88, 88]} />
        <shaderMaterial
          ref={shaderRef}
          vertexShader={sphereVertexShader}
          fragmentShader={sphereFragmentShader}
          uniforms={sphereUniforms}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={haloMeshRef} scale={1.06} renderOrder={2}>
        <sphereGeometry args={[1.42, 64, 64]} />
        <shaderMaterial
          ref={haloRef}
          vertexShader={sphereVertexShader}
          fragmentShader={haloFragmentShader}
          uniforms={haloUniforms}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={rimRef} renderOrder={7}>
        <torusGeometry args={[1.418, 0.01, 8, 192]} />
        <meshBasicMaterial
          ref={rimMaterialRef}
          color="#8edcff"
          transparent
          opacity={0.82}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={rimGlowRef} scale={1.018} renderOrder={6}>
        <torusGeometry args={[1.418, 0.033, 10, 192]} />
        <meshBasicMaterial
          ref={rimGlowMaterialRef}
          color="#087cff"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>

      <points ref={innerStarRef} renderOrder={5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[innerStars.positions, 3]} />
          <bufferAttribute attach="attributes-aScale" args={[innerStars.scales, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[innerStars.phases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={innerMaterialRef}
          vertexShader={particleVertexShader}
          fragmentShader={particleFragmentShader}
          uniforms={{
            uTime: { value: 0 },
            uActivity: { value: 1 },
            uPixelRatio: { value: pixelRatio },
            uSize: { value: 2.12 },
            uColor: { value: new THREE.Color("#0c79ff") },
            uOpacity: { value: 0.68 },
          }}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      <points ref={shellStarRef} renderOrder={6}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[shellStars.positions, 3]} />
          <bufferAttribute attach="attributes-aScale" args={[shellStars.scales, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[shellStars.phases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={shellMaterialRef}
          vertexShader={particleVertexShader}
          fragmentShader={particleFragmentShader}
          uniforms={{
            uTime: { value: 0 },
            uActivity: { value: 1 },
            uPixelRatio: { value: pixelRatio },
            uSize: { value: 1.82 },
            uColor: { value: new THREE.Color("#168cff") },
            uOpacity: { value: 0.42 },
          }}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </>
  );
}

export default function OrbScene3D({
  status,
  onReady,
  onUnavailable,
}: {
  status: AssistantStatus;
  onReady: () => void;
  onUnavailable: () => void;
}) {
  return (
    <div className="orb-webgl" aria-hidden="true">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 6], zoom: 114 }}
        dpr={[1, 1.75]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            onUnavailable();
          }, { once: true });
          onReady();
        }}
      >
        <ResponsiveCamera />
        <OrbGeometry status={status} />
      </Canvas>
    </div>
  );
}
