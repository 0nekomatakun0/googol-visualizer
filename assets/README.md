# アセット差し替えガイド

## 音声ファイル（assets/audio/）

| ファイル名 | 用途 | 推奨フォーマット |
|---|---|---|
| `bgm.mp3` | バックグラウンドミュージック（ループ再生） | MP3 / OGG |
| `se_gear_click.mp3` | 歯車の刻み音（短いSE、高速連射） | MP3 / WAV（短め） |
| `se_shooting_star.mp3` | 流れ星SE | MP3 |
| `se_milestone.mp3` | マイルストーン到達チャイム | MP3 |
| `se_goal.mp3` | 完走ファンファーレ | MP3 |

## 差し替え手順

1. ファイルをこの `assets/audio/` フォルダに置く
2. `assets/manifest.json` の対応する `null` をファイルパスに変更する

```json
{
  "audio": {
    "bgm": "assets/audio/bgm.mp3",
    "se_gear_click": "assets/audio/se_gear_click.mp3",
    "se_milestone": "assets/audio/se_milestone.mp3"
  }
}
```

ファイルが存在しない or null のままの場合は、自動的に Web Audio API による合成音にフォールバックします。

## 画像ファイル（assets/images/）

| ファイル名 | 用途 | 推奨サイズ |
|---|---|---|
| `gear_texture.png` | 歯車のテクスチャオーバーレイ | 512×512 以上、PNG |

テクスチャは歯車本体の上にオーバーレイ合成されます（multiply / overlay）。
