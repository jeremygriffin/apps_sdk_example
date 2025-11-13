import { z } from "zod";

const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
const createPlaceholderMatcher = () => new RegExp(PLACEHOLDER_PATTERN.source, "g");

export const PromptArgumentTypeSchema = z.enum(["string", "enum"]);
export type PromptArgumentType = z.infer<typeof PromptArgumentTypeSchema>;

export const PromptArgumentSchema = z
  .object({
    name: z.string().min(1, "Argument name is required"),
    description: z.string().min(1, "Argument description is required"),
    required: z.boolean().default(true),
    type: PromptArgumentTypeSchema,
    enumValues: z.array(z.string().min(1)).min(1).optional()
  })
  .superRefine((arg, ctx) => {
    if (arg.type === "enum" && (!arg.enumValues || arg.enumValues.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "enumValues is required when type is enum",
        path: ["enumValues"]
      });
    }
    if (arg.type === "string" && arg.enumValues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "enumValues is not supported for string arguments",
        path: ["enumValues"]
      });
    }
  });

export const PromptMessageSchema = z.object({
  role: z.enum(["system", "user"]),
  content: z.string().min(1, "Prompt message content is required")
});

export const PromptDefinitionSchema = z
  .object({
    name: z.string().min(1, "Prompt name is required"),
    description: z.string().min(1, "Prompt description is required"),
    arguments: z.array(PromptArgumentSchema).default([]),
    messages: z.array(PromptMessageSchema).min(1, "At least one message is required")
  })
  .superRefine((definition, ctx) => {
    const seenArgs = new Set<string>();
    definition.arguments.forEach((arg, index) => {
      if (seenArgs.has(arg.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate argument name "${arg.name}"`,
          path: ["arguments", index, "name"]
        });
      }
      seenArgs.add(arg.name);
    });

    const definedArgs = new Set(definition.arguments.map((arg) => arg.name));

    definition.messages.forEach((message, messageIndex) => {
      const matcher = createPlaceholderMatcher();
      let match: RegExpExecArray | null;
      while ((match = matcher.exec(message.content)) !== null) {
        const placeholder = match[1];
        if (!definedArgs.has(placeholder)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown placeholder "{{${placeholder}}}"`,
            path: ["messages", messageIndex, "content"]
          });
        }
      }
    });
  });

export type PromptArgument = z.infer<typeof PromptArgumentSchema>;
export type PromptMessage = z.infer<typeof PromptMessageSchema>;
export type PromptDefinition = z.infer<typeof PromptDefinitionSchema>;

const PromptCatalogSchema = z.array(PromptDefinitionSchema);

export const prompts: PromptDefinition[] = PromptCatalogSchema.parse([
  {
    name: "brain_dump_to_todos",
    description:
      "Convert a messy brain dump into structured todo drafts compatible with the create_todo tool input schema.",
    arguments: [
      {
        name: "dump",
        description: "Freeform stream of thoughts or notes provided by the user.",
        required: true,
        type: "string"
      },
      {
        name: "timeframe",
        description: "Optional focus window for scheduling (today, this_week, or someday).",
        required: false,
        type: "enum",
        enumValues: ["today", "this_week", "someday"]
      }
    ],
    messages: [
      {
        role: "system",
        content:
          "You turn messy notes into actionable todos. Use the supplied brain dump to create strictly the JSON payload below and nothing else: {\"todos\": [{\"title\": \"string\", \"notes\": \"string | optional\"}]}. Titles must be concise, imperative, and <= 80 characters. Only include notes when they add essential context. Never invent work that is not implied. Leave the array empty when there is no actionable task."
      },
      {
        role: "user",
        content:
          "Brain dump:\n{{dump}}\n\nRequested timeframe (blank when unspecified): {{timeframe}}"
      }
    ]
  },
  {
    name: "summarize_todos",
    description:
      "Summarize the current todo list into a short status update highlighting wins, risks, and next focus.",
    arguments: [
      {
        name: "todosJson",
        description:
          "JSON array of todos retrieved from list_todos. Includes status, notes, and metadata. Example: [{\"id\":\"todo-1\",\"title\":\"Draft plan\",\"status\":\"pending\",\"notes\":\"optional context\"}]",
        required: true,
        type: "string"
      },
      {
        name: "timeframe",
        description: "Optional planning window to emphasize (e.g., today, this week, Q4).",
        required: false,
        type: "string"
      }
    ],
    messages: [
      {
        role: "system",
        content:
          "You summarize todo lists for status reports. Read the provided JSON array exactly as given. Respond with JSON: {\"summary\": \"one or two sentences\", \"highlights\": [\"bullet\"], \"risks\": [\"risk\"], \"nextFocus\": [\"todo id or title\"], \"timeframe\": \"copied emphasis or empty\"}. Keep arrays short (<=3 items). Mention timeframe only when provided."
      },
      {
        role: "user",
        content:
          "Todos payload:\n{{todosJson}}\n\nTimeframe emphasis (may be blank): {{timeframe}}"
      }
    ]
  },
  {
    name: "prioritize_todos",
    description:
      "Rank todos using annotation signals (priority, complexity, marker) and recommend an action plan for the requested timeframe.",
    arguments: [
      {
        name: "todosJson",
        description:
          "JSON array of todos with annotations (priority 1-5, complexity 1-3, marker circle/triangle/square/diamond). Example: [{\"id\":\"todo-2\",\"title\":\"Prep report\",\"priority\":4,\"complexity\":2,\"marker\":\"triangle\"}]",
        required: true,
        type: "string"
      },
      {
        name: "timeframe",
        description: "Optional planning window (today, this_week, or later).",
        required: false,
        type: "enum",
        enumValues: ["today", "this_week", "later"]
      }
    ],
    messages: [
      {
        role: "system",
        content:
          "You are a task-planning assistant.\n\nEach todo includes annotations:\n- priority (1-5) => importance/urgency\n- complexity (1-3) => effort/time required\n- marker:\n  * circle => quick / lightweight\n  * triangle => needs attention or risky\n  * square => routine / maintenance\n  * diamond => strategic / high-value\n\nInstructions:\n1. Rank todos from most urgent/important to least using priority + marker context.\n2. Identify quick wins (priority >=3 AND complexity <=2, or marker=circle).\n3. Identify deep work (complexity >=3 or marker=diamond).\n4. Call out strategic/high-value items (marker=diamond) even if not at the top.\n5. Produce a recommended plan that respects the timeframe input when provided (default to current planning cycle).\n6. Return JSON: {\"ordered\": [{\"id\":\"todo id\",\"title\":\"string\",\"reason\":\"why ordered here\"}], \"quickWins\": [\"todo id\"], \"deepWork\": [\"todo id\"], \"strategic\": [\"todo id\"], \"recommendations\": [\"short guidance\"]}.\n7. Reference annotation values in explanations so the user understands why items were categorized.\n8. Never invent todos."
      },
      {
        role: "user",
        content:
          "Here are the todos to prioritize (JSON array):\n{{todosJson}}\n\nRequested timeframe (today/this_week/later or blank): {{timeframe}}"
      }
    ]
  },
  {
    name: "summarize_todo_load",
    description:
      "Summarize the user’s workload by grouping todos into buckets using their annotations.",
    arguments: [
      {
        name: "todosJson",
        description:
          "JSON array of todos with priority, complexity, and marker annotations to analyze. Example: [{\"id\":\"todo-7\",\"title\":\"Refactor auth\",\"priority\":5,\"complexity\":3,\"marker\":\"diamond\"}]",
        required: true,
        type: "string"
      }
    ],
    messages: [
      {
        role: "system",
        content:
          "Summarize the user's workload using annotation-aware buckets.\n\nUse the following categories (each todo may appear in multiple when justified):\n- Top Priority: priority 4-5\n- Quick Wins: complexity <=2 or marker=circle\n- Deep Work: complexity >=3 or marker=diamond\n- Maintenance / Routine: marker=square\n- Attention Needed: marker=triangle\n\nInstructions:\n1. Mention how many todos land in each bucket and highlight representative titles.\n2. Call out risks, bottlenecks, or missing annotations when relevant.\n3. Provide actionable guidance on how to tackle the workload.\n4. Output JSON: {\"summary\":\"short narrative\",\"buckets\":[{\"name\":\"bucket\",\"items\":[{\"id\":\"todo\",\"title\":\"string\"}]}],\"recommendations\":[\"action\"],\"risks\":[\"risk or empty\"]}.\n5. Always reference annotation values in explanations when available and note when data is missing."
      },
      {
        role: "user",
        content: "Here are the todos with annotations:\n{{todosJson}}"
      }
    ]
  },
  {
    name: "clarify_todo",
    description:
      "Rewrite a single todo so the title and notes are actionable, concise, and easy to schedule.",
    arguments: [
      {
        name: "title",
        description: "Current todo title.",
        required: true,
        type: "string"
      },
      {
        name: "notes",
        description: "Existing notes or context (may be blank).",
        required: false,
        type: "string"
      }
    ],
    messages: [
      {
        role: "system",
        content:
          "Improve the clarity of the provided todo. Respond with JSON: {\"title\": \"concise action-oriented text\", \"notes\": \"supporting detail or empty\"}. Keep the title <= 80 characters, mention the desired outcome, and ensure notes contain only critical context. Never add status or scheduling metadata."
      },
      {
        role: "user",
        content:
          "Original title: {{title}}\nExisting notes (possibly empty): {{notes}}"
      }
    ]
  },
  {
    name: "suggest_subtasks",
    description:
      "Break one large todo into a handful of practical subtasks that fit short working sessions.",
    arguments: [
      {
        name: "title",
        description: "Title of the large or ambiguous todo.",
        required: true,
        type: "string"
      },
      {
        name: "notes",
        description: "Additional context for the todo (optional).",
        required: false,
        type: "string"
      },
      {
        name: "maxSubtasks",
        description: "Upper bound for suggested subtasks. Provide an integer as a string (default 5).",
        required: false,
        type: "string"
      }
    ],
    messages: [
      {
        role: "system",
        content:
          "Break the todo into 3-7 concrete subtasks unless maxSubtasks lowers the ceiling. Respond with JSON: {\"subtasks\": [{\"title\": \"actionable subtask\", \"notes\": \"clarifying detail\"}]} and keep notes optional. Subtasks must be independent and completable in under one hour. Skip subtasks that repeat the parent wording."
      },
      {
        role: "user",
        content:
          "Todo to split: {{title}}\nContext notes (optional): {{notes}}\nMax subtasks requested: {{maxSubtasks}}"
      }
    ]
  }
]);

export class PromptArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptArgumentError";
  }
}

export interface PromptSummary {
  name: string;
  description: string;
  arguments: PromptArgument[];
}

export const getPromptCatalog = (): PromptSummary[] =>
  prompts.map((prompt) => ({
    name: prompt.name,
    description: prompt.description,
    arguments: prompt.arguments
  }));

export const getPromptByName = (name: string): PromptDefinition | undefined =>
  prompts.find((prompt) => prompt.name === name);

export const normalizePromptArguments = (
  prompt: PromptDefinition,
  rawArgs: Record<string, unknown> | undefined
): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  const provided = rawArgs ?? {};

  for (const arg of prompt.arguments) {
    const value = provided[arg.name];
    if (value === undefined || value === null) {
      if (arg.required) {
        throw new PromptArgumentError(
          `Missing required argument "${arg.name}" for prompt "${prompt.name}"`
        );
      }
      continue;
    }
    if (typeof value !== "string") {
      throw new PromptArgumentError(
        `Argument "${arg.name}" must be provided as a string for prompt "${prompt.name}"`
      );
    }
    if (arg.type === "enum" && arg.enumValues && !arg.enumValues.includes(value)) {
      throw new PromptArgumentError(
        `Argument "${arg.name}" must be one of: ${arg.enumValues.join(", ")}`
      );
    }
    sanitized[arg.name] = value;
  }

  return sanitized;
};

export const renderPromptMessage = (message: PromptMessage, args: Record<string, string>): string => {
  const matcher = createPlaceholderMatcher();
  return message.content.replace(matcher, (_match, key: string) => args[key] ?? "");
};
