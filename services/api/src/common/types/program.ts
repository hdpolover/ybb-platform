// Shared TypeScript types for Program entities

export enum ProgramStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum ProgramType {
  CONFERENCE = 'conference',
  COMPETITION = 'competition',
  WORKSHOP = 'workshop',
  BOOTCAMP = 'bootcamp',
}

export interface Program {
  id: string;
  title: string;
  description: string;
  type: ProgramType;
  status: ProgramStatus;
  startDate: Date;
  endDate: Date;
  applicationDeadline: Date;
  location: string;
  capacity: number;
  registeredCount: number;
  fee: number;
  currency: string;
  coverImage?: string;
  requirements?: string[];
  benefits?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProgramDto {
  title: string;
  description: string;
  type: ProgramType;
  startDate: Date;
  endDate: Date;
  applicationDeadline: Date;
  location: string;
  capacity: number;
  fee: number;
  currency: string;
  coverImage?: string;
  requirements?: string[];
  benefits?: string[];
}

export interface UpdateProgramDto {
  title?: string;
  description?: string;
  status?: ProgramStatus;
  startDate?: Date;
  endDate?: Date;
  applicationDeadline?: Date;
  location?: string;
  capacity?: number;
  fee?: number;
  coverImage?: string;
  requirements?: string[];
  benefits?: string[];
}

export interface ProgramStats {
  totalApplications: number;
  acceptedApplications: number;
  rejectedApplications: number;
  pendingApplications: number;
  totalRevenue: number;
}
