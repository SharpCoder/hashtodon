<script lang="ts">
    // fetch('https://hachyderm.io/api/v2/search?q=cats')
    //     .then((resp) => resp.json())
    //     .then((resp) => console.log(resp));

    let vis: HTMLDivElement;
    let btnSearchEl: HTMLButtonElement;
    let instanceEl: HTMLInputElement;
    let hashtagEl: HTMLInputElement;
    let hashtagListEl: HTMLDivElement;
    let errEl: HTMLDivElement;
    let loadingEl: HTMLDivElement;

    $: {
        const defaultInstance = localStorage.getItem('instance');
        const defaultHashtag = localStorage.getItem('hashtag');

        if (instanceEl && defaultInstance) {
            instanceEl.value = defaultInstance;
        }

        if (defaultHashtag && hashtagEl) {
            hashtagEl.value = defaultHashtag;
        }
    }

    import * as d3 from 'd3';
    import { crawlV2 } from './crawlerv2';

    type Datum = { label: string; count: number; rank: number };

    // Scales
    const color = '#040403';
    const margin = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    };

    function redraw(tags: Datum[]) {
        d3.select(vis).html(null);

        const data = [];
        tags.sort((a, b) => b.rank - a.rank);

        for (let i = 0; i < Math.min(15, tags.length); i++) {
            data.push(tags[i]);
        }

        // Sort data by posts
        data.sort((a, b) => b.count - a.count);

        const node = d3.select(vis).node();
        if (node) {
            const width =
                node.getBoundingClientRect().width - margin.left - margin.right;
            const height =
                node.getBoundingClientRect().height -
                margin.top -
                margin.bottom;

            const innerRadius = 90;
            const outerRadius = Math.min(width, height) / 4;

            const xScale = d3
                .scaleBand()
                .range([0, 2 * Math.PI])
                .domain(data.map((d) => d.label));

            const yScale = d3
                .scaleRadial()
                .range([innerRadius, outerRadius])
                .domain([0, Math.max(...data.map((d) => d.count))]);

            const svg = d3
                .select(vis)
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
                .append('g')
                .attr(
                    'transform',
                    `translate(${[
                        width / 2 + margin.left,
                        height / 2 + margin.top,
                    ]})`
                );

            // Add the bars

            svg.append('g')
                .selectAll('path')
                .data(data)
                .enter()
                .append('path')
                .attr('fill', color)
                .attr(
                    'd',
                    d3
                        .arc<Datum>()
                        .innerRadius(innerRadius)
                        .outerRadius(function (d) {
                            return yScale(d.count);
                        })
                        .startAngle(function (d) {
                            return xScale(d.label) ?? 0;
                        })
                        .endAngle(function (d) {
                            return (xScale(d.label) ?? 0) + xScale.bandwidth();
                        })
                        .padAngle(0.1)
                        .padRadius(innerRadius)
                );

            // Add the labels

            svg.append('g')
                .selectAll('g')
                .data(data)
                .enter()
                .append('g')
                .attr('text-anchor', function (d) {
                    return ((xScale(d.label) ?? 0) +
                        xScale.bandwidth() / 2 +
                        Math.PI) %
                        (2 * Math.PI) <
                        Math.PI
                        ? 'end'
                        : 'start';
                })
                .attr('transform', function (d) {
                    const xr = (xScale(d.label) ?? 0) + xScale.bandwidth() / 2;
                    const t = yScale(d.count);
                    return `rotate(${(xr * 180) / Math.PI - 90}) translate(${
                        t + 10
                    }, 0)`;
                })
                .append('text')
                .text(function (d) {
                    return `#${d.label}`;
                })
                .attr('transform', function (d) {
                    return ((xScale(d.label) ?? 0) +
                        xScale.bandwidth() / 2 +
                        Math.PI) %
                        (2 * Math.PI) <
                        Math.PI
                        ? 'rotate(180)'
                        : 'rotate(0)';
                })
                .style('font-size', '1rem')
                .style('fill', '#000')
                .style('font-weight', 'bold')
                .attr('alignment-baseline', 'middle');
        }
    }

    async function doCrawl(instance: string, hashtag: string) {
        const records = await crawlV2(instance, hashtag);
        redraw(records);
        hashtagListEl.innerHTML = '';

        records.sort((a, b) => b.rank - a.rank);
        for (const record of records) {
            const link = document.createElement('a');
            link.href = record.uri;
            link.target = '_blank';
            link.text = `#${record.label} (${record.count})`;
            hashtagListEl.appendChild(link);
        }
    }

    async function btnSearch() {
        errEl.dataset['vis'] = 'false';
        loadingEl.style.display = 'unset';
        btnSearchEl.disabled = true;
        const instance = instanceEl.value;
        const hashtag = hashtagEl.value;

        localStorage.setItem('instance', instance);
        localStorage.setItem('hashtag', hashtag);

        vis.innerHTML = '';
        hashtagListEl.innerHTML = '';
        try {
            await doCrawl(instance, hashtag);
        } catch (ex) {
            errEl.dataset['vis'] = 'true';
        }
        btnSearchEl.disabled = false;
        loadingEl.style.display = 'none';
    }
</script>

<main>
    <h1>Hashtag Discovery</h1>
    <div class="right">
        <div id="input">
            <label for="instance">Instance</label>
            <input
                type="text"
                bind:this={instanceEl}
                name="instance"
                value="hachyderm.io"
            />
            <label for="hashtag">Hashtag</label>
            <input
                type="text"
                bind:this={hashtagEl}
                name="hashtag"
                id="hashtag"
            />
            <button bind:this={btnSearchEl} on:click={btnSearch}
                >Discover Hashtags</button
            >
        </div>
        <div class="loading" bind:this={loadingEl}>Loading...</div>
        <div class="error" bind:this={errEl}>Error fetching content</div>
        <div id="vis" bind:this={vis}></div>
    </div>
    <div id="hashtags" bind:this={hashtagListEl}></div>
</main>

<style>
    h1 {
        padding-top: 20px;
    }

    .loading {
        font-size: 2rem;
        padding-top: 50px;
        font-weight: bold;
        display: none;
    }

    .error {
        display: none;
        font-size: 2rem;
        color: red;
        padding-top: 50px;
    }

    :global(.error[data-vis='true']) {
        display: block !important;
    }

    main {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .right {
        padding-top: 20px;
        flex-direction: column;
        display: flex;
        width: 100%;
        justify-content: center;
        align-items: center;
    }

    #input {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    #input input,
    #input button {
        margin: 10px;
        padding: 5px;
    }

    #hashtags {
        font-size: 1.35rem;
        line-height: 2;
        display: flex;
        flex-direction: column;
        text-align: center;
        height: 100%;
    }

    :global(#hashtags a) {
        color: black;
    }

    #vis {
        margin-top: 20px;
        max-width: 600px;
        width: 100%;
        z-index: 2;
        aspect-ratio: 1;
    }

    @media (max-width: 650px) {
        #input {
            display: flex;
            flex-direction: column;
        }
    }
</style>
