import { Injectable } from '@nestjs/common';
import { 
  ApplicationCategory, 
  Gender, 
  PaymentStatus,
  AssessmentType,
  AssessmentStatus,
  ApplicationStatus,
  ScoreStatus,
  ReferralStatus,
  BlockType,
  RiskLevel,
  NotificationPriority,
  AnnouncementTarget,
  AnnouncementPriority,
  AnnouncementType,
  FaqCategory,
  DeletionStatus,
  Theme,
  ChangeType,
  ChangedByType,
  PricingFeeType,
  PricingTarget,
  SupportTicketStatus,
  SupportTicketPriority,
  DocumentTemplateType,
  TimelineType,
  TimelineCompletionType
} from '@prisma/client';
import { Country, State, City } from 'country-state-city';
import { 
  CURRENCIES, 
  DIETARY_RESTRICTIONS, 
  KNOWLEDGE_SOURCES,
  SHIRT_SIZES
} from './metadata.constants';

@Injectable()
export class MetadataService {
  getCountries() {
    return Country.getAllCountries().map(country => ({
      name: country.name,
      isoCode: country.isoCode,
      phonecode: country.phonecode,
      currency: country.currency,
      flag: country.flag,
      latitude: country.latitude,
      longitude: country.longitude,
    }));
  }

  getStates(countryCode: string) {
    return State.getStatesOfCountry(countryCode);
  }

  getCities(countryCode: string, stateCode?: string) {
    if (!stateCode) {
      return City.getCitiesOfCountry(countryCode);
    }
    return City.getCitiesOfState(countryCode, stateCode);
  }

  getTimezones(search?: string) {
    // Use built-in Internationalization API to get all valid IANA timezones
    const timezones = (Intl as typeof Intl & { supportedValuesOf(key: string): string[] }).supportedValuesOf('timeZone');

    if (search) {
      const lowerSearch = search.toLowerCase();
      return timezones.filter((tz: string) => tz.toLowerCase().includes(lowerSearch));
    }

    return timezones;
  }

  getCurrencies() {
    return CURRENCIES;
  }

  getGenders() {
    return Object.values(Gender);
  }

  getApplicationCategories() {
    return Object.values(ApplicationCategory);
  }

  getShirtSizes() {
    return SHIRT_SIZES;
  }

  getDietaryRestrictions() {
    return DIETARY_RESTRICTIONS;
  }

  getKnowledgeSources() {
    return KNOWLEDGE_SOURCES;
  }

  getPaymentStatuses() {
    return Object.values(PaymentStatus);
  }

  getSystemEnums() {
    return {
      assessmentType: Object.values(AssessmentType),
      assessmentStatus: Object.values(AssessmentStatus),
      gender: Object.values(Gender),
      applicationCategory: Object.values(ApplicationCategory),
      applicationStatus: Object.values(ApplicationStatus),
      scoreStatus: Object.values(ScoreStatus),
      referralStatus: Object.values(ReferralStatus),
      blockType: Object.values(BlockType),
      riskLevel: Object.values(RiskLevel),
      notificationPriority: Object.values(NotificationPriority),
      announcementTarget: Object.values(AnnouncementTarget),
      announcementPriority: Object.values(AnnouncementPriority),
      announcementType: Object.values(AnnouncementType),
      faqCategory: Object.values(FaqCategory),
      deletionStatus: Object.values(DeletionStatus),
      theme: Object.values(Theme),
      changeType: Object.values(ChangeType),
      changedByType: Object.values(ChangedByType),
      pricingFeeType: Object.values(PricingFeeType),
      pricingTarget: Object.values(PricingTarget),
      supportTicketStatus: Object.values(SupportTicketStatus),
      supportTicketPriority: Object.values(SupportTicketPriority),
      documentTemplateType: Object.values(DocumentTemplateType),
      timelineType: Object.values(TimelineType),
      timelineCompletionType: Object.values(TimelineCompletionType),
      paymentStatus: Object.values(PaymentStatus),
    };
  }
}
