import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scrape_zhihu as sync


def raw(article_id="2027425907149652572"):
    return {"id": article_id, "title": "测试文章", "created": 1776166080, "updated": 1776166080, "content": "<p>正文 &amp; 测试</p>"}


class SyncTests(unittest.TestCase):
    def test_id_and_fulltext(self):
        article = sync.parse_article(raw())
        self.assertEqual(article["id"], "2027425907149652572")
        self.assertEqual(article["excerpt"], "正文 & 测试")
        self.assertIn("content_html", article)

    def test_partial_pagination_fails(self):
        with patch.object(sync, "fetch_articles", side_effect=[{"data": [raw()], "paging": {"is_end": False}}, RuntimeError("HTTP 403")]), patch.object(sync.time, "sleep"):
            with self.assertRaises(RuntimeError):
                sync.scrape_all()

    def test_empty_and_invalid_payload_fail(self):
        with patch.object(sync, "fetch_articles", return_value={"data": [], "paging": {"is_end": True}}):
            with self.assertRaises(ValueError):
                sync.scrape_all()
        with self.assertRaises(ValueError):
            sync.parse_article({**raw(), "author": {"url_token": "another-author"}})
        with self.assertRaises(ValueError):
            sync.parse_article({**raw(), "content": ""})

    def test_merge_and_idempotence(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "articles.json"
            first = sync.parse_article(raw())
            sync.save_articles([first], output)
            saved = output.read_bytes()
            self.assertFalse(sync.save_articles([first], output))
            self.assertEqual(saved, output.read_bytes())
            sync.save_articles([sync.parse_article(raw("123"))], output)
            self.assertEqual(len(json.loads(output.read_text(encoding="utf-8"))["articles"]), 2)
            saved = output.read_bytes()
            with self.assertRaises(ValueError):
                sync.save_articles([], output)
            self.assertEqual(saved, output.read_bytes())

    def test_metadata_cannot_silently_stale_fulltext(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "articles.json"
            sync.save_articles([sync.parse_article(raw())], output)
            saved = output.read_bytes()
            metadata = sync.parse_article({**raw(), "updated": 1776166081}, fulltext=False)
            with self.assertRaises(ValueError):
                sync.save_articles([metadata], output)
            self.assertEqual(saved, output.read_bytes())


if __name__ == "__main__":
    unittest.main()
