/**
 * Withdraw Application Command
 * 
 * Application Layer - Command
 */
export class WithdrawApplicationCommand {
  constructor(
    public readonly applicationId: string,
    public readonly userId: string,
  ) {}
}
