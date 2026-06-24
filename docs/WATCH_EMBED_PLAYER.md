# Watch Embed Player

The `/watch/[matchId]` page is the only place that should render the video player.

The match center remains focused on statistics, timelines, xG, player ratings, and analysis. Public match pages should continue to read saved database state only and should not fetch external sports APIs during page load.

## Supported configuration

Set these variables in Render for the Web Service:

```env
WATCH_EMBED_ENABLED=true
WATCH_EMBED_ALLOWED_HOSTS=player.example.com,*.licensed-cdn.example
WATCH_EMBED_URL_TEMPLATE=https://player.example.com/embed/{matchId}
```

The template supports:

```text
{matchId}
{homeId}
{awayId}
{homeCode}
{awayCode}
{homeName}
{awayName}
```

Example:

```env
WATCH_EMBED_URL_TEMPLATE=https://player.example.com/embed/{homeCode}-{awayCode}
```

## Per-match mapping

Use `WATCH_EMBED_MAP_JSON` when each match needs a different embed URL:

```env
WATCH_EMBED_ENABLED=true
WATCH_EMBED_ALLOWED_HOSTS=player.example.com
WATCH_EMBED_MAP_JSON={"cmq6vhgfh0128g7g4ntiqi8hf":"https://player.example.com/embed/egy-nzl"}
```

Map keys may be:

- database match ID
- home team code
- `HOME-AWAY` code pair

Priority order:

1. database match ID
2. home team code
3. `HOME-AWAY` code pair
4. `WATCH_EMBED_URL_TEMPLATE`

## Security rules

- Use only official/licensed embed URLs that you are allowed to display.
- Do not put private API keys, admin secrets, or long-lived tokens inside iframe URLs. Anything inside the iframe URL is visible to the browser.
- `WATCH_EMBED_ALLOWED_HOSTS` is required. If it is empty, the page will keep showing the placeholder.
- Non-HTTPS URLs are blocked except localhost for development.
- The iframe runs with a restrictive sandbox and only grants the minimum capabilities required for a typical video player.

## Fallback behavior

If no valid embed URL is configured, `/watch/[matchId]` keeps showing the professional placeholder and the rest of the page continues to work.

This means the watch page can be deployed before the real player is ready.
