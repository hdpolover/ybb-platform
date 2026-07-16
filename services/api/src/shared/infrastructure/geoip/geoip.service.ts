import { Injectable } from '@nestjs/common';
import * as geoip from 'geoip-lite';

export interface GeoLocation {
  country: string;
  city: string;
  timezone?: string;
  ll?: [number, number]; // Latitude, Longitude
}

@Injectable()
export class GeoIpService {
  /**
   * Lookup location data for an IP address.
   * Returns generic fallback if IP is invalid or private (localhost, 192.168.x.x, etc).
   */
  lookup(ip: string): GeoLocation {
    // Handle localhost and private IPs gracefully
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return {
        country: 'XX',
        city: 'Local/Private',
      };
    }

    const geo = geoip.lookup(ip);
    
    if (!geo) {
        return {
            country: 'XX',
            city: 'Unknown',
        };
    }

    return {
      country: geo.country || 'XX',
      city: geo.city || 'Unknown',
      timezone: geo.timezone,
      ll: geo.ll,
    };
  }
}
