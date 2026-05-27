from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SPECS = [
    ("aidlc-docs/prototipo de telas/logo.png", "frontend/src/assets/smartcashflow-logo.png", 640),
    ("aidlc-docs/prototipo de telas/ico logo com borda.png", "frontend/src/assets/smartcashflow-icon.png", 256),
    ("aidlc-docs/prototipo de telas/ico logo com borda.png", "frontend/public/smartcashflow-icon.png", 256),
]


def optimize(src: str, dst: str, max_size: int) -> None:
    image = Image.open(ROOT / src).convert("RGBA")
    alpha_bbox = image.getchannel("A").getbbox()
    if alpha_bbox:
        image = image.crop(alpha_bbox)
    image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    if "icon" in dst:
        image = image.convert("P", palette=Image.Palette.ADAPTIVE, colors=128)

    output = ROOT / dst
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, optimize=True, compress_level=9)


def main() -> None:
    for src, dst, max_size in SPECS:
        optimize(src, dst, max_size)


if __name__ == "__main__":
    main()
