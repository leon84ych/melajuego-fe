import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardData } from '../data/DataInterfaces';

type ProfileSheet = 'one' | 'two';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly apiUrl =
    'https://script.google.com/macros/s/AKfycbzLEKRILH3gzEX3N9U7rvN-I94HGv6IXUNC8UWrKo4uMy3B-66hPbr1ZzOwklK36WFj/exec';
  private readonly cache = new Map<ProfileSheet, CardData[]>();

  constructor(private readonly http: HttpClient) {}

  async getProfiles(sheet: ProfileSheet = 'one', options?: { forceRefresh?: boolean }): Promise<CardData[]> {
    const forceRefresh = options?.forceRefresh === true;

    if (!forceRefresh) {
      if (this.cache.has(sheet)) {
        return this.cache.get(sheet)!;
      }

      const storageKey = this.getStorageKey(sheet);
      const localValue = this.loadFromLocalStorage(storageKey);
      if (localValue) {
        this.cache.set(sheet, localValue);
        return localValue;
      }
    }

    const profiles = await this.fetchProfiles(sheet);
    if (profiles.length > 0) {
      const storageKey = this.getStorageKey(sheet);
      this.saveToLocalStorage(storageKey, profiles);
      this.cache.set(sheet, profiles);
    }
    return profiles;
  }

  async getCombinedProfiles(options?: { forceRefresh?: boolean }): Promise<CardData[]> {
    const [one, two] = await Promise.all([
      this.getProfiles('one', options),
      this.getProfiles('two', options),
    ]);
    return [...one, ...two];
  }

  private getStorageKey(sheet: ProfileSheet): string {
    return sheet === 'two' ? 'ProfilesTwo' : 'ProfilesOne';
  }

  private loadFromLocalStorage(storageKey: string): CardData[] | null {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return null;
      }
      return parsed.map((item) => this.normalizeProfile(item));
    } catch {
      return null;
    }
  }

  private saveToLocalStorage(storageKey: string, profiles: CardData[]): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(profiles));
    } catch {
      // Ignore storage failures; the current request is still valid.
    }
  }

  private async fetchProfiles(sheet: ProfileSheet): Promise<CardData[]> {
    const url = `${this.apiUrl}?sheet=${encodeURIComponent(sheet)}`;
    try {
      const response = await firstValueFrom(this.http.get<unknown>(url));
      const rawProfiles = Array.isArray(response)
      ? (response as unknown[])
      : response && typeof response === 'object' && 'data' in response && Array.isArray((response as any).data)
      ? ((response as any).data as unknown[])
      : [];

      return rawProfiles.map((item: unknown) => this.normalizeProfile(item));
    } catch (error) {
      console.warn('[ProfileService] Failed to load profiles from API:', error);
      return [];
    }
  }

  private normalizeProfile(raw: any): CardData {
    const tags = Array.isArray(raw.tags)
      ? (raw.tags as unknown[]).map((tag: unknown) => String(tag).trim()).filter(Boolean)
      : typeof raw.tags === 'string'
      ? raw.tags.split(',').map((tag: string) => String(tag).trim()).filter(Boolean)
      : [];

    const imageUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl : typeof raw.image === 'string' ? raw.image : '';

    return {
      id: raw.id ?? raw.ID ?? raw.Id ?? '',
      title: String(raw.title ?? raw.name ?? ''),
      subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
      imageUrl,
      description: raw.description ? String(raw.description) : undefined,
      tags,
    };
  }
}
