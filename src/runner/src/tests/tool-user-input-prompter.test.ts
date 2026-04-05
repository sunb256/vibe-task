import * as assert from "node:assert/strict";
import test from "node:test";
import { ToolUserInputPrompter } from "../app/tool-user-input-prompter.js";

function createPrompter(answers: string[]) {
  let index = 0;
  return new ToolUserInputPrompter({
    question: async () => answers[index++] ?? "",
    clearProgressMessage: () => undefined,
    log: () => undefined,
  });
}

test("ToolUserInputPrompter resolves numeric choice to option value", async () => {
  const prompter = createPrompter(["2"]);

  const result = await prompter.askToolUserInput({
    questions: [
      {
        label: "Pick one",
        options: [
          { label: "Alpha", value: "alpha" },
          { label: "Beta", value: "beta" },
        ],
      },
    ],
  });

  assert.deepEqual(result, { answers: ["beta"], response: ["beta"] });
});

test("ToolUserInputPrompter accepts free text when isOther option exists", async () => {
  const prompter = createPrompter(["o", "custom reply"]);

  const result = await prompter.askToolUserInput({
    questions: [
      {
        label: "Input",
        options: [
          { label: "Preset", value: "preset" },
          { label: "Other", isOther: true },
        ],
      },
    ],
  });

  assert.deepEqual(result, { answers: ["custom reply"], response: ["custom reply"] });
});

test("ToolUserInputPrompter returns empty answers when JSON prompt is blank", async () => {
  const prompter = createPrompter([""]);

  const result = await prompter.askToolUserInput({});

  assert.deepEqual(result, { answers: [] });
});
