from __future__ import annotations

import copy
import json
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import *


REPO_ROOT = Path(__file__).resolve().parents[1]
CARD_ART_PATH = REPO_ROOT / "src/games/exploding_kittens/card_art.js"
WORKFLOW_PATH = REPO_ROOT / "StandardFlow.json"
OUTPUT_DIR = REPO_ROOT / "output/ek_cards"

CONFIG = {
    "comfy_server": "http://127.0.0.1:8188",
    "workflow_path": WORKFLOW_PATH,
    "output_dir": OUTPUT_DIR,
    "manifest_path": OUTPUT_DIR / "manifest.json",
    "dry_run": False,
    "overwrite": False,
    "ruleset": None,
    "card_ids": [],
    "width": 640,
    "height": 960,
    "checkpoint_name": None,
    "seed_base": 31015001,
    "seed_step": 1,
    "poll_interval_seconds": 1.0,
    "poll_timeout_seconds": 600.0,
    "filename_prefix": "ek_cards/generated",
    "lora_tags": None,
    "prompt_overrides": {
        "style_prefix": None,
        "background": None,
        "negative_prompt": None,
    },
}

PROMPT_TEMPLATES = {
    "character_portrait": {
        "composition": "portrait 2:3 composition, single clear focal subject, character-forward framing, readable silhouette, generous safe margins for card crop",
        "camera": "three-quarter view or clean portrait pose, not overly centered if attitude reads better off-axis",
        "background": "plain light cream removable background with minimal accents, no scenery clutter, easy to cut out",
    },
    "action_scene": {
        "composition": "portrait 2:3 composition, strong diagonal action, medium shot, off-center framing, clear silhouette, generous safe margins for card crop",
        "camera": "dynamic action scene, implied motion, subject not posed like a neutral mascot portrait",
        "background": "plain light cream removable background with only minimal action dust, smoke, sparks, or magical accents, no scenery clutter",
    },
}

PROMPT_TEMPLATE_FAMILIES = {
    "kitten": "character_portrait",
    "cat": "character_portrait",
}

NEGATIVE_PROMPT_SUFFIX = {
    "action_scene": "front-facing portrait, centered character, symmetrical pose, idle pose, standing still, cute sticker pose, toy product shot, pet portrait, character sheet, full body centered, holding object calmly, no action, no motion, flat neutral expression",
    "character_portrait": "busy scenery, cinematic landscape, multiple unrelated characters, cluttered environment, tiny distant subject",
}


def export_card_metadata() -> dict[str, Any]:
    node_script = """
import { EK_CARD_ART, EK_CARD_PROMPT_SPEC } from %s;
console.log(JSON.stringify({
  cards: Object.values(EK_CARD_ART),
  promptSpec: EK_CARD_PROMPT_SPEC
}));
""" % json.dumps(CARD_ART_PATH.as_uri())
    result = subprocess.run(
        ["node", "--input-type=module", "-e", node_script],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def load_template_workflow() -> dict[str, Any]:
    with CONFIG["workflow_path"].open("r", encoding="utf-8") as handle:
        return json.load(handle)


def template_lora_tags(workflow: dict[str, Any]) -> list[str]:
    text = workflow.get("25", {}).get("inputs", {}).get("text", "")
    tags = []
    for line in text.splitlines():
        stripped = line.strip().rstrip(",")
        if stripped.startswith("<lora:") and stripped.endswith(">"):
            tags.append(stripped)
    return tags


def selected_cards(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {card["cardId"]: card for card in cards}
    card_ids = CONFIG["card_ids"] or []
    if card_ids:
        missing = [card_id for card_id in card_ids if card_id not in by_id]
        if missing:
            raise ValueError(f"Unknown card ids in CONFIG['card_ids']: {missing}")
        return [by_id[card_id] for card_id in card_ids]

    ruleset = CONFIG["ruleset"]
    if ruleset:
        return [card for card in cards if ruleset in card["rulesetPresence"]]

    return cards


def prompt_template_name(card: dict[str, Any]) -> str:
    return PROMPT_TEMPLATE_FAMILIES.get(card["family"], "action_scene")


def prompt_components(card: dict[str, Any], prompt_spec: dict[str, Any]) -> tuple[str, str]:
    template_name = prompt_template_name(card)
    template = PROMPT_TEMPLATES[template_name]
    style_prefix = CONFIG["prompt_overrides"]["style_prefix"] or prompt_spec["stylePrefix"]
    background = CONFIG["prompt_overrides"]["background"] or template["background"]
    lora_tags = CONFIG["lora_tags"]
    if lora_tags is None:
        lora_tags = template_lora_tags(load_template_workflow())

    positive_parts = [
        style_prefix,
        card["promptSubject"],
        card["promptMood"],
        template["camera"],
        template["composition"],
        background,
    ]
    positive_prompt = ",\n\n".join(part for part in positive_parts if part)
    if lora_tags:
        positive_prompt = positive_prompt + ",\n\n" + ",\n".join(lora_tags) + ",\n"

    negative_base = CONFIG["prompt_overrides"]["negative_prompt"] or card["negativePrompt"]
    negative_suffix = NEGATIVE_PROMPT_SUFFIX[template_name]
    negative_prompt = f"{negative_base}, {negative_suffix}"
    return positive_prompt, negative_prompt


def patch_workflow(
    workflow_template: dict[str, Any],
    positive_prompt: str,
    negative_prompt: str,
    seed: int,
    card_id: str,
) -> dict[str, Any]:
    workflow = copy.deepcopy(workflow_template)
    workflow["25"]["inputs"]["text"] = positive_prompt
    workflow["7"]["inputs"]["text"] = negative_prompt
    workflow["5"]["inputs"]["width"] = CONFIG["width"]
    workflow["5"]["inputs"]["height"] = CONFIG["height"]
    workflow["3"]["inputs"]["seed"] = seed

    checkpoint_name = CONFIG["checkpoint_name"]
    if checkpoint_name:
        workflow["4"]["inputs"]["ckpt_name"] = checkpoint_name

    preview_inputs = workflow["27"]["inputs"]
    workflow["27"] = {
        "inputs": {
            "filename_prefix": f"{CONFIG['filename_prefix']}/{card_id}",
            "images": preview_inputs["images"],
        },
        "class_type": "SaveImage",
        "_meta": {"title": "Save Image"},
    }
    return workflow


def queue_prompt(prompt: dict[str, Any]) -> str:
    payload = json.dumps({"prompt": prompt}).encode("utf-8")
    request = urllib.request.Request(
        f"{CONFIG['comfy_server']}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request) as response:
        result = json.loads(response.read().decode("utf-8"))
    return result["prompt_id"]


def poll_history(prompt_id: str) -> dict[str, Any]:
    timeout_at = time.time() + CONFIG["poll_timeout_seconds"]
    history_url = f"{CONFIG['comfy_server']}/history/{prompt_id}"
    while time.time() < timeout_at:
        with urllib.request.urlopen(history_url) as response:
            history = json.loads(response.read().decode("utf-8"))
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(CONFIG["poll_interval_seconds"])
    raise TimeoutError(f"Timed out waiting for ComfyUI prompt {prompt_id}")


def fetch_saved_image(history_entry: dict[str, Any]) -> bytes:
    for node_output in history_entry.get("outputs", {}).values():
        images = node_output.get("images") or []
        if not images:
            continue
        image = images[0]
        query = urllib.parse.urlencode(
            {
                "filename": image["filename"],
                "subfolder": image["subfolder"],
                "type": image["type"],
            }
        )
        with urllib.request.urlopen(f"{CONFIG['comfy_server']}/view?{query}") as response:
            return response.read()
    raise RuntimeError("ComfyUI history did not include any saved image outputs.")


def card_seed(index: int) -> int:
    return CONFIG["seed_base"] + (index * CONFIG["seed_step"])


def output_path(card_id: str) -> Path:
    return CONFIG["output_dir"] / f"{card_id}.png"


def write_manifest(entries: list[dict[str, Any]]) -> None:
    CONFIG["output_dir"].mkdir(parents=True, exist_ok=True)
    with CONFIG["manifest_path"].open("w", encoding="utf-8") as handle:
        json.dump(entries, handle, indent=2)
        handle.write("\n")


def main() -> None:
    metadata = export_card_metadata()
    cards = selected_cards(metadata["cards"])
    workflow_template = load_template_workflow()
    manifest_entries = []
    CONFIG["output_dir"].mkdir(parents=True, exist_ok=True)

    for index, card in enumerate(cards):
        card_id = card["cardId"]
        destination = output_path(card_id)
        if destination.exists() and not CONFIG["overwrite"]:
            manifest_entries.append(
                {
                    "cardId": card_id,
                    "status": "skipped_existing",
                    "outputPath": str(destination),
                }
            )
            continue

        positive_prompt, negative_prompt = prompt_components(card, metadata["promptSpec"])
        seed = card_seed(index)
        manifest_entry = {
            "cardId": card_id,
            "seed": seed,
            "width": CONFIG["width"],
            "height": CONFIG["height"],
            "checkpoint": CONFIG["checkpoint_name"] or workflow_template["4"]["inputs"]["ckpt_name"],
            "rulesets": card["rulesetPresence"],
            "family": card["family"],
            "frameVariant": card["frameVariant"],
            "prompt": positive_prompt,
            "negativePrompt": negative_prompt,
            "outputPath": str(destination),
            "loraTags": CONFIG["lora_tags"] if CONFIG["lora_tags"] is not None else template_lora_tags(workflow_template),
        }

        if CONFIG["dry_run"]:
            manifest_entry["status"] = "dry_run"
            manifest_entries.append(manifest_entry)
            continue

        prompt = patch_workflow(workflow_template, positive_prompt, negative_prompt, seed, card_id)
        prompt_id = queue_prompt(prompt)
        history_entry = poll_history(prompt_id)
        destination.write_bytes(fetch_saved_image(history_entry))
        manifest_entry["promptId"] = prompt_id
        manifest_entry["status"] = "generated"
        manifest_entries.append(manifest_entry)

    write_manifest(manifest_entries)


if __name__ == "__main__":
    main()
