/**
 * AssetLoader — マニフェストベースのアセット差し替えシステム
 *
 * 使い方:
 *   const loader = new AssetLoader();
 *   await loader.load();
 *   const buf = loader.getAudioBuffer('bgm');      // null = 合成フォールバック
 *   const img = loader.getImage('gear_texture');   // null = デフォルト描画
 *
 * 差し替えは assets/manifest.json を編集するだけ。
 * ファイルが存在しない/nullの場合は自動的にフォールバック。
 */
class AssetLoader {
  constructor() {
    this.manifest     = null;
    this._manifestUrl = null; // マニフェストの絶対URL（パス解決の基準）
    this.audio        = {};  // key -> AudioBuffer | null
    this.images       = {};  // key -> HTMLImageElement | null
    this._ac          = null; // 外部から注入するか内部で一時生成
  }

  /** AudioContextを外から注入（AudioController初期化後に呼ぶ） */
  setAudioContext(ac) {
    this._ac = ac;
  }

  /** manifest 内の相対パスを実URLに変換（ページ基準ではなく manifest 所在ディレクトリ基準） */
  _resolveAssetPath(path) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('/')) return path;
    const base = this._manifestUrl || new URL('assets/manifest.json', document.baseURI);
    return new URL(path, base).href;
  }

  /** マニフェストを読み込み、全アセットを並行ロード */
  async load() {
    try {
      const res = await fetch('assets/manifest.json');
      this._manifestUrl = new URL(res.url);
      this.manifest = await res.json();
    } catch(e) {
      console.warn('[AssetLoader] manifest.json not found, using all fallbacks.');
      this._manifestUrl = new URL('assets/manifest.json', document.baseURI);
      this.manifest = { audio: {}, images: {} };
    }

    const audioJobs = Object.entries(this.manifest.audio || {}).map(
      ([key, path]) => this._loadAudio(key, path)
    );
    const imageJobs = Object.entries(this.manifest.images || {}).map(
      ([key, path]) => this._loadImage(key, path)
    );

    await Promise.allSettled([...audioJobs, ...imageJobs]);
    console.log('[AssetLoader] Load complete.',
      'audio:', Object.keys(this.audio),
      'images:', Object.keys(this.images));
  }

  /** オーディオアセット再ロード（AudioContext確定後） */
  async reloadAudio(ac) {
    this._ac = ac;
    if (!this.manifest) return;
    const jobs = Object.entries(this.manifest.audio || {}).map(
      ([key, path]) => this._loadAudio(key, path)
    );
    await Promise.allSettled(jobs);
  }

  async _loadAudio(key, path) {
    this.audio[key] = null; // デフォルトnull（合成フォールバック）
    if (!path || !this._ac) return;
    const url = this._resolveAssetPath(path);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      this.audio[key] = await this._ac.decodeAudioData(arrayBuf);
      console.log(`[AssetLoader] ✓ audio:${key} loaded`);
    } catch(e) {
      console.warn(`[AssetLoader] audio:${key} failed (${e.message}), using synthesis fallback`);
    }
  }

  async _loadImage(key, path) {
    this.images[key] = null;
    if (!path) return;
    const url = this._resolveAssetPath(path);
    try {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload  = res;
        img.onerror = rej;
        img.src     = url;
      });
      this.images[key] = img;
      console.log(`[AssetLoader] ✓ image:${key} loaded`);
    } catch(e) {
      console.warn(`[AssetLoader] image:${key} failed, using default rendering`);
    }
  }

  /** AudioBuffer or null */
  getAudioBuffer(key) {
    return this.audio[key] ?? null;
  }

  /** HTMLImageElement or null */
  getImage(key) {
    return this.images[key] ?? null;
  }

  /** マニフェストのパス文字列（参照用） */
  getPath(category, key) {
    return this.manifest?.[category]?.[key] ?? null;
  }
}
