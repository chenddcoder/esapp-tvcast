#!/usr/bin/env python3
"""生成投屏图片验收素材（保持仓库体积小，脚本生成而非提交二进制）。

产出 proto/fixtures/photo-1600x1000.jpg：
  1600×1000（宽高比 1.6）纯色图。选 1.6 而不是 16:9(1.778) 是为了让
  `resizeMode=contain` 在 1920×1080 画布上**必然产生左右黑边**：
    按高适配 → 渲染宽 = 1080×1.6 = 1728，两侧各留 (1920-1728)/2 = 96px 黑边。
  验收脚本据此采样像素：x=40 必须黑、x=960 必须是图片色 —— 既证明图片显示，
  也证明 object-fit=contain 真的生效（fill 会把 1.6 拉伸满屏，两侧不会有黑边）。

用法：/Users/chendd/.workbuddy/binaries/python/envs/default/bin/python3 scripts/gen-photo-fixture.py
"""
import os

from PIL import Image

# 图片本体色：明亮的蓝（与黑边对比强烈，且 JPEG 色度抽样下蓝色通道仍显著占优）
FILL = (0, 128, 255)
W, H = 1600, 1000

out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'proto/fixtures/photo-1600x1000.jpg')

img = Image.new('RGB', (W, H), FILL)
# 中间画一块白底 + 色块，便于人工看图确认方向没被翻转/裁切
for x in range(600, 1000):
    for y in range(350, 650):
        img.putpixel((x, y), (255, 255, 255))

os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out, 'JPEG', quality=90)
print('written %s (%d×%d, %d bytes)' % (out, W, H, os.path.getsize(out)))
