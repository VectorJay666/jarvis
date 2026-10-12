/** Boss DIY avatar — phase-2 gen only. P0 is local crop; this guards prompts. */

export const AVATAR_IP_FORBIDDEN = [
  /海绵宝宝|派大星|蟹老板|哆啦A梦|皮卡丘|马里奥|米老鼠|迪士尼|火影|路飞|初音|哈利.?波特/i,
  /spongebob|pokemon|pikachu|disney|mario|mickey|naruto|one\s*piece/i,
  /名人|明星|总统|习近|特朗普|trump|celebrity|influencer/i,
];

export function avatarBanned(text = "") {
  return AVATAR_IP_FORBIDDEN.some((re) => re.test(text));
}

/** Safe prompt wrapper: original simple avatar only. Returns null if banned. */
export function buildAvatarPrompt(userHint = "") {
  const hint = String(userHint || "").trim().slice(0, 40);
  if (avatarBanned(hint)) return null;
  return [
    "Draw an original simple circular avatar sticker, flat minimal, grayscale-friendly.",
    "No logos, no trademarks, no copyrighted characters, no real celebrity likeness.",
    "Clean face or geometric mascot, centered, transparent-friendly background.",
    hint ? `User vibe (non-IP): ${hint}` : "Soft friendly blob character.",
  ].join(" ");
}
