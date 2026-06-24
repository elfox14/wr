# Post-Match Content Engine

This feature turns a verified match into long-lived SEO content without adding external API pressure to public pages.

## Flow

```text
Final DB snapshots
  -> /api/cron/post-match-content
  -> MatchArticle + MatchInfographic + MediaAsset
  -> /articles/[slug]
  -> generated SVG hero image and infographic
```

## Defaults

- The cron endpoint requires a secret.
- It reads database snapshots only.
- It does not publish automatically unless `POST_MATCH_CONTENT_AUTO_PUBLISH=true`.
- It only accepts `FINAL_VERIFIED` matches unless `POST_MATCH_CONTENT_ALLOW_FINISHED=true`.

## Environment variables

```env
POST_MATCH_CONTENT_SECRET="your-secret"
POST_MATCH_CONTENT_TARGET_ORIGIN="https://worldcup.mcprim.com"
POST_MATCH_CONTENT_LIMIT="5"
POST_MATCH_CONTENT_ALLOW_FINISHED="false"
POST_MATCH_CONTENT_AUTO_PUBLISH="false"
```

## Cron endpoint

```text
GET https://worldcup.mcprim.com/api/cron/post-match-content?limit=5
Authorization: Bearer YOUR_POST_MATCH_CONTENT_SECRET
```

For a temporary manual backfill before every match has `FINAL_VERIFIED`:

```text
GET /api/cron/post-match-content?limit=5&allowFinished=true&autoPublish=false
```

## Generated routes

- Article page: `/articles/[slug]`
- Match resolver: `/articles/match/[matchId]`
- Hero image: `/match-article-image/[slug]`
- Infographic image: `/match-infographic/[id]`

## Tables bootstrapped automatically

- `MatchArticle`
- `MatchInfographic`
- `MediaAsset`
- `ArticleGenerationJob`
- `EditorialReview`

The first version uses `CREATE TABLE IF NOT EXISTS` to avoid a risky database migration on the current production database.

## Recommended production flow

1. Post-match verification sets `Match.status = FINAL_VERIFIED`.
2. Post-match content cron runs.
3. Article is generated as `DRAFT_READY`.
4. Editor reviews content and media.
5. Set article to `PUBLISHED`, or enable `POST_MATCH_CONTENT_AUTO_PUBLISH=true` later.
6. Sitemap includes only `PUBLISHED` articles.
