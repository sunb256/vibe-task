export type Project = {
  id: string;
  name: string;
  repositoryPath: string;
  actionListPath: string;
  doneListPath: string;
};

export type ProjectFormState = {
  name: string;
  repositoryPath: string;
  actionListPath: string;
  doneListPath: string;
};

export const defaultProjectForm: ProjectFormState = {
  name: "",
  repositoryPath: "",
  actionListPath: "tasks/action.yml",
  doneListPath: "tasks/done.yml",
};
