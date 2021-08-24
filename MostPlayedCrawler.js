// ==UserScript==
// @name         Osu Most Played Crawler
// @namespace    https://github.com/Exsper/osuweb-tools
// @version      0.1.1
// @description  查找玩得最多的谱面
// @author       Exsper
// @match        https://osu.ppy.sh/users/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

const $ = window.$ || {};

class PlayedBeatmapInfo {
    constructor(data) {
        this.beatmap = data.beatmap;
        this.beatmap_id = data.beatmap_id;
        this.beatmapset = data.beatmapset;
        this.count = data.count;
    }

    getTitles() {
        let title = this.beatmapset.title;
        let uni_title = this.beatmapset.title_unicode;
        return [title, uni_title];
    }

    getBid() {
        return this.beatmap_id;
    }

    getSid() {
        return this.beatmapset.id;
    }

    getArtists() {
        let artist = this.beatmapset.artist;
        let uni_artist = this.beatmapset.artist_unicode;
        return [artist, uni_artist];
    }

    getFullTitle() {
        return this.beatmapset.artist_unicode + " - " + this.beatmapset.title_unicode + "(" + this.beatmapset.creator + ")[" + this.beatmap.version + "]";
    }

    getSimpleTitle() {
        return this.beatmapset.title_unicode + " [" + this.beatmap.version + "] ";
    }

    getCreator() {
        return this.beatmapset.creator;
    }

    getPlayCount() {
        return this.count;
    }

    title2String() {
        return "(" + this.getBid() + ")" + this.getFullTitle();
    }

    playCount2String() {
        return "玩了" + this.getPlayCount() + "次"
    }

    getCover() {
        return `https://assets.ppy.sh/beatmaps/${this.getSid()}/covers/list.jpg`;
    }

    getUrl() {
        return `https://osu.ppy.sh/beatmaps/${this.getBid()}`
    }
}

class BeatmapPlaycountDiv {
    constructor($div, mode) {
        this.$table = $div;
        this.mode = mode;
    }

    /**
     * @param {PlayedBeatmapInfo} pbi 
     */
    playcountDiv(pbi) {
        let coverurl = pbi.getCover();
        let href = pbi.getUrl() + "?mode=" + this.mode;
        let $mainDiv = $("<div>", { class: "beatmap-playcount" });
        let $cover = $("<a>", { href: href, class: "beatmap-playcount__cover", style: "background-image: url(" + coverurl + ")" }).appendTo($mainDiv);
        $(`<div class="beatmap-playcount__cover-count"><div title="游玩次数" class="beatmap-playcount__count"><span class="beatmap-playcount__count-icon"><span class="fas fa-play"></span></span>${pbi.getPlayCount()}</div></div>`).appendTo($cover);
        $(`<div class="beatmap-playcount__detail"><div class="beatmap-playcount__info"><div class="beatmap-playcount__info-row u-ellipsis-overflow"><a class="beatmap-playcount__title" href="${href}">${pbi.getSimpleTitle()}<span class="beatmap-playcount__title-artist">by ${pbi.beatmapset.artist_unicode}</span></a></div><div class="beatmap-playcount__info-row u-ellipsis-overflow"><span class="beatmap-playcount__artist">by <strong>${pbi.beatmapset.artist_unicode}</strong></span> <span class="beatmap-playcount__mapper">谱师：<a class="js-usercard beatmap-playcount__mapper-link" data-user-id="${pbi.beatmapset.user_id}" href="https://osu.ppy.sh/users/${pbi.beatmapset.user_id}">${pbi.getCreator()}</a></span></div></div><div class="beatmap-playcount__detail-count"><div title="游玩次数" class="beatmap-playcount__count"><span class="beatmap-playcount__count-icon"><span class="fas fa-play"></span></span>${pbi.getPlayCount()}</div></div></div>`).appendTo($mainDiv);
        return $mainDiv;
    }

    clean() {
        this.$table.empty();
    }

    update(playedBeatmapInfos) {
        this.clean();
        let totalCount = 0;
        playedBeatmapInfos.map((pbi) => {
            let pc = pbi.getPlayCount();
            totalCount += pc;
            this.playcountDiv(pbi).appendTo(this.$table);
        });
        $("<p>", { text: "共计游玩 " + totalCount + " 次", style: "text-align: right;" }).appendTo(this.$table);
    }

}

class MostPlayedCrawler {
    constructor(href) {
        this.baseUrl = href + `/beatmapsets/most_played`;
        this.records = [];
        this.recordCount = 0;
        this.FIRSTCRAWLPAGECOUNT = 10;
        this.ITEMSPERPAGE = 100;
        this.offset = 0;
        this.alPageCount = 0;
        this.finished = false;
    }

    async apiCall(url) {
        const data = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/octet-stream" },
            credentials: "include",
            timeout: 10000,
        }).then(res => res.json());
        if (!data) throw "Fetch Error";
        const dataString = JSON.stringify(data);
        if (dataString === "[]" || dataString === "{}") return [];
        return data;
    }

    /**
     * @returns {Array<PlayedBeatmapInfo>}
     */
    async getUserRecent(offset, limit) {
        // offset 从0开始，应该没有上限
        // limit 最大100
        let url = this.baseUrl + "?offset=" + offset + "&limit=" + limit;
        const resp = await this.apiCall(url);
        return resp.map((info) => {
            return new PlayedBeatmapInfo(info);
        });
    }

    /**
     * @param {number} pageCount 
     * @returns {boolean} isEnd
     */
    async crawl(pageCount = 1) {
        if (this.finished) return true;
        for (let page = 0; page < pageCount; page++) {
            try {
                $("#mpc-crawllabel").text("正在获取第 " + (this.alPageCount + 1) + " 页");
                let playedBeatmapInfos = await this.getUserRecent(this.offset, this.ITEMSPERPAGE);
                this.records.push(...playedBeatmapInfos);
                this.offset += this.ITEMSPERPAGE;
                this.alPageCount += 1;
                this.recordCount += playedBeatmapInfos.length;
                if (playedBeatmapInfos.length < this.ITEMSPERPAGE || playedBeatmapInfos.length === 0) {
                    this.finished = true;
                    $("#mpc-crawllabel").text("全部 " + this.recordCount + " 张谱面获取完毕");
                    return true;
                }
            }
            catch (ex) {
                $("#mpc-crawllabel").text("获取出错");
                console.log(ex);
                this.recordCount = this.records.length;
                this.offset = this.records.length;
                return false;
            }
        }
        $("#mpc-crawllabel").text("已获取 " + this.alPageCount + " 页");
        return false;
    }

    /**
     * @param {Array<string>} titles 
     * @param {string} keyword 
     */
    IsContainKeyword(titles, keyword) {
        let kw = keyword.toLowerCase();
        return titles.some((title) => {
            return (title.toLowerCase().indexOf(kw) >= 0)
        })
    }

    searchByBid(bid) {
        let searchResults = [];
        for (let pbi of this.records) {
            if (bid === pbi.getBid()) searchResults.push(pbi);
        }
        return searchResults;
    }

    searchByKeyword(keyword) {
        let searchResults = [];
        for (let pbi of this.records) {
            if (this.IsContainKeyword(pbi.getTitles(), keyword) || this.IsContainKeyword(pbi.getArtists(), keyword) || this.IsContainKeyword([pbi.getCreator()], keyword)) searchResults.push(pbi);
        }
        return searchResults;
    }

}

class Script {
    constructor(href) {
        this.crawler = new MostPlayedCrawler(href);
        this.bpcd;
        this.lastPressTime = new Date();
        this.WAITTIME = 1000;
    }

    init() {
        let selectMode = $(".game-mode-link.game-mode-link--active").text();
        let mode = "osu";
        if (selectMode.indexOf("taiko") > 0) mode = "taiko";
        if (selectMode.indexOf("catch") > 0) mode = "fruits";
        if (selectMode.indexOf("mania") > 0) mode = "mania";

        let $historicalDiv = $("div[data-page-id=historical]");
        let $mostplayedTitle = $(".title.title--page-extra-small:eq(1)", $historicalDiv);
        let $scriptDiv = $("<div>", { id: "mpc-div" });
        let $scriptTable = $("<table>", { id: "mpc-table", style: "width:100%" }).appendTo($scriptDiv);
        let $tr = $("<tr>", { style: "width:100%" }).appendTo($scriptTable);
        let $td = $("<td>", { style: "width:70%;padding:0 10px" }).appendTo($tr);
        let $searchLabel = $("<span>", { text: "搜索：" }).appendTo($td);
        let $searchTextbox = $("<input>", { type: "text", id: "mpc-search", style: "width:80%;max-width:unset;", class: "account-edit-entry__input" }).appendTo($td);
        $searchTextbox.bind('input propertychange', () => {
            this.lastPressTime = new Date();
            $("#mpc-statlabel").text("搜索中...");
            setTimeout(() => {
                if ((new Date() - this.lastPressTime) >= (this.WAITTIME * 0.99)) {
                    this.search();
                }
            }, this.WAITTIME);
        });

        $td = $("<td>", { style: "width:30%;padding:0 10px" }).appendTo($tr);
        let $crawlPagesLabel = $("<span>", { id: "mpc-crawlpageslabel", text: "每次获取页数：" }).appendTo($td);
        let $crawlPagesTextbox = $("<input>", { type: "text", id: "mpc-searchpage", val: "10", class: "account-edit-entry__input" ,style: "width:30px;"}).appendTo($td);
        let $crawlButton = $('<button>', { text: "开始获取", id: "mpc-crawlbtn", class: "btn-osu-big" }).appendTo($td);
        $crawlButton.click(async () => {
            $crawlButton.attr("disabled", true);
            $crawlButton.text("正在获取");
            let result = await this.crawler.crawl(parseInt($("#mpc-searchpage").val()));
            if (!result) {
                $crawlButton.attr("disabled", false);
                $crawlButton.text("继续获取");
            }
            $("#mpc-statlabel").text("已获取 " + this.crawler.recordCount + " 张谱面");
            this.search();
        });
        $tr = $("<tr>", { style: "width:100%" }).appendTo($scriptTable);
        $td = $("<td>", { style: "width:10%" }).appendTo($tr);
        let $statLabel = $("<p>", { id: "mpc-statlabel", text: "已获取 0 张谱面" }).appendTo($td);
        $td = $("<td>", { style: "width:10%" }).appendTo($tr);
        let $crawlLabel = $("<p>", { id: "mpc-crawllabel", text: "点击右侧按钮开始获取" }).appendTo($td);

        let $resultDiv = $("<div>", { id: "mpc-resultDiv" }).appendTo($scriptDiv);
        this.bpcd = new BeatmapPlaycountDiv($resultDiv, mode);

        $mostplayedTitle.after($scriptDiv);
    }

    /**
       * 判断字符串是否为正整数
       * @param {String} s
       * @returns {Boolean} 是正整数
       */
    checkInt(s) {
        var re = /^\d+$/;
        return (re.test(s));
    }

    search() {
        let keyword = $("#mpc-search").val();
        if (keyword === "") {
            $("#mpc-statlabel").text("请输入关键词");
            return;
        }
        if (this.checkInt(keyword)) {
            let bid = parseInt(keyword);
            let playedBeatmapInfos = this.crawler.searchByBid(bid);
            if (playedBeatmapInfos.length <= 0) $("#mpc-statlabel").text("翻遍了" + this.crawler.recordCount + "个记录也没有找到这个bid是" + keyword + "的谱面");
            else {
                $("#mpc-statlabel").text("从 " + this.crawler.recordCount + " 张谱面中找到了 " + playedBeatmapInfos.length + " 个符合条件的谱面");
                this.bpcd.update(playedBeatmapInfos);
            }
        }
        else {
            let playedBeatmapInfos = this.crawler.searchByKeyword(keyword);
            if (playedBeatmapInfos.length <= 0) $("#mpc-statlabel").text("翻遍了" + this.crawler.recordCount + "个记录也没有找到关键词叫" + keyword + "的谱面");
            else {
                $("#mpc-statlabel").text("从 " + this.crawler.recordCount + " 张谱面中找到了 " + playedBeatmapInfos.length + " 个符合条件的谱面");
                this.bpcd.update(playedBeatmapInfos);
            }
        }
    }

}

function startScrpit() {
    let urlex = /users\/\d+/.exec(location.href);
    if (urlex) {
        let surl = location.origin + "/" + urlex[0];
        let script = new Script(surl);
        script.init();
    }

}

// 确保网页加载完成
function check() {
    let $script = $("#mpc-div");
    let $historicalDiv = $("div[data-page-id=historical]");
    if ($script.length <= 0) {
        if ($historicalDiv.length > 0) startScrpit();
        else setTimeout(function () { check(); }, 2000);
    }

}

$(document).ready(() => {
    check();
    // 防多次运行
    // if (window.self === window.top) startScrpit();
});
