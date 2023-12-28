export type TimelineEntry = {
    tags: {
        name: string;
        url: string;
    }[]
}

export type TagEntry = {
    name: string;
    url: string;
    history: {
        uses: string;
    }[];
}

export type CrawlDatum = {
    label: string;
    count: number;
    uri: string;
    rank: number;
};

export type CrawlResult = CrawlDatum[];

function sanitizeInstance(instance: string) {
    instance = instance.replace('https://', '');
    instance = instance.replace('http://', '');
    if (instance.includes('/')) {
        instance = instance.substring(0, instance.indexOf('/'));
    }
    return instance;
}


function dedupe(arr: string[]) {
    const obj: Record<string, boolean> = {};
    for (const el of arr) {
        obj[el] = true;
    }
    return Object.keys(obj);
}

export async function crawlV2(instance: string, hashtag: string): Promise<CrawlDatum[]> {
    // Fetch the initial timeline
    const timeline = await fetchTimeline(instance, hashtag);
    
    const multipliers: Record<string,number> = {};
    for (const tl of timeline) {
        for (const tag of tl.tags) {
            multipliers[tag.name] = multipliers[tag.name] ?? 0;
            multipliers[tag.name]++; 
        }
    }

    // Extract categirues
    const hashtags = dedupe(timeline.flatMap(tl => tl.tags).map(tag => tag.name));

    // For each hashtag, accumulate the datums
    const datums: CrawlDatum[] = [];
    const promises = [];

    for (const tag of hashtags) {
        promises.push(fetchCounts(instance, tag));
    }

    await Promise.all(promises)
        .then(d => {
            for (const datum of d) {    
                datum.rank = multipliers[datum.label] ?? 1;
                datums.push(datum);
            }
        });

    return datums;
}

async function fetchTimeline(instance: string, hashtag: string): Promise<TimelineEntry[]> {
    return await fetch(`https://${sanitizeInstance(instance)}/api/v1/timelines/tag/${hashtag}`)
        .then(resp => resp.json()) as TimelineEntry[];
}

async function fetchCounts(instance: string, hashtag: string): Promise<CrawlDatum> {
    const candidate = localStorage.getItem(k(instance, hashtag));
    if (candidate) {
        return JSON.parse(candidate);
    }

    const { history, url, name } = await fetch(`https://${sanitizeInstance(instance)}/api/v1/tags/${hashtag}`)
        .then(resp => resp.json()) as TagEntry;

    const counts = history.map(history => parseInt(history.uses)).reduce((acc, cur) => acc + cur, 0);
    const ret = {
        label: name,
        uri: url,
        count: counts,
        rank: 1,
    }

    localStorage.setItem(k(instance, hashtag), JSON.stringify(ret));
    return ret;
}

function k(instance: string, hashtag: string) {
    return `${instance}_${hashtag}`;
}