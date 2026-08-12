import type { ListViewCommandSetContext } from '@microsoft/sp-listview-extensibility';
import { SPFx, spfi, type SPFI } from '@pnp/sp';
import '@pnp/sp/folders';
import '@pnp/sp/folders/web';
import '@pnp/sp/search';
import type { ISearchResult } from '@pnp/sp/search';
import '@pnp/sp/webs';

import * as strings from 'MovePageToFolderCommandSetStrings';
import type { ISiteOption } from '../types';

export default class SiteSearchService {
  private readonly _context: ListViewCommandSetContext;
  private readonly _sp: SPFI;
  private readonly _currentSite: ISiteOption;

  public constructor(context: ListViewCommandSetContext) {
    this._context = context;
    this._sp = spfi().using(SPFx(context));
    this._currentSite = {
      absoluteUrl: this._normalizeAbsoluteUrl(context.pageContext.web.absoluteUrl),
      isCurrentSite: true,
      serverRelativeUrl: this._normalizeServerRelativeUrl(context.pageContext.web.serverRelativeUrl),
      title: context.pageContext.web.title || strings.ThisSiteLabel
    };
  }

  public getCurrentSite(): ISiteOption {
    return this._currentSite;
  }

  public async searchSites(query: string): Promise<ISiteOption[]> {
    const trimmedQuery = query.trim();
    const results: ISiteOption[] = [this._currentSite];

    if (!trimmedQuery) {
      return results;
    }

    const escapedQuery = escapeSearchValue(trimmedQuery);
    const searchResponse = await this._sp.search({
      Querytext: `(contentclass:STS_Web OR contentclass:STS_Site) AND (Title:"${escapedQuery}*" OR Path:"${escapedQuery}*")`,
      RowLimit: 25,
      SelectProperties: ['Title', 'Path', 'SPWebUrl', 'SiteName'],
      TrimDuplicates: true
    });

    const currentAbsoluteUrl = this._currentSite.absoluteUrl.toLowerCase();
    const seenUrls = new Set<string>([currentAbsoluteUrl]);

    for (const row of searchResponse.PrimarySearchResults) {
      const siteOption = this._mapSearchResult(row);
      if (!siteOption) {
        continue;
      }

      const normalizedAbsoluteUrl = siteOption.absoluteUrl.toLowerCase();
      if (seenUrls.has(normalizedAbsoluteUrl)) {
        continue;
      }

      seenUrls.add(normalizedAbsoluteUrl);
      results.push(siteOption);
    }

    return results;
  }

  public async resolveSitePagesLibraryUrl(webAbsoluteUrl: string): Promise<string> {
    const destSp = spfi(this._normalizeAbsoluteUrl(webAbsoluteUrl)).using(SPFx(this._context));
    const web = await destSp.web.select('ServerRelativeUrl')();
    const libraryServerRelativeUrl = `${this._normalizeServerRelativeUrl(web.ServerRelativeUrl)}/SitePages`;

    try {
      await destSp.web.getFolderByServerRelativePath(libraryServerRelativeUrl).select('Name')();
      return libraryServerRelativeUrl;
    } catch {
      throw new Error(strings.SitePagesLibraryMissingError);
    }
  }

  private _mapSearchResult(row: ISearchResult): ISiteOption | undefined {
    const pathValue = firstNonEmpty(
      asString(row.SPWebUrl),
      asString(row.Path),
      asString((row as ISearchResult & { SiteName?: string }).SiteName)
    );

    if (!pathValue) {
      return undefined;
    }

    const absoluteUrl = this._normalizeAbsoluteUrl(pathValue);
    if (!absoluteUrl.toLowerCase().startsWith('http')) {
      return undefined;
    }

    let serverRelativeUrl = '/';
    try {
      serverRelativeUrl = this._normalizeServerRelativeUrl(new URL(absoluteUrl).pathname);
    } catch {
      return undefined;
    }

    const title = firstNonEmpty(asString(row.Title), serverRelativeUrl) ?? absoluteUrl;

    return {
      absoluteUrl,
      isCurrentSite: absoluteUrl.toLowerCase() === this._currentSite.absoluteUrl.toLowerCase(),
      serverRelativeUrl,
      title
    };
  }

  private _normalizeAbsoluteUrl(absoluteUrl: string): string {
    return absoluteUrl.trim().replace(/\/+$/, '');
  }

  private _normalizeServerRelativeUrl(serverRelativeUrl: string): string {
    const trimmedValue = serverRelativeUrl.trim();

    if (!trimmedValue) {
      return '/';
    }

    const withLeadingSlash = trimmedValue.startsWith('/')
      ? trimmedValue
      : `/${trimmedValue}`;
    const normalizedValue = withLeadingSlash.replace(/\/+$/, '');

    return normalizedValue || '/';
  }
}

function escapeSearchValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value) {
      return value;
    }
  }

  return undefined;
}
