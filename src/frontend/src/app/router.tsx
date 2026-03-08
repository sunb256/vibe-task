import { createBrowserRouter } from "react-router-dom";

import { CustomPromptPage } from "../features/prompts/CustomPromptPage";
import { ProjectTasksPage } from "../features/tasks/ProjectTasksPage";
import { ProjectListPage } from "../features/projects/ProjectListPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <ProjectListPage />,
  },
  {
    path: "/projects/:projectId",
    element: <ProjectTasksPage />,
  },
  {
    path: "/custom-prompt",
    element: <CustomPromptPage />,
  },
]);
