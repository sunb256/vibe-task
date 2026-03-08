export type SkillSummary = {
  name: string;
  path: string;
};

export type SkillFile = SkillSummary & {
  content: string;
};
