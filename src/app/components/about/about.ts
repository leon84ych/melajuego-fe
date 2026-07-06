import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import creditsData from '../../data/credits.json';
import { CreditEntry } from '../../data/DataInterfaces';

type SocialNetworkKey = 'github' | 'instagram' | 'tik-tok' | 'twitter';



@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.html',
  styleUrls: ['./about.css'],
})
export class About {
  activeTab: 'general' | 'technical' = 'general';
  readonly credits = creditsData as CreditEntry[];
  readonly socialNetworks = ['github', 'instagram', 'tik-tok', 'twitter'];

  setTab(tab: 'general' | 'technical'): void {
    this.activeTab = tab;
  }

  isTabActive(tab: 'general' | 'technical'): boolean {
    return this.activeTab === tab;
  }

  getSocialUrl(network: string, handle: string) {
    switch (network) {
      case 'github':
        return `https://github.com/${handle}`;
      case 'instagram':
        return `https://www.instagram.com/${handle}`;
      case 'tik-tok':
        return `https://www.tiktok.com/@${handle}`;
      case 'twitter':
        return `https://x.com/${handle}`;
      default:
        return '#';
    }
  }

  getIconSrc(network: string) {
    switch (network) {
      case 'instagram':
        return '/images/icons/instagram.jpeg';
      case 'tik-tok':
        return '/images/icons/tiktok.jpeg';
      case 'twitter':
        return '/images/icons/x.png';
      default:
        return null;
    }
  }
}
