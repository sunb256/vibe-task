export type PromptSummary = {
  name: string;
  path: string;
};

export type PromptFile = PromptSummary & {
  content: string;
};
