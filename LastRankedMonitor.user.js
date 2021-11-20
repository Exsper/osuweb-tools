// ==UserScript==
// @name         Osu Last Ranked Maps Monitor
// @namespace    https://github.com/Exsper/
// @supportURL   https://github.com/Exsper/osuweb-tools/issues
// @version      0.0.1
// @description  监控新ranked谱面
// @author       Exsper
// @match        https://osu.ppy.sh/beatmapsets
// @grant        none
// @run-at       document-end
// ==/UserScript==

const $ = window.$ || {};

class DataStorage {
    static setValue(item, value) {
        window.localStorage["lrm-" + item] = value;
    }

    static getValue(item) {
        item = "lrm-" + item;
        return (item in window.localStorage) ? window.localStorage[item] : null;
    }
}

class Beatmap {
    constructor(data) {
        // 暂时只需要用到谱面的模式
        this.mode_int = data.mode_int;
    }
}

class BeatmapSet {
    constructor(data) {
        this.artist = data.artist;
        this.artist_unicode = data.artist_unicode;
        this.beatmapSetId = data.id;
        this.title = data.title;
        this.title_unicode = data.title_unicode;
        this.creator = data.creator;
        this.ranked_date = new Date(data.ranked_date);
        this.beatmaps = data.beatmaps.map((beatmapData) => new Beatmap(beatmapData));
    }

    getUrl() {
        return "https://osu.ppy.sh/beatmapsets/" + this.beatmapSetId;
    }

    getDownloadUrl() {
        return `https://osu.ppy.sh/beatmapsets/${this.beatmapSetId}/download`;
    }

    getMapCount() {
        let counts = [0, 0, 0, 0];
        this.beatmaps.map((beatmap) => {
            counts[beatmap.mode_int] += 1;
        });
        return counts;
    }

    getTitle(isUnicode = true) {
        if (isUnicode) return this.artist_unicode + " - " + this.title_unicode + " // " + this.creator;
        else return this.artist + " - " + this.title + " // " + this.creator;
    }
}

class RankedMonitor {
    constructor(mode = -1) {
        this.BASEURL = "https://osu.ppy.sh/beatmapsets/search";
        this.searchUrl = (mode < 0) ? this.BASEURL : this.BASEURL + "?m=" + mode;
        this.LastRankedId = 0;
    }

    async apiCall() {
        const data = await fetch(this.searchUrl, {
            method: "GET",
            headers: { "Content-Type": "application/octet-stream" },
            credentials: "include",
            timeout: 10000,
        }).then(res => res.json());
        if (!data || !data.beatmapsets) throw "Fetch Error";
        const dataString = JSON.stringify(data);
        if (dataString === "[]" || dataString === "{}") throw "Server Error";
        return data.beatmapsets.map((beatmapsetData) => new BeatmapSet(beatmapsetData));
    }

    async firstRun() {
        let bs = await this.apiCall();
        if (bs.length > 0) this.LastRankedId = bs[0].beatmapSetId;
    }

    async getNewBeatmapSets() {
        const MAXNEWCOUNT = 20;
        let bs = await this.apiCall();
        let newRankedBeatmaps = [];
        if (bs.length <= 0) return newRankedBeatmaps;
        for (let i = 0; i < MAXNEWCOUNT; i++) {
            if (bs[i].beatmapSetId === this.LastRankedId) break;
            newRankedBeatmaps.push(bs[i]);
        }
        return newRankedBeatmaps;
    }

    async getTrs() {
        let newbs = await this.getNewBeatmapSets();
        let trs = newbs.map((newbs) => {
            let $tr = $("<tr>");
            let $td = $("<td>", { style: "width:50%" }).appendTo($tr);
            let $title = $("<span>", { text: newbs.getTitle() }).appendTo($td);
            $title.attr("href", newbs.getUrl());
            $td = $("<td>", { style: "width:20%" }).appendTo($tr);
            let modes = newbs.getMapCount();
            if (modes[0] > 0) $('<i class="fal fa-extra-mode-osu"></i>').appendTo($td);
            if (modes[1] > 0) $('<i class="fal fa-extra-mode-taiko"></i>').appendTo($td);
            if (modes[2] > 0) $('<i class="fal fa-extra-mode-fruits"></i>').appendTo($td);
            if (modes[3] > 0) $('<i class="fal fa-extra-mode-mania"></i>').appendTo($td);
            $td = $("<td>", { style: "width:30%" }).appendTo($tr);
            $("<span>", { text: newbs.ranked_date.toLocaleTimeString() }).appendTo($td);
            return $tr;
        });
        return trs;
    }
}

class Script {
    constructor(mode = -1, interval = 60 * 1000) {
        this.rankedMonitor = new RankedMonitor(mode);
        this.interval = interval;
    }

    async init() {
        let $mainDiv = $("<div>", { id: "lrm-div", style: "top: 20%;right: 2%;position: absolute;width: 400px;" });
        let $searchLabel = $("<span>", { id: "lrm-stat", text: "状态" }).appendTo($mainDiv);
        $("<br>").appendTo($mainDiv);
        let $mainTable = $("<table>", { id: "lrm-table", style: "float:right;" }).appendTo($mainDiv);
        let $tr = $("<tr>", { style: "width:100%" }).appendTo($mainTable);
        let $td = $("<td>", { style: "width:50%;padding:0 10px" }).appendTo($tr);
        $("<span>", { text: "谱面" }).appendTo($td);
        $td = $("<td>", { style: "width:20%;padding:0 10px" }).appendTo($tr);
        $("<span>", { text: "模式" }).appendTo($td);
        $td = $("<td>", { style: "width:30%;padding:0 10px" }).appendTo($tr);
        $("<span>", { text: "时间" }).appendTo($td);
        $mainDiv.appendTo($("body"))
        await this.rankedMonitor.firstRun();
        $("#lrm-stat").text("下一次刷新： " + new Date(Date.now() + this.interval).toLocaleTimeString());
        setInterval(async () => {
            let $trs = await this.rankedMonitor.getTrs();
            $('#lrm-table tr:eq(0)').after(...$trs);
            $("#lrm-stat").text("下一次刷新： " + new Date(Date.now() + this.interval).toLocaleTimeString());
        }, this.interval);
    }
}

$(document).ready(() => {
    let script = new Script();
    script.init();
});
