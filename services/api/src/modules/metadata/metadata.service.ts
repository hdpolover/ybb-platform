import { Injectable } from '@nestjs/common';
import { ApplicationCategory, Gender, PaymentStatus } from '@prisma/client';
import { Country, State, City } from 'country-state-city';
import { 
  CURRENCIES, 
  DIETARY_RESTRICTIONS, 
  KNOWLEDGE_SOURCES,
  SHIRT_SIZES, 
  TIMEZONES 
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

  getTimezones() {
    return TIMEZONES;
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
}
