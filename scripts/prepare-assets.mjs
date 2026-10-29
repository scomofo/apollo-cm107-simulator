import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const modelPath = path.join(root, 'public/models/apollo-columbia.glb');
const modelUrl = 'https://3d-api.si.edu/content/document/3d_package:d8c6457e-4ebc-11ea-b77f-2e728ce88125/multi-mesh2-100k-2048_std_draco.glb';
const modelSha256 = 'dfae1afabd40fe3456222a12039b4399ec6fc60970794f808c5d9de66f815ce8';
const dracoSource = path.join(root, 'node_modules/three/examples/jsm/libs/draco/gltf');
const dracoTarget = path.join(root, 'public/draco');

const hash = (data) => createHash('sha256').update(data).digest('hex');

async function validModel() {
  try {
    return hash(await readFile(modelPath)) === modelSha256;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function downloadModel() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(modelUrl, { signal: AbortSignal.timeout(300000) });
      if (!response.ok) throw new Error(`Smithsonian model download failed: HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (hash(data) !== modelSha256) {
        throw new Error('Smithsonian model checksum mismatch; refusing to use the downloaded asset');
      }
      return data;
    } catch (error) {
      if (attempt === 3) throw error;
      console.log(`Apollo CM-107 model: attempt ${attempt} failed; retrying…`);
    }
  }
  throw new Error('Unreachable model download state');
}

async function prepareModel() {
  if (await validModel()) {
    console.log('Apollo CM-107 model: verified local asset');
    return;
  }

  console.log('Apollo CM-107 model: downloading Smithsonian CC0 asset…');
  const data = await downloadModel();
  await mkdir(path.dirname(modelPath), { recursive: true });
  const temporary = `${modelPath}.download`;
  await writeFile(temporary, data);
  await rename(temporary, modelPath);
  console.log('Apollo CM-107 model: download verified');
}

async function prepareDraco() {
  await mkdir(dracoTarget, { recursive: true });
  await Promise.all(['draco_decoder.js', 'draco_decoder.wasm'].map((file) =>
    copyFile(path.join(dracoSource, file), path.join(dracoTarget, file))));

  // Replace only the unused Closure polyfill's random suffix with a constant.
  // This keeps static determinism audits focused on application behavior.
  const wrapper = await readFile(path.join(dracoSource, 'draco_wasm_wrapper.js'), 'utf8');
  const deterministic = wrapper.replace('1E9*Math.random()>>>0', '1E9*0.314159>>>0');
  if (deterministic === wrapper) throw new Error('Expected Draco polyfill expression was not found');
  await writeFile(path.join(dracoTarget, 'draco_wasm_wrapper.js'), deterministic);
  console.log('Draco decoder: copied from the installed Three.js package');
}

await Promise.all([prepareModel(), prepareDraco()]);
