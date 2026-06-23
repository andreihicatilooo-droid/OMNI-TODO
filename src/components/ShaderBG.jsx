import React, { useRef, useEffect } from 'react';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShaders = {
  noise: `
    uniform float time;
    uniform float opacity;
    
    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    
    varying vec2 vUv;
    void main() {
      vec2 p = vUv * 10.0;
      float speed = time * 0.5;
      vec2 direction = vec2(cos(speed), sin(speed)) * 0.5;
      float noise = snoise(p + direction);
      gl_FragColor = vec4(noise, noise, noise, opacity);
    }
  `,
  aurora: `
    uniform float time;
    uniform float opacity;
    uniform vec3 color;
    
    // Classic Perlin 2D Noise 
    // by Stefan Gustavson
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec2 fade(vec2 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
    float cnoise(vec2 P){
      vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
      vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
      Pi = mod(Pi, 289.0); // To avoid truncation effects in permutation
      vec4 ix = Pi.xzxz;
      vec4 iy = Pi.yyww;
      vec4 fx = Pf.xzxz;
      vec4 fy = Pf.yyww;
      vec4 i = permute(permute(ix) + iy);
      vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0; // 1/41 = 0.024...
      vec4 gy = abs(gx) - 0.5;
      vec4 tx = floor(gx + 0.5);
      gx = gx - tx;
      vec2 g00 = vec2(gx.x,gy.x);
      vec2 g10 = vec2(gx.y,gy.y);
      vec2 g01 = vec2(gx.z,gy.z);
      vec2 g11 = vec2(gx.w,gy.w);
      vec4 norm = 1.79284291400159 - 0.85373472095314 * 
        vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
      g00 *= norm.x;
      g01 *= norm.y;
      g10 *= norm.z;
      g11 *= norm.w;
      float n00 = dot(g00, vec2(fx.x, fy.x));
      float n10 = dot(g10, vec2(fx.y, fy.y));
      float n01 = dot(g01, vec2(fx.z, fy.z));
      float n11 = dot(g11, vec2(fx.w, fy.w));
      vec2 fade_xy = fade(Pf.xy);
      vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
      float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
      return 2.3 * n_xy;
    }
    
    varying vec2 vUv;
    void main() {
      vec2 p = vUv * 6.0;
      float speed = time * 0.2;
      vec2 direction = vec2(cos(speed), sin(speed));
      float noise = cnoise(p + direction);
      vec3 aurora = color * noise;
      gl_FragColor = vec4(aurora, opacity);
    }
  `,
};

export const ShaderBG = ({ type = 'noise', color = '#8a2be2', opacity = 0.2 }) => {
  const ref = useRef();
  
  useEffect(() => {
    let raf;
    let renderer, scene, camera, material, geometry, mesh, resize;

    import('three').then(THREE => {
      if (!ref.current) return;
      
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      geometry = new THREE.PlaneGeometry(2, 2);
      material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          opacity: { value: opacity },
          color: { value: new THREE.Color(color) },
        },
        vertexShader,
        fragmentShader: fragmentShaders[type],
        transparent: true,
      });
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      ref.current.appendChild(renderer.domElement);
      
      function animate(t) {
        if (material) {
          material.uniforms.time.value = t / 1000;
        }
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
        raf = requestAnimationFrame(animate);
      }
      raf = requestAnimationFrame(animate);
      
      resize = () => {
        if (!ref.current || !renderer) return;
        renderer.setSize(ref.current.clientWidth, ref.current.clientHeight);
      }
      
      window.addEventListener('resize', resize);
      resize();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      if (renderer && renderer.domElement && ref.current) {
         if (ref.current.contains(renderer.domElement)) {
           ref.current.removeChild(renderer.domElement);
         }
         renderer.dispose();
      }
      if (geometry) geometry.dispose();
      if (material) material.dispose();
    };
  }, [type, color, opacity]);
  
  return <div ref={ref} className="absolute inset-0 pointer-events-none -z-10" />;
};

export default ShaderBG;
