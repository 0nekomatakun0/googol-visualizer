# アセット差し替えガイド

## フォルダ構成（全体）

```
cosmic-gears/
│
├── index.html                  ← エントリポイント（ここをブラウザで開く）
│
├── assets/
│   ├── manifest.json           ← ★ 差し替えファイルのパスをここに書く
│   ├── README.md               ← このファイル
│   ├── audio/                  ← 音声ファイルを置くフォルダ
│   │   ├── bgm.mp3             （例）BGM
│   │   ├── se_gear_click.mp3   （例）歯車クリック音
│   │   ├── se_shooting_star.mp3（例）流れ星SE
│   │   ├── se_milestone.mp3    （例）マイルストーンチャイム
│   │   └── se_goal.mp3         （例）完走ファンファーレ
│   └── images/                 ← 画像ファイルを置くフォルダ
│       └── gear_texture.png    （例）歯車テクスチャ
│
└── js/
    ├── AssetLoader.js          ← アセット読み込み管理
    ├── App.js                  ← メインループ・統合
    ├── Gear.js                 ← 歯車の物理状態
    ├── GearRenderer.js         ← 歯車の描画
    ├── TimeController.js       ← 宇宙時間・マイルストーン管理
    ├── UniverseRenderer.js     ← 宇宙背景の描画
    ├── CounterRenderer.js      ← 回転カウンター表示
    ├── InputController.js      ← マウス・タッチ・ホイール操作
    └── AudioController.js      ← BGM・SE再生（合成フォールバック付き）
```

---

## 音声の差し替え方法

### ステップ1 — ファイルを置く

```
assets/audio/bgm.mp3
assets/audio/se_gear_click.mp3
```

### ステップ2 — manifest.json を編集する

```json
{
  "audio": {
    "bgm":              "assets/audio/bgm.mp3",
    "se_gear_click":    "assets/audio/se_gear_click.mp3",
    "se_shooting_star": "assets/audio/se_shooting_star.mp3",
    "se_milestone":     "assets/audio/se_milestone.mp3",
    "se_goal":          "assets/audio/se_goal.mp3"
  },
  "images": {
    "gear_texture": null
  }
}
```

- `null` のままにした項目は Web Audio API による**合成音**で代替されます
- 一部だけ差し替えて残りは合成音のままにすることもできます

### 推奨フォーマット

| キー | 内容 | 推奨 |
|---|---|---|
| `bgm` | BGM（ループ再生） | MP3、OGG。静かなアンビエント系が合います |
| `se_gear_click` | 歯車の刻み音（高頻度） | WAV推奨。20ms以内の短い金属音 |
| `se_shooting_star` | 流れ星（1〜2秒） | MP3。グリッサンド系 |
| `se_milestone` | マイルストーンチャイム（2〜3秒） | MP3 |
| `se_goal` | 完走ファンファーレ（3〜5秒） | MP3 |

---

## 歯車テクスチャの差し替え方法

### ステップ1 — ファイルを置く

```
assets/images/gear_texture.png
```

### ステップ2 — manifest.json を編集する

```json
{
  "audio": { ... },
  "images": {
    "gear_texture": "assets/images/gear_texture.png"
  }
}
```

### テクスチャ仕様

- **サイズ**: 512×512px 以上推奨（正方形）
- **フォーマット**: PNG（透過OK）
- **合成方法**: `overlay` ブレンド、不透明度 25%
- **効果**: 歯車の金属表面にテクスチャが重なります
- **おすすめ**: 錆・金属板目・傷などのグレースケール画像

---

## ローカルで動かす場合の注意

`fetch()` でmanifest.jsonを読むため、**ローカルサーバー経由**で開く必要があります。

```bash
# Python 3
python3 -m http.server 8080
# → http://localhost:8080 をブラウザで開く

# Node.js (npx)
npx serve .
```

`file://` プロトコルで直接開くと音声・画像差し替えが機能しません  
（合成音・デフォルト描画にフォールバックして動作は継続します）
