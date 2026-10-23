/**
 * One filename slug for every Flare path Flare Studio writes.
 * ASCII, lower case, underscores. Turkish letters are folded first so
 * "ışık" does not collapse to "sk".
 */

const FOLDS = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  Ç: "c",
  Ğ: "g",
  İ: "i",
  Ö: "o",
  Ş: "s",
  Ü: "u",
  â: "a",
  î: "i",
  û: "u",
  Â: "a",
  Î: "i",
  Û: "u",
};

function slugFileName(input) {
  let text = String(input || "").trim();
  text = text.replace(/[çğıöşüÇĞİÖŞÜâîûÂÎÛ]/g, (ch) => FOLDS[ch] || ch);
  text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  text = text
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return text || "unnamed";
}

/** Previous export rule, kept so Play can still find maps saved before the slug. */
function legacyMapFileName(input) {
  return (
    String(input || "")
      .replace(/[<>:"/\|?*]/g, "_")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/_{2,}/g, "_") || "Map_Name"
  );
}

module.exports = { slugFileName, legacyMapFileName };
