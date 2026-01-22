export class ReviewDeletionRequestCommand {
  constructor(
    public readonly requestId: string,
    public readonly adminId: string,
    public readonly action: 'approve' | 'reject',
    public readonly notes?: string,
  ) {}
}
