import "server-only";

const dictionaries = {
  pt: () => import("../../dictionaries/pt.json").then((m) => m.default),
};

export const getDictionary = async (locale) =>
  dictionaries[locale]?.() ?? dictionaries["pt"]();
