export class MarkDocumentViewedCommand {
  constructor(
    public readonly userId: string,
    public readonly documentId: string,
  ) {}
}
