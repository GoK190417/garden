# 庭 — garden

夜の庭をめぐるインタラクティブな小品集。一景目は **蛍火(hotarubi · indigo 01)**。
そっと触れると蛍は遠ざかり、待つほどに明かりは揃っていく。**スマホ縦持ちが基準**。

Canvas 2D の単一ページ・**依存ゼロ**(フレームワークもビルドツールも無し)。

## 構成

```
.
├── index.html            庭の入口(各景へのリンク)
├── hotarubi/
│   ├── index.html        蛍火のページ
│   ├── main.js           蛍の物理・明滅・背景合成
│   ├── style.css
│   └── assets/
│       └── bg.jpg        生成背景(任意。無ければ手続き背景で動く)
└── README.md
```

## ローカルで動かす

**必ず HTTP サーバ経由で開くこと。** `file://` で直接開くと背景画像が読み込めない。

```sh
cd garden
python3 -m http.server 8000
# http://localhost:8000/          (庭の入口)
# http://localhost:8000/hotarubi/ (蛍火)
```
