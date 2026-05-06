import { ApiProperty } from '@nestjs/swagger';

export class ProgramDashboardKpiDto {
  @ApiProperty({ example: 688 })
  registeredUsers: number;

  @ApiProperty({ example: 166 })
  registrationsToday: number;

  @ApiProperty({ example: 420 })
  formsStarted: number;

  @ApiProperty({ example: 275 })
  submittedApplications: number;

  @ApiProperty({ example: 268 })
  registeredOnly: number;

  @ApiProperty({ example: 59 })
  totalAmbassadors: number;

  @ApiProperty({ example: 42 })
  activeAmbassadors: number;

  @ApiProperty({ example: 0 })
  referredParticipants: number;

  @ApiProperty({ example: 0 })
  referredParticipantsPercent: number;

  @ApiProperty({ example: 'active' })
  programStatus: string;

  @ApiProperty({ example: '2026-05-11T00:00:00.000Z', nullable: true })
  programStatusDate: string | null;
}

export class DashboardTrendPointDto {
  @ApiProperty({ example: '1 Nov' })
  label: string;

  @ApiProperty({ example: 42 })
  registrations: number;
}

export class DashboardGenderDatumDto {
  @ApiProperty({ example: 'Male' })
  name: string;

  @ApiProperty({ example: 320 })
  value: number;
}

export class DashboardAgeDatumDto {
  @ApiProperty({ example: '17-20' })
  range: string;

  @ApiProperty({ example: 180 })
  count: number;
}

export class DashboardNationalityDatumDto {
  @ApiProperty({ example: 'Indonesia' })
  country: string;

  @ApiProperty({ example: 420 })
  count: number;
}

export class DashboardAmbassadorDatumDto {
  @ApiProperty({ example: 'Alya Putri' })
  name: string;

  @ApiProperty({ example: 'Indonesia' })
  country: string;

  @ApiProperty({ example: 48 })
  referrals: number;
}

export class ProgramDashboardTrendDto {
  @ApiProperty({ type: [DashboardTrendPointDto] })
  daily: DashboardTrendPointDto[];

  @ApiProperty({ type: [DashboardTrendPointDto] })
  weekly: DashboardTrendPointDto[];

  @ApiProperty({ type: [DashboardTrendPointDto] })
  monthly: DashboardTrendPointDto[];
}

export class ProgramDashboardResponseDto {
  @ApiProperty({ type: ProgramDashboardKpiDto })
  kpis: ProgramDashboardKpiDto;

  @ApiProperty({ type: ProgramDashboardTrendDto })
  trend: ProgramDashboardTrendDto;

  @ApiProperty({ type: [DashboardGenderDatumDto] })
  gender: DashboardGenderDatumDto[];

  @ApiProperty({ type: [DashboardAgeDatumDto] })
  age: DashboardAgeDatumDto[];

  @ApiProperty({ type: [DashboardNationalityDatumDto] })
  nationalities: DashboardNationalityDatumDto[];

  @ApiProperty({ type: [DashboardAmbassadorDatumDto] })
  topAmbassadors: DashboardAmbassadorDatumDto[];
}
