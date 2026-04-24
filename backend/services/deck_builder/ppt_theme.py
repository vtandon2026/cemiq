# deck_builder/ppt_theme.py
from dataclasses import dataclass
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor


@dataclass(frozen=True)
class Theme:
    slide_width:  int
    slide_height: int
    font_title:   str      = "Calibri"
    font_body:    str      = "Calibri"
    color_title:  RGBColor = RGBColor(20, 20, 20)
    color_body:   RGBColor = RGBColor(40, 40, 40)
    color_muted:  RGBColor = RGBColor(110, 110, 110)
    margin_left:  int      = Inches(0.6)
    margin_right: int      = Inches(0.6)
    margin_top:   int      = Inches(0.4)
    margin_bottom:int      = Inches(0.4)


def default_theme() -> Theme:
    return Theme(
        slide_width  = Inches(13.333),
        slide_height = Inches(7.5),
    )


def pt(x: int) -> int:
    return Pt(x)