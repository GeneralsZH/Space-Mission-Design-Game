"""Reproduce the bundled LROC samples and NASA SVS display texture. Standard library only."""
import argparse
import hashlib
import json
import math
import pathlib
import re
import struct
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
PRODUCT = "WAC_POLE_ILL_TWI_SOUTH_100M"
BASE = "https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_TWI_SOUTH/"
TEXTURE = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg"
RAW_SHA256 = "dfecc026012fe24f67ca70ed21a09a1723ca0750bf3ec120f1a4ed2c4604717b"
TEXTURE_SHA256 = "f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170"

def fetch(url):
    with urllib.request.urlopen(url, timeout=90) as response:
        return response.read()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=pathlib.Path, default=pathlib.Path(tempfile.gettempdir()))
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    cache = args.cache_dir / "orbital-lroc-source.img"
    if not cache.exists():
        cache.write_bytes(fetch(BASE + PRODUCT + ".IMG"))
    raw = cache.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != RAW_SHA256:
        raise ValueError("LROC IMG checksum changed; review the source before regenerating")
    header_start = raw[:9712].decode("ascii")
    def integer(key):
        return int(re.search(r"^\s*" + re.escape(key) + r"\s*=\s*(\d+)", header_start, re.M).group(1))
    # The embedded PDS3 pointer is authoritative for this attached-label file.
    # Its two 4856-byte label records precede the image. PDS4 XML lists 4856,
    # which conflicts with ^IMAGE=3; using it would decode label text as pixels.
    offset = (integer("^IMAGE") - 1) * integer("RECORD_BYTES")
    rows, cols = integer("LINES"), integer("LINE_SAMPLES")
    if offset != 9712 or len(raw) != offset + rows * cols * 4:
        raise ValueError("Unexpected raster layout")
    cells = []
    size = 41
    radius = 1737400
    for j in range(size):
        row = round((j + .5) * rows / size - .5)
        for i in range(size):
            col = round((i + .5) * cols / size - .5)
            value = struct.unpack_from("<f", raw, offset + (row * cols + col) * 4)[0]
            x, y = (col - 606.5) * 100, (606.5 - row) * 100
            rho = math.hypot(x, y)
            lat = -90 + math.degrees(2 * math.atan(rho / (2 * radius)))
            if not (math.isfinite(value) and 0 <= value <= 100 and lat <= -88):
                continue  # PDS special/null/saturated constants are not zero illumination.
            lon = math.degrees(math.atan2(x, y)) % 360
            cells.append({"id": j * size + i, "i": i, "j": j, "xKm": x / 1000,
                          "yKm": y / 1000, "latitude": round(lat, 7), "longitude": round(lon, 7),
                          "illuminationPct": round(value, 4), "sourceRow": row, "sourceColumn": col})
    output = ROOT / "public" / "science"
    output.mkdir(parents=True, exist_ok=True)
    header = raw[:offset].decode("ascii").rstrip()
    (output / "lroc-source-label.txt").write_text(header + "\n", encoding="utf-8")
    readme = fetch(BASE + "WAC_POLE_ILL_TWI_SOUTH_README.TXT").decode("utf-8", errors="replace")
    (output / "lroc-readme.txt").write_text(readme, encoding="utf-8")
    metadata = {
        "productId": PRODUCT, "datasetId": "LRO-L-LROC-5-RDR-V1.0", "productVersion": "v1.3",
        "sourceUrl": BASE + PRODUCT + ".IMG", "sourceSha256": digest,
        "sourceDocumentation": "https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_TWI_SOUTH",
        "citation": "Speyerer, E. J. & Robinson, M. S. (2013), Icarus 222(1), 122-136. doi:10.1016/j.icarus.2012.10.010",
        "units": "percent time-weighted illumination", "period": "2010-02-15 to 2011-02-05",
        "primaryObservations": 3807, "gapFillObservations": 229, "sourcePixelMetres": 100,
        "sourceRows": rows, "sourceColumns": cols, "sourceImageOffsetBytes": offset,
        "projection": "South polar stereographic, spherical radius 1737.4 km, central longitude 0 E",
        "sampleGridSize": size, "sampleSpacingMetres": rows * 100 / size,
        "sampling": "Nearest original pixel at each 41x41 grid-cell centre; valid points within 88-90 S. Values rounded to 0.0001 percentage point; no interpolation. Source row/column indices are zero-based.",
        "limitations": "Historical annual illumination, not current sunlight, temperature or water-ice abundance. Near-zero artifacts and temporal gap filling are documented by LROC. Sparse samples do not resolve individual craters or permanently shadowed regions.",
        "texture": {"sourceUrl": TEXTURE, "sourcePage": "https://svs.gsfc.nasa.gov/4720/",
                    "credit": "NASA's Scientific Visualization Studio; LRO LROC / LOLA teams; Ernie Wright",
                    "usage": "2025 SVS 2048x1024 display map, sRGB. Aesthetic color adjustment and polar fill; not used for quantitative science."},
    }
    metadata["texture"]["sha256"] = TEXTURE_SHA256
    (ROOT / "src" / "data" / "lroc-illumination.json").write_text(json.dumps({"metadata": metadata, "cells": cells}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    texture = fetch(TEXTURE)
    if not texture.startswith(b"\xff\xd8"):
        raise ValueError("NASA texture is not a JPEG")
    if hashlib.sha256(texture).hexdigest() != TEXTURE_SHA256:
        raise ValueError("NASA display texture changed; review before regenerating")
    (output / "moon-lroc-2025-2k.jpg").write_bytes(texture)
    metadata["texture"]["sha256"] = hashlib.sha256(texture).hexdigest()
    (output / "provenance.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"samples": len(cells), "source_sha256": digest, "texture_sha256": metadata["texture"]["sha256"], "offset_bytes": offset}))

if __name__ == "__main__":
    main()
