export type SkillSummary = {
  name: string;
  path: string;
  source: "global" | "project";
  projectName: string;
  editable: boolean;
};

export type SkillFile = SkillSummary & {
  content: string;
};
