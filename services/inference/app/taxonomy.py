from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


TAGS: list[str] = [
    "hoodie",
    "sweatshirt",
    "t-shirt",
    "top",
    "shirt",
    "jacket",
    "coat",
    "jeans",
    "pants",
    "cargo",
    "skirt",
    "dress",
    "knit",
    "denim",
    "streetwear",
    "casual",
    "formal",
    "vintage",
    "oversized",
    "slim-fit",
    "neutral",
    "black",
    "white",
    "grey",
    "beige",
    "brown",
    "blue",
    "green",
    "red",
    "pink",
    "graphic",
    "minimalist",
    "sporty",
]


@dataclass(frozen=True)
class TagPrompt:
    tag: str
    prompt: str


def build_prompt(tag: str) -> str:
    if tag in {"streetwear", "casual", "formal", "vintage", "minimalist", "sporty"}:
        return f"a clothing item in a {tag} style"
    if tag in {"oversized", "slim-fit"}:
        return f"a fashion item with an {tag} fit" if tag == "oversized" else f"a fashion item with a {tag} fit"
    if tag in {"black", "white", "grey", "beige", "brown", "blue", "green", "red", "pink", "neutral"}:
        return f"a product in {tag} color"
    if tag == "graphic":
        return "a fashion item with graphic design"

    return f"a photo of a fashion product that is a {tag}"


def build_tag_prompts(tags: Iterable[str] = TAGS) -> list[TagPrompt]:
    return [TagPrompt(tag=tag, prompt=build_prompt(tag)) for tag in tags]
