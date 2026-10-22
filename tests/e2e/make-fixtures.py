#!/usr/bin/env python3
"""Prepara i file per le prove nel browser: foto di prova, logo, video della fotocamera finta.
Uso: make-fixtures.py CARTELLA_DI_LAVORO (serve Pillow; ffmpeg per i video)"""
import os
import random
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw

out = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
for d in ('img', 'dl', 'shots5', 'pdf5'):
    os.makedirs(os.path.join(out, d), exist_ok=True)
for f in os.listdir(os.path.join(here, 'fixtures')):
    shutil.copy(os.path.join(here, 'fixtures', f), out)

random.seed(7)


def gradient(w, h, label, noise=True):
    im = Image.new('RGB', (w, h))
    px = im.load()
    for y in range(h):
        for x in range(w):
            n = random.randint(-12, 12) if noise else 0
            px[x, y] = (max(0, min(255, int(255 * x / w) + n)), max(0, min(255, int(255 * y / h) + n)), 140)
    d = ImageDraw.Draw(im)
    d.rectangle((w // 20, h // 20, w - w // 20, h - h // 20), outline=(255, 255, 255), width=max(2, w // 200))
    d.text((w // 10, h // 10), label, fill=(255, 255, 255))
    return im


img = os.path.join(out, 'img')
if not os.path.exists(os.path.join(img, 'landscape.jpg')):
    # più grandi del lato massimo (1280 px): devono essere ridimensionate
    gradient(3000, 2250, 'LANDSCAPE 3000', noise=True).save(os.path.join(img, 'landscape.jpg'), quality=95)
    # foto "sdraiata" con EXIF orientation 6: dopo la rotazione è verticale
    im = gradient(3000, 2250, 'EXIF 6 - TOP IN ALTO')
    exif = Image.Exif()
    exif[0x0112] = 6
    im.save(os.path.join(img, 'portrait_exif6.jpg'), quality=95, exif=exif)
    for i in range(14):
        gradient(640, 480, f'#{i}').save(os.path.join(img, f'small{i:02d}.jpg'), quality=90)
    Image.new('RGBA', (800, 600), (0, 128, 255, 90)).save(os.path.join(img, 'transparent.png'))
    logo = Image.new('RGB', (600, 200), 'white')
    d = ImageDraw.Draw(logo)
    d.rectangle((0, 0, 599, 199), outline=(10, 84, 158), width=6)
    d.ellipse((30, 40, 130, 140), fill=(10, 84, 158))
    d.text((160, 80), 'BIANCHI TERMO', fill=(10, 84, 158))
    logo.save(os.path.join(img, 'logo.png'))

# fotocamera finta di Chromium: un video con il QR, e uno vuoto
if not os.path.exists(os.path.join(out, 'cam.y4m')):
    common = ['ffmpeg', '-v', 'error', '-y']
    scale = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:white'
    subprocess.run(common + ['-loop', '1', '-i', os.path.join(out, 'qr-sample.png'), '-t', '4', '-r', '15', '-vf', scale, '-pix_fmt', 'yuv420p', os.path.join(out, 'cam.y4m')], check=True)
    subprocess.run(common + ['-f', 'lavfi', '-i', 'color=c=gray:s=1280x720:r=15', '-t', '4', '-pix_fmt', 'yuv420p', os.path.join(out, 'blank.y4m')], check=True)
print('pronto:', out)
