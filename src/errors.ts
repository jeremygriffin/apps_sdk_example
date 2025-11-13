export class TodoNotFoundError extends Error {
  constructor(
    public readonly subjectId: string,
    public readonly todoId: string
  ) {
    super(`Todo ${todoId} not found for subject ${subjectId}`);
    this.name = "TodoNotFoundError";
  }
}
