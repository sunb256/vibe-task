export type Project = {
  id: string;
  name: string;
  repositoryPath: string;
};

export type ProjectFormState = {
  name: string;
  repositoryPath: string;
};

export const defaultProjectForm: ProjectFormState = {
  name: "",
  repositoryPath: "",
};
