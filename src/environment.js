import * as THREE from 'three';

function seeded(index, salt = 0) {
  const x = Math.sin(index * 91.173 + salt * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

function createStars() {
  const count = 1500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const theta = seeded(i, 1) * Math.PI * 2;
    const u = seeded(i, 2) * 2 - 1;
    const radius = 65 + seeded(i, 3) * 85;
    const planar = Math.sqrt(1 - u * u);
    positions.set([Math.cos(theta) * planar * radius, u * radius, Math.sin(theta) * planar * radius], i * 3);
    color.setHSL(0.53 + seeded(i, 4) * 0.09, 0.15 + seeded(i, 5) * 0.25, 0.58 + seeded(i, 6) * 0.38);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true, depthWrite: false }));
}

function createEarth() {
  const group = new THREE.Group();
  const uniforms = {
    sunDirection: { value: new THREE.Vector3(-0.5, 0.3, 0.8).normalize() },
  };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(26, 96, 64), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){vN=normalize(normalMatrix*normal);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vP; uniform vec3 sunDirection;
      float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+3.1;a*=.5;}return v;}
      void main(){
        vec3 p=normalize(vP); float land=fbm(p*3.4+vec3(2.1,4.7,1.3));
        float detail=fbm(p*15.); float mask=smoothstep(.51,.57,land+detail*.1);
        vec3 ocean=mix(vec3(.015,.075,.14),vec3(.025,.20,.31),detail);
        vec3 ground=mix(vec3(.12,.20,.10),vec3(.42,.36,.20),smoothstep(.45,.75,detail));
        float ice=smoothstep(.72,.93,abs(p.y)); vec3 albedo=mix(mix(ocean,ground,mask),vec3(.78,.83,.82),ice);
        float clouds=smoothstep(.59,.72,fbm(p*7.+vec3(8.,1.,3.))+detail*.12);
        albedo=mix(albedo,vec3(.82,.86,.85),clouds*.72);
        float light=max(dot(normalize(vN),sunDirection),0.); float rim=pow(1.-max(vN.z,0.),3.);
        vec3 color=albedo*(.055+light*.95)+vec3(.02,.13,.25)*rim*light;
        gl_FragColor=vec4(color,1.);
      }`,
  }));
  group.add(earth);
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(26.35, 64, 48), new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vN;void main(){float a=pow(max(0.,.72-vN.z),3.);gl_FragColor=vec4(.12,.48,.85,a*.55);}`,
  }));
  group.add(atmosphere);
  group.position.set(0, -29, -43);
  group.rotation.z = -0.22;
  return group;
}

function createSky() {
  const uniforms = { day: { value: 1 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms,
    vertexShader: `varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vP;uniform float day;void main(){float h=normalize(vP).y*.5+.5;vec3 nightTop=vec3(.025,.055,.095);vec3 nightH=vec3(.19,.16,.16);vec3 dayTop=vec3(.12,.34,.53);vec3 dayH=vec3(.61,.70,.70);vec3 top=mix(nightTop,dayTop,day);vec3 hor=mix(nightH,dayH,day);vec3 c=mix(hor,top,smoothstep(.42,.9,h));gl_FragColor=vec4(c,1.);}`,
  }));
  return { sky, uniforms };
}

function createOcean() {
  const uniforms = { phase: { value: 0 }, lightDir: { value: new THREE.Vector3(-0.4, 0.7, 0.5).normalize() } };
  const geometry = new THREE.PlaneGeometry(400, 400, 160, 160);
  const ocean = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide,
    vertexShader: `uniform float phase;varying vec3 vN;varying float vWave;varying vec3 vWorld;void main(){vec3 p=position;float w=sin(p.x*.42+phase)*.075+sin(p.y*.31-phase*2.)*.055+sin((p.x+p.y)*.16+phase)*.08;p.z+=w;vWave=w;vWorld=p;vN=normalize(vec3(-.03*cos(p.x*.42+phase),-.02*cos(p.y*.31-phase*2.),1.));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec3 vN;varying float vWave;varying vec3 vWorld;uniform vec3 lightDir;void main(){float fres=pow(1.-abs(vN.z),2.);float foam=smoothstep(.14,.19,vWave);vec3 c=mix(vec3(.025,.16,.20),vec3(.16,.37,.43),fres);c=mix(c,vec3(.65,.74,.70),foam*.28);float glint=pow(max(dot(vN,lightDir),0.),36.);c+=vec3(.7,.62,.42)*glint*.22;gl_FragColor=vec4(c,1.);}`,
  }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -1.43;
  return { ocean, uniforms };
}

export function createEnvironments(scene) {
  const space = new THREE.Group();
  space.add(createStars());
  const earth = createEarth();
  space.add(earth);
  scene.add(space);

  const atmosphere = new THREE.Group();
  const { sky, uniforms: skyUniforms } = createSky();
  atmosphere.add(sky);
  const { ocean, uniforms: oceanUniforms } = createOcean();
  atmosphere.add(ocean);
  scene.add(atmosphere);
  atmosphere.visible = false;

  function setPhase(phase) {
    const inSpace = phase === 'coast' || phase === 'entry';
    space.visible = inSpace;
    atmosphere.visible = !inSpace;
    skyUniforms.day.value = phase === 'mains' || phase === 'splash' ? 1 : phase === 'launch' ? 0.65 : 0.15;
    ocean.visible = phase === 'splash' || phase === 'launch';
    scene.fog = inSpace ? null : new THREE.FogExp2(phase === 'drogue' ? 0x34353d : 0x80969c, phase === 'mains' || phase === 'splash' ? 0.005 : 0.009);
  }

  function update(t) {
    oceanUniforms.phase.value = (t % 12) * Math.PI * 2 / 12;
  }

  return { space, earth, atmosphere, ocean, setPhase, update };
}
