from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import base64
from PIL import Image, ImageDraw
from .adapter import ComputerAdapter


@dataclass
class RobustClickResult:
    clicked: bool
    final_x: int
    final_y: int
    attempts: int
    annotated_data_url: str


def _to_data_url(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")


def annotate_cursor(img: Image.Image, x: int, y: int) -> Image.Image:
    out = img.copy()
    draw = ImageDraw.Draw(out)
    draw.ellipse((x - 12, y - 12, x + 12, y + 12), outline="#ff3b30", width=4)
    sx, sy = x - 80, y - 80
    draw.line((sx, sy, x, y), fill="#ff3b30", width=4)
    draw.text((sx - 20, sy - 20), "鼠标指针", fill="#ff3b30")
    return out


def robust_click(computer: ComputerAdapter, tx: int, ty: int, max_iter: int = 4, tolerance: int = 14) -> RobustClickResult:
    annotated_url = ""
    cx, cy = tx, ty
    for idx in range(1, max_iter + 1):
        computer.move(cx, cy)
        shot = computer.screenshot()
        mx, my = computer.get_cursor_position()
        annotated = annotate_cursor(shot, mx, my)
        annotated_url = _to_data_url(annotated)

        if abs(mx - tx) <= tolerance and abs(my - ty) <= tolerance:
            computer.click(mx, my)
            return RobustClickResult(True, mx, my, idx, annotated_url)

        dx = (tx - mx) // 2
        dy = (ty - my) // 2
        cx, cy = mx + dx, my + dy

    return RobustClickResult(False, mx, my, max_iter, annotated_url)
