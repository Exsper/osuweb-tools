// ==UserScript==
// @name         Osu Ranking Summary
// @namespace    https://github.com/Exsper/
// @supportURL   https://github.com/Exsper/osuweb-tools/issues
// @version      1.0.0.1
// @description  Top国家统计，如右侧不出现按钮请刷新网页
// @author       Exsper
// @match        https://osu.ppy.sh/rankings/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

class Player {
    constructor(name, country, active, flag, rank) {
        this.name = name;
        this.country = country;
        this.active = active;
        this.flag = flag;
        this.rank = rank;
    }
}

class CountryList {
    constructor(country, flag) {
        this.country = country;
        this.flag = flag;
        this.count = 0;
        /** @type {Array<Player>} */
        this.list = [];
    }

    /**
     * @param {Player} player 
     */
    add(player) {
        this.count += 1;
        this.list.push(player);
    }
}

class List {
    constructor() {
        /** @type {Array<CountryList>} */
        this.countryList = [];
    }

    /**
     * @param {Player} player 
     */
    add(player) {
        let clI = this.countryList.findIndex((cl) => cl.country == player.country);
        if (clI < 0) {
            let ncl = new CountryList(player.country, player.flag);
            ncl.add(player);
            this.countryList.push(ncl);
        }
        else {
            this.countryList[clI].add(player);
        }
    }

    sort() {
        this.countryList.sort((a, b) => b.count - a.count);
    }
}

class Crawler {
    constructor() {
        this.list = new List();
        this.baseUrl = location.origin + location.pathname;
        let searchParams = new URLSearchParams(location.search);
        this.keys = searchParams.get('variant');
        if (this.keys) this.baseUrl += "?variant=" + this.keys + "&";
        else this.baseUrl += "?";
        this.alPageCount = 0;
        this.finished = false;
    }

    getKeyWord() {
        let keywords = location.pathname.split("/").slice(2);
        if (this.keys) keywords.push(this.keys);
        return keywords.join(",");
    }

    async getPage(page) {
        const html = await fetch(this.baseUrl + "page=" + page, {
            method: "GET",
            headers: { "Content-Type": "application/octet-stream" },
            credentials: "include",
            timeout: 10000,
        }).then(res => res.text());
        if (!html) throw "Fetch Error";
        return html;
    }

    /**
     * @param {string} html 
     * @returns {Array<Player>}
     */
    getPlayers(html) {
        let $table = $(".ranking-page-table", $(html));
        let $playerTr = $("tr:gt(0)", $table);
        let players = $playerTr.map((index, tr) => {
            let $tr = $(tr);
            let active = (!$tr.hasClass("ranking-page-table__row--inactive"));
            let $flagDiv = $(".flag-country", $tr);
            let country = $flagDiv.attr("title");
            /* "background-image: url('/assets/images/flags/xxxxx-xxxxx.svg');" */
            let flag = $flagDiv.attr("style");
            let name = $("a:eq(1)", $tr).text().trim();
            let rank = $("td:eq(0)", $tr).text().trim();
            return new Player(name, country, active, flag, rank);
        });
        return players;
    }

    /**
    * @param {number} pageCount 
    * @returns {boolean} isEnd
    */
    async crawl(pageCount = 1) {
        if (this.finished) return true;
        for (let page = 0; page < pageCount; page++) {
            try {
                $("#rs-stat").text("正在获取第 " + (this.alPageCount + 1) + " 页");
                let html = await this.getPage(this.alPageCount + 1);
                let players = this.getPlayers(html);
                players.map((index, player) => {
                    this.list.add(player);
                });
                this.list.sort();
                this.alPageCount += 1;
                if (this.alPageCount >= 200) {
                    this.finished = true;
                    $("#rs-stat").text("全部 " + (this.alPageCount * 50) + " 个玩家获取完毕");
                    return true;
                }
            }
            catch (ex) {
                $("#rs-stat").text("获取出错");
                console.log(ex);
                return false;
            }
        }
        $("#rs-stat").text("已获取 " + (this.alPageCount * 50) + " 个玩家");
        return false;
    }
}

class Script {
    constructor() {
        this.crawler = new Crawler();
    }

    async init() {
        let $openButton = $('<button>', { text: "+", id: "rs-open", class: "btn-osu-big", style: "float:right;top:20%;position:absolute;right:0%;" }).appendTo($("body"));
        $openButton.click(() => {
            $("#rs-div").show();
            $("#rs-open").hide();
        });
        let $mainDiv = $("<div>", { id: "rs-div", style: "top:20%;right:0%;width:70%;position:absolute;text-align:center;background:darkslateblue;" });
        $mainDiv.hide();
        let $modeLabel = $("<span>", { id: "rs-mode", text: "模式：", style:"float: left;"}).appendTo($mainDiv);
        $modeLabel.text("模式：" + this.crawler.getKeyWord());
        let $searchLabel = $("<span>", { id: "rs-stat", text: "状态" }).appendTo($mainDiv);
        let $crawlButton = $('<button>', { text: "获取下一页", id: "rs-crawlbtn", class: "btn-osu-big" }).appendTo($mainDiv);
        $crawlButton.click(async () => {
            $crawlButton.attr("disabled", true);
            $crawlButton.text("正在获取");
            try {
                let result = await this.crawler.crawl(1);
                if (!result) {
                    $crawlButton.attr("disabled", false);
                    $crawlButton.text("获取下一页");
                }
                else {
                    $crawlButton.text("获取完毕");
                }
                this.updateTable();
            }
            catch (ex) {
                $crawlButton.attr("disabled", false);
                $crawlButton.text("获取下一页");
            }
        });
        let $closeButton = $('<button>', { text: "-", id: "rs-close", class: "btn-osu-big", style: "float:right;" }).appendTo($mainDiv);
        $closeButton.click(() => {
            $("#rs-div").hide();
            $("#rs-open").show();
        });
        let $mainTable = $("<table>", { id: "rs-table", style: "table-layout:fixed;" }).appendTo($mainDiv);
        let $thead = $("<thead>").appendTo($mainTable);
        let $tr = $("<tr>", { class: "ranking-page-table__column" }).appendTo($thead);
        let $td = $("<td>", { style: "width:20%" }).appendTo($tr);
        $("<span>", { text: "国家和地区" }).appendTo($td);
        $td = $("<td>", { style: "width:5%" }).appendTo($tr);
        $("<span>", { text: "人数" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { text: "玩家" }).appendTo($td);
        $mainDiv.appendTo($("body"));
    }

    updateTable() {
        let $mainTable = $("#rs-table");
        $mainTable.empty();
        let $thead = $("<thead>").appendTo($mainTable);
        let $tr = $("<tr>", { class: "ranking-page-table__column" }).appendTo($thead);
        let $td = $("<td>", { style: "width:20%" }).appendTo($tr);
        $("<span>", { text: "国家和地区" }).appendTo($td);
        $td = $("<td>", { style: "width:5%" }).appendTo($tr);
        $("<span>", { text: "人数" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { text: "玩家" }).appendTo($td);
        let $tbody = $("<tbody>").appendTo($mainTable);
        this.crawler.list.countryList.map((cl, index) => {
            let $tr = (index % 2 == 0) ? $("<tr>", { style: "width:100%;background-color: #5649a7;", class: "ranking-page-table__column" }) : $("<tr>", { style: "width:100%;", class: "ranking-page-table__column" });
            let $td = $("<td>").appendTo($tr);
            $("<div>", { style: "display: inline-block;" + cl.flag, class: "flag-country flag-country--medium" }).appendTo($td);
            $("<span>", { text: cl.country, style: "display: inline-table;" }).appendTo($td);
            $td = $("<td>").appendTo($tr);
            $("<span>", { text: cl.count }).appendTo($td);
            $td = $("<td>", { style: "overflow-y: hidden;overflow-x: auto;font-size:12px;" }).appendTo($tr);
            cl.list.map((p) => {
                if (p.active) $("<span>", { text: p.name + "(" + p.rank + "), " }).appendTo($td);
                else $("<span>", { text: p.name + "(" + p.rank + "), ", style: "color:gray" }).appendTo($td);
            });
            $tr.appendTo($tbody);
        })
    }
}

$(document).ready(() => {
    let script = new Script();
    script.init();
});
