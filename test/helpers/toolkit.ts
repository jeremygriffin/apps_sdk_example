import { Store } from "../../src/storage";
import { createMemoryStore } from "../../src/storage/memoryStore";

import { createSilentLogger } from "./logger";

export const TEST_SUBJECT_ID = "subject-test";

export const createTestStore = (): Store => createMemoryStore({ log: createSilentLogger() });

export const createTestContext = (subjectId = TEST_SUBJECT_ID) => ({
  subjectId
});
