import json

from src.config import Settings
from src.services.minimax_client import build_minimax_client, extract_json


def test_extract_json_strips_reasoning_block():
    raw = '<think>The user wants me to judge.\nLet me think.</think>\n{"threat_score": 90}'
    assert json.loads(extract_json(raw)) == {"threat_score": 90}


def test_extract_json_slices_outermost_object():
    raw = 'Here is the result:\n{"payloads": ["a", "b"]}\nDone.'
    assert json.loads(extract_json(raw)) == {"payloads": ["a", "b"]}


def test_extract_json_handles_plain_object():
    assert json.loads(extract_json('{"a": 1}')) == {"a": 1}


def test_extract_json_handles_none():
    assert extract_json(None) == ""


def test_build_client_none_when_unconfigured():
    assert build_minimax_client(Settings(MINIMAX_API_KEY=None)) is None
