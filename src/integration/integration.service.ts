import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { getFollowerCount } from 'follower-count';

@Injectable()
export class IntegraionService {
  constructor(private readonly httpService: HttpService){}
  public async getTwitterFollowersCount(link: string): Promise<any> {
    if (link) {
      const username = link.substring(link.lastIndexOf(`/`) + 1, link.length);
      const countByApi = await getFollowerCount({
        type: 'twitter',
        username: username
      });

      return countByApi;
    }
    return null;
  }

  public async getDiscordInfo(link: string): Promise<any> {
    if (link) {
      const code = link.substring(link.lastIndexOf(`/`) + 1, link.length);
      const response = await this.httpService.get(`https://discord.com/api/v9/invites/${code}?with_counts=true&with_expiration=true`).toPromise();

      return {
        name: response.data.guild.name,
        approximateMemberCount: response.data.approximate_member_count,
        premiumSubscriptionCount: response.data.guild.premium_subscription_count
      };
    }
    return null;
  }
}