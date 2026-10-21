const { requestJson } = require("../../utils/http");

const APPVIEW = "https://public.api.bsky.app/xrpc";
const truncate = (text, max = 300) => {
  const t = String(text || "").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const rkeyOf = (uri) => String(uri || "").split("/").pop();

function postToItem(post, did) {
  const rkey = rkeyOf(post.uri);
  const record = post.record || {};
  const images = post.embed?.$type === "app.bsky.embed.images" ? post.embed.images || [] : [];

  return {
    id: rkey,
    url: `https://bsky.app/profile/${did}/post/${rkey}`,
    title: post.author?.displayName || post.author?.handle || "Bluesky",
    description: truncate(record.text),
    author: `@${post.author?.handle || "unknown"}`,
    image: images[0]?.fullsize || images[0]?.thumb || null,
    timestamp: record.createdAt || null,
  };
}

module.exports = {
  key: "bluesky",
  label: "Bluesky",
  color: 0x1185fe,
  interval: 60,
  configured: () => true, // public AppView, no credentials

  /** Accepts a handle (@name.bsky.social), a DID, or a bsky.app profile URL. */
  async resolve(input) {
    let actor = String(input || "").trim();
    if (!actor) throw new Error("sorgente vuota");

    const urlMatch = actor.match(/bsky\.app\/profile\/([^/?#]+)/i);
    if (urlMatch) actor = urlMatch[1];
    actor = actor.replace(/^@/, "");

    if (!actor.startsWith("did:") && !actor.includes(".")) {
      throw new Error("handle Bluesky non valido (es. `alice.bsky.social`)");
    }

    const profile = await requestJson(
      `${APPVIEW}/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`
    );
    return { source: profile.did, label: `@${profile.handle}` };
  },

  /**
   * @param {string} source DID of the account
   * @param {string|null} lastItemId rkey of the newest post already handled
   */
  async check(source, lastItemId) {
    const data = await requestJson(
      `${APPVIEW}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(source)}` +
        `&filter=posts_no_replies&limit=25`
    );

    // Skip reposts: only the author's own posts count as "new post".
    const posts = (data.feed || [])
      .filter((e) => !e.reason && e.post)
      .map((e) => postToItem(e.post, source));

    const currentId = posts[0]?.id || null;

    if (lastItemId === null || lastItemId === undefined) {
      return { items: [], currentId };
    }

    const marker = posts.findIndex((p) => p.id === lastItemId);
    let fresh = marker === -1 ? posts : posts.slice(0, marker);
    if (fresh.length > 3) fresh = fresh.slice(0, 3);
    fresh.reverse();

    return { items: fresh, currentId };
  },
};
