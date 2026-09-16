(function () {
  'use strict';

  // The anonymous website sandbox also blocks direct downloads. Navigate in the
  // same tab to its normal file viewer, which provides an unrestricted Download.
  const anonymousWebsite = location.hostname === 'anonymous.4open.science' &&
    location.pathname.match(/^\/w\/([^/]+)(?:\/|$)/);
  if (anonymousWebsite) {
    document.querySelectorAll('a[download]').forEach((link) => {
      const file = link.getAttribute('href');
      link.href = '/r/' + anonymousWebsite[1] + '/' + file;
      link.removeAttribute('download');
      link.title = 'Open the STEP file, then choose Download';
    });
  }

  const previewUrl = new URL('cad/hardware-preview.js', document.currentScript.src).href;
  const mount = document.getElementById('cad-viewer');
  const status = document.getElementById('cad-status');
  if (!mount || !status) return;
  const card = mount.closest('.cad-card');

  function decodeBytes(base64) {
    const text = atob(base64);
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    return bytes;
  }

  async function loadPreview() {
    // Classic scripts work inside Anonymous GitHub's sandbox; fetch() does not.
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = previewUrl;
      script.async = true;
      const timeout = setTimeout(() => finish(new Error('CAD preview download timed out.')), 120000);
      function finish(error) {
        clearTimeout(timeout);
        script.onload = script.onerror = null;
        script.remove();
        if (error) reject(error);
        else resolve();
      }
      script.onload = () => finish();
      script.onerror = () => finish(new Error('CAD preview data could not be downloaded.'));
      document.head.appendChild(script);
    });
    if (!window.LEAPUMI_CAD_PREVIEW_GZIP) throw new Error('Missing CAD preview data.');
    const compressed = decodeBytes(window.LEAPUMI_CAD_PREVIEW_GZIP);
    delete window.LEAPUMI_CAD_PREVIEW_GZIP;
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const preview = await new Response(stream).json();
    if (preview.version !== 1 || !preview.meshes?.length) throw new Error('Invalid CAD preview.');
    return preview;
  }

  async function start() {
    let renderer;
    try {
      if (!window.THREE || !THREE.OrbitControls) throw new Error('The 3D viewer scripts could not be loaded.');
      if (!window.DecompressionStream) throw new Error('This browser does not support compressed CAD previews.');

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.85;
      renderer.domElement.setAttribute('aria-label', 'LeapUMI hardware: drag to rotate, scroll to zoom');
      mount.appendChild(renderer.domElement);

      const preview = await loadPreview();
      status.textContent = 'Preparing CAD preview...';
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x506078, 0.8));
      const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
      keyLight.position.set(4, 6, 8);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xb6cfff, 0.4);
      fillLight.position.set(-6, -3, 4);
      scene.add(fillLight);

      const materials = new Map();
      function materialFor(rgb) {
        const key = JSON.stringify(rgb);
        if (!materials.has(key)) {
          const color = rgb ? new THREE.Color(...rgb) : new THREE.Color(0x9ba9ba);
          materials.set(key, new THREE.MeshStandardMaterial({
            color, roughness: 0.6, metalness: 0.15, side: THREE.DoubleSide
          }));
        }
        return materials.get(key);
      }

      const model = new THREE.Group();
      for (const source of preview.meshes) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(decodeBytes(source.positions).buffer), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(decodeBytes(source.indices).buffer), 1));
        if (source.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(decodeBytes(source.normals).buffer), 3));
        else geometry.computeVertexNormals();
        const meshMaterials = [materialFor(source.color)];
        let offset = 0;
        for (const face of source.faces) {
          const first = face.first * 3;
          const end = (face.last + 1) * 3;
          if (first > offset) geometry.addGroup(offset, first - offset, 0);
          const material = materialFor(face.color);
          let index = meshMaterials.indexOf(material);
          if (index === -1) index = meshMaterials.push(material) - 1;
          geometry.addGroup(first, end - first, index);
          offset = end;
        }
        if (offset < geometry.index.count) geometry.addGroup(offset, geometry.index.count - offset, 0);
        model.add(new THREE.Mesh(geometry, meshMaterials));
      }

      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const largestSide = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(largestSide) || largestSide <= 0) throw new Error('The CAD preview has no visible geometry.');
      model.position.sub(center);
      const normalizedModel = new THREE.Group();
      normalizedModel.scale.setScalar(1 / largestSide);
      normalizedModel.add(model);
      scene.add(normalizedModel);

      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
      const controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 0.65;
      controls.maxDistance = 6;
      controls.screenSpacePanning = true;
      let framed = false;
      function resize() {
        const width = mount.clientWidth;
        const height = mount.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        if (!framed) {
          const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
          const limitingFov = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
          const radius = size.length() / largestSide / 2;
          const distance = radius / Math.sin(limitingFov) * 1.08;
          camera.position.copy(new THREE.Vector3(1.35, 1.05, 1.35).normalize().multiplyScalar(distance));
          controls.update();
          framed = true;
        }
      }
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
      resize();
      renderer.render(scene, camera);
      status.hidden = true;
      card.dataset.state = 'ready';

      // Render on demand, including a short run of frames for orbit damping.
      let frame = null;
      function render() {
        frame = null;
        controls.update();
        renderer.render(scene, camera);
      }
      function requestRender() {
        if (frame === null) frame = requestAnimationFrame(render);
      }
      controls.addEventListener('change', requestRender);
      new ResizeObserver(requestRender).observe(mount);
      renderer.domElement.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        status.hidden = false;
        status.textContent = '3D preview paused. Refresh this page to reload, or download the STEP file below.';
        card.dataset.state = 'error';
      });
    } catch (error) {
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      status.hidden = false;
      status.textContent = '3D preview is unavailable. Try refreshing the page or download the STEP file below.';
      status.classList.add('error');
      card.dataset.state = 'error';
      console.error('LeapUMI CAD preview:', error);
    } finally {
      card.setAttribute('aria-busy', 'false');
    }
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    }, { rootMargin: '400px' });
    observer.observe(mount);
  } else {
    start();
  }
}());
