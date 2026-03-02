"""
views.py – Django API that delegates every CV operation to the C++ cv_core
module.  No Python cv2 usage whatsoever; cv_core is a hard requirement.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

# ── Load the compiled C++ module (hard requirement – no fallback) ──────

_opencv_bin = settings.OPENCV_BIN_DIR
_build_dir  = settings.CV_CORE_BUILD_DIR

if hasattr(os, "add_dll_directory") and _opencv_bin.exists():
    os.add_dll_directory(str(_opencv_bin))

if str(_build_dir) not in sys.path:
    sys.path.insert(0, str(_build_dir))

import cv_core  # type: ignore  # noqa: E402 – must come after path setup

# ── Helpers ────────────────────────────────────────────────────────────


def _float(val: str | None, default: float) -> float:
    if not val:
        return default
    try:
        return float(val)
    except ValueError:
        return default


def _int(val: str | None, default: int) -> int:
    if not val:
        return default
    try:
        return int(val)
    except ValueError:
        return default


def _save_upload(uploaded) -> Path:
    upload_dir = Path(settings.MEDIA_ROOT) / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}_{Path(uploaded.name).name}"
    dest = upload_dir / name
    with dest.open("wb+") as f:
        for chunk in uploaded.chunks():
            f.write(chunk)
    return dest


def _result_dir() -> tuple[Path, str]:
    token = uuid.uuid4().hex
    out = Path(settings.MEDIA_ROOT) / "results"
    out.mkdir(parents=True, exist_ok=True)
    return out, token


def _to_url(path: str | Path) -> str:
    absolute = Path(path).resolve()
    rel = absolute.relative_to(Path(settings.MEDIA_ROOT).resolve())
    return f"{settings.MEDIA_URL}{str(rel).replace(chr(92), '/')}"


def _convert(value):
    """Recursively turn absolute file paths in a result dict into URLs."""
    if isinstance(value, str):
        p = Path(value)
        return _to_url(p) if p.is_absolute() and p.exists() else value
    if isinstance(value, dict):
        return {k: _convert(v) for k, v in value.items()}
    return value


# ── Views ──────────────────────────────────────────────────────────────


def index(request):
    return render(request, "index.html")


@require_POST
def process_api(request):
    uploaded = request.FILES.get("image")
    if not uploaded:
        return JsonResponse({"success": False, "error": "No image provided."}, status=400)

    op = request.POST.get("operation", "").strip()
    inp = _save_upload(uploaded)
    odir, tok = _result_dir()

    try:
        result = _dispatch(op, request, inp, odir, tok)
    except Exception as ex:
        return JsonResponse({"success": False, "error": str(ex)}, status=500)

    return JsonResponse({
        "success": True,
        "operation": op,
        "input_image_url": _to_url(inp),
        "result": _convert(result),
    })


# ── Operation dispatch ─────────────────────────────────────────────────


def _dispatch(op: str, request, inp: Path, odir: Path, tok: str) -> dict:
    P = request.POST  # shorthand

    if op == "read_info":
        return cv_core.read_image_info(str(inp))

    if op == "save_grayscale":
        return {"output": cv_core.save_grayscale(str(inp), str(odir / f"{tok}_gray.png"))}

    if op == "add_noise":
        return {"output": cv_core.add_noise(
            str(inp), str(odir / f"{tok}_noise.png"),
            P.get("noise_type", "gaussian"),
            _float(P.get("amount"), 0.05),
            _float(P.get("sigma"), 25.0),
            _int(P.get("uniform_range"), 30),
        )}

    # FIX 1: pass sigma_lp (from the form field name="sigma_lp") correctly
    if op == "low_pass":
        return {"output": cv_core.apply_low_pass_filter(
            str(inp), str(odir / f"{tok}_lp.png"),
            P.get("filter_type", "gaussian"),
            _int(P.get("kernel_size"), 3),
            _float(P.get("sigma_lp"), 1.0),   # <-- was P.get("sigma") before
        )}

    if op == "edges":
        return cv_core.detect_edges(
            str(inp), str(odir / f"{tok}_edge"),
            P.get("edge_method", "sobel"),
            _int(P.get("kernel_size"), 3),
            _float(P.get("threshold1"), 50.0),
            _float(P.get("threshold2"), 150.0),
        )

    if op == "hist_cdf":
        return cv_core.draw_histogram_and_cdf(
            str(inp),
            str(odir / f"{tok}_hist.png"),
            str(odir / f"{tok}_cdf.png"),
            P.get("hist_mode", "gray"),
        )

    # FIX 2: equalize now returns before/after histograms too
    if op == "equalize":
        raw = cv_core.equalize_image(
            str(inp),
            str(odir / f"{tok}_eq.png"),
            str(odir / f"{tok}_hist_before.png"),
            str(odir / f"{tok}_hist_after.png"),
        )
        return raw  # already a dict: output, hist_before, hist_after

    # FIX 3: norm_type only accepts minmax / inf now
    if op == "normalize":
        return {"output": cv_core.normalize_image(
            str(inp), str(odir / f"{tok}_norm.png"),
            _float(P.get("alpha"), 0.0),
            _float(P.get("beta"), 255.0),
            P.get("norm_type", "minmax"),
        )}

    # FIX 4: threshold simplified – no method selector, binary only
    if op == "threshold":
        return {"output": cv_core.apply_threshold(
            str(inp), str(odir / f"{tok}_thresh.png"),
            _float(P.get("threshold"), 127.0),
            _float(P.get("max_value"), 255.0),
        )}

    if op == "freq_filter":
        return {"output": cv_core.frequency_filter(
            str(inp), str(odir / f"{tok}_freq.png"),
            P.get("freq_type", "low_pass"),
            _int(P.get("cutoff"), 30),
        )}

    if op == "hybrid":
        second = request.FILES.get("image2")
        if not second:
            raise ValueError("Second image (image2) is required for hybrid.")
        inp2 = _save_upload(second)
        return {
            "output": cv_core.hybrid_image(
                str(inp), str(inp2), str(odir / f"{tok}_hybrid.png"),
                _float(P.get("low_sigma"), 5.0),
                _float(P.get("high_sigma"), 3.0),
                _float(P.get("mix_weight"), 0.5),
            ),
            "second_input": str(inp2),
        }

    raise ValueError(f"Unknown operation: {op}")