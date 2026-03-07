import { createBrowserRouter } from "react-router-dom";

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
]);
