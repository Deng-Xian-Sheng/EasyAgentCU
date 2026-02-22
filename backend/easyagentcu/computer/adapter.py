from __future__ import annotations

from typing import Protocol
from PIL import Image, ImageDraw


class ComputerAdapter(Protocol):
    def screenshot(self) -> Image.Image: ...
    def move(self, x: int, y: int) -> None: ...
    def click(self, x: int, y: int, button: str = "left") -> None: ...
    def type(self, text: str) -> None: ...
    def scroll(self, x: int, y: int, scroll_x: int, scroll_y: int) -> None: ...
    def get_cursor_position(self) -> tuple[int, int]: ...


class MockComputer:
    def __init__(self, width: int = 960, height: int = 540) -> None:
        self.width = width
        self.height = height
        self.cursor = (200, 150)
        self.last_action = "idle"

    def screenshot(self) -> Image.Image:
        img = Image.new("RGB", (self.width, self.height), color=(34, 37, 43))
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle((120, 80, 840, 450), radius=12, outline=(90, 95, 110), width=2)
        draw.text((150, 105), f"Mock Desktop | action={self.last_action}", fill=(220, 220, 220))
        draw.rectangle((240, 200, 460, 250), outline=(210, 80, 80), width=2)
        draw.text((250, 210), "Search Box", fill=(240, 240, 240))
        mx, my = self.cursor
        draw.ellipse((mx - 4, my - 4, mx + 4, my + 4), fill=(255, 255, 255))
        return img

    def move(self, x: int, y: int) -> None:
        self.cursor = (max(0, min(self.width - 1, x)), max(0, min(self.height - 1, y)))
        self.last_action = f"move({x},{y})"

    def click(self, x: int, y: int, button: str = "left") -> None:
        self.move(x, y)
        self.last_action = f"click({button},{x},{y})"

    def type(self, text: str) -> None:
        self.last_action = f"type({text[:18]})"

    def scroll(self, x: int, y: int, scroll_x: int, scroll_y: int) -> None:
        self.last_action = f"scroll({scroll_x},{scroll_y})"

    def get_cursor_position(self) -> tuple[int, int]:
        return self.cursor
