#!/usr/bin/env python3
"""Import the owner's published Zhihu articles; never overwrite on partial failure.

Cookie is optional and used only in the request header. No login/anti-bot bypass.
Use --input for an authorized local API export, or --metadata-only for excerpts.
HTML is kept as data here and allowlist-sanitized by the site's build pipeline.
"""

import argparse
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

import requests

USER_URL_TOKEN = "wrm-66-76"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "articles.json"
API_BASE = "https://www.zhihu.com/api/v4"
LIMIT = 20


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)
        if tag in ("p", "div", "li", "h1", "h2", "h3", "pre"):
            self.parts.append(" ")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def text_content(content):
    parser = TextExtractor()
    parser.feed(content)
    return " ".join("".join(parser.parts).split())


def get_headers():
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; LandingWPersonalArchive/1.0)",
        "Referer": f"https://www.zhihu.com/people/{USER_URL_TOKEN}/posts",
        "Accept": "application/json",
    }
    if os.environ.get("ZHIHU_COOKIE"):
        headers["Cookie"] = os.environ["ZHIHU_COOKIE"]
    return headers


def fetch_articles(offset=0):
    response = requests.get(
        f"{API_BASE}/members/{USER_URL_TOKEN}/articles",
        headers=get_headers(),
        params={"include": "data[*].content,created,updated,voteup_count,comment_count,author,thumbnail", "offset": offset, "limit": LIMIT, "sort_by": "created"},
        timeout=30,
        allow_redirects=False,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Zhihu returned HTTP {response.status_code}. Existing archive is unchanged; use your own export or valid authorized access.")
    return response.json()


def parse_article(raw, fulltext=True):
    article_id = str(raw.get("id", ""))
    title = raw.get("title", "")
    if not article_id.isdigit() or not isinstance(title, str) or not title.strip():
        raise ValueError("Invalid article ID or title; refusing incomplete import.")
    author = raw.get("author") or {}
    if author.get("url_token") and author["url_token"] != USER_URL_TOKEN:
        raise ValueError("Article is not from the configured author.")
    content = raw.get("content") or raw.get("content_html") or ""
    if not isinstance(content, str):
        raise ValueError("Invalid article content.")
    if fulltext and not text_content(content):
        raise ValueError(f"Article {article_id} has no full text. Use --metadata-only explicitly for excerpts.")
    created = raw.get("created", 0)
    updated = raw.get("updated") or created
    if not isinstance(created, int) or created <= 0 or not isinstance(updated, int) or updated <= 0:
        raise ValueError(f"Article {article_id} has an invalid timestamp.")
    thumbnail = raw.get("thumbnail")
    article = {
        "id": article_id, "title": title.strip(),
        "url": f"https://zhuanlan.zhihu.com/p/{article_id}",
        "excerpt": text_content(content or raw.get("excerpt", ""))[:200],
        "voteup_count": int(raw.get("voteup_count") or 0),
        "comment_count": int(raw.get("comment_count") or 0),
        "created": created, "updated": updated,
        "thumbnail": thumbnail if isinstance(thumbnail, str) and thumbnail.startswith("https://") else None,
    }
    if fulltext:
        article["content_html"] = content
    return article


def scrape_all(fulltext=True):
    articles = []
    seen = set()
    for page in range(500):
        data = fetch_articles(page * LIMIT)
        if not isinstance(data, dict) or not isinstance(data.get("data"), list):
            raise ValueError("Unexpected API payload; archive unchanged.")
        items = data["data"]
        paging = data.get("paging") or {}
        if not isinstance(paging.get("is_end"), bool):
            raise ValueError("Missing pagination end marker; refusing partial import.")
        if not items and not paging["is_end"]:
            raise ValueError("Empty intermediate page; refusing partial import.")
        for item in items:
            article = parse_article(item, fulltext)
            if article["id"] in seen:
                raise ValueError("Repeated article in pagination; retry when the source is stable.")
            seen.add(article["id"])
            articles.append(article)
        if paging["is_end"]:
            if not articles:
                raise ValueError("Empty result; preserving existing archive.")
            return articles
        time.sleep(1.5)
    raise ValueError("Pagination limit exceeded; refusing partial import.")


def save_articles(articles, output_path=OUTPUT_PATH):
    if not articles:
        raise ValueError("Refusing to save an empty import.")
    output_path = Path(output_path)
    previous = json.loads(output_path.read_text(encoding="utf-8")) if output_path.exists() else {"articles": []}
    merged = {str(item["id"]): item for item in previous["articles"]}
    for article in articles:
        old = merged.get(article["id"], {})
        # A metadata-only refresh must not silently retain outdated full text.
        if old.get("content_html") and not article.get("content_html"):
            if old.get("updated") != article["updated"]:
                raise ValueError("A full-text article changed; rerun a full-text import to update it safely.")
            article = {**article, "content_html": old["content_html"]}
        merged[article["id"]] = article
    result = sorted(merged.values(), key=lambda item: (-item["created"], str(item["id"])))
    if result == previous["articles"]:
        print("No content changes; archive timestamp unchanged.")
        return False
    payload = {"updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "articles": result}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=output_path.parent, suffix=".tmp", delete=False) as temp:
            temp_name = temp.name
            json.dump(payload, temp, ensure_ascii=False, indent=2)
            temp.write("\n")
        os.replace(temp_name, output_path)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)
    print(f"Saved {len(result)} articles ({len(articles)} imported).")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Your own local JSON export (article, list, or data/articles array).")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--metadata-only", action="store_true")
    args = parser.parse_args()
    try:
        if args.input:
            payload = json.loads(args.input.read_text(encoding="utf-8-sig"))
            items = payload if isinstance(payload, list) else payload.get("data", payload.get("articles", [payload]))
            articles = [parse_article(item, not args.metadata_only) for item in items]
        else:
            articles = scrape_all(not args.metadata_only)
        save_articles(articles, args.output)
    except (requests.RequestException, ValueError, RuntimeError, OSError, TypeError, KeyError) as error:
        # Never emit response bodies, request headers or credentials.
        message = str(error).replace(os.environ.get("ZHIHU_COOKIE") or "\0", "[redacted]")
        print(f"Sync failed; existing archive preserved. {message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
