// ==UserScript==
// @name        BPSimulator
// @namespace   https://github.com/Exsper/
// @version     1.1.0
// @author      Exsper
// @description 模拟BP变更情况
// @homepage    https://github.com/Exsper/osuweb-tools#readme
// @supportURL  https://github.com/Exsper/osuweb-tools/issues
// @match       https://osu.ppy.sh/users/*
// @match       http://osu.ppy.sh/users/*
// @connect     osudaily.net
// @noframes    
// @grant       GM_xmlhttpRequest
// @grant       GM.xmlHttpRequest
// @require     https://cdn.staticfile.org/jquery/2.1.3/jquery.min.js
// @run-at      document-end
// ==/UserScript==

var GMX;
if (typeof GM == "undefined") {
    GMX = {
        xmlHttpRequest: GM_xmlhttpRequest,
    };
} else {
    GMX = GM;
}

class BestScore {
    constructor(data, isAdded = false) {
        /** pp
         * @type {number} */
        this.pp = data.pp;
        /** 后添加
         * @type {boolean} */
        this.isAdded = isAdded
    }
}


class BestScoreList {
    constructor(data, totalPP, playCount) {
        /** @type {Array<BestScore>} */
        this.BPList = data.map((score) => new BestScore(score));
        this.sort();

        this.origin_BPList = data.map((score) => new BestScore(score));
        this.origin_BPList.sort((a, b) => b.pp - a.pp);

        this.playCount = playCount;

        this.origin_totalPP = totalPP;
        this.origin_bonusPP = 0;
        this.origin_scorePP = 0;
        this.origin_nonBpPP = 0;
        this.origin_scoreCount = 0;
        this.cal_Origin();

        this.totalPP = this.origin_totalPP;
        this.bonusPP = this.origin_bonusPP;
        this.scorePP = this.origin_scorePP;
        this.scoreCount = this.origin_scoreCount;

        this.MAX_SCORECOUNT = 25397;
    }

    sort() {
        this.BPList.sort((a, b) => b.pp - a.pp);
    }

    add(pp) {
        this.BPList.push(new BestScore({ pp }, true));
        this.sort();
        this.scoreCount += 1;
        this.cal_New();
    }

    del(index) {
        this.BPList.splice(index, 1);
        this.scoreCount -= 1;
        this.cal_New();
    }

    /**
     * https://github.com/RoanH/osu-BonusPP
     * 
     * Computes a weighted linear regression equation from
     * the given data set.
     * <pre>
     * The following formulas are used:
     * B1 = Ox,y / Ox^2
     * B0 = Uy - B1 * Ux
     * Ox,y = (1/N) * 'sigma(N,i=1)'((Xi - Ux)(Yi - Uy))
     * Ox^2 = (1/N) * 'sigma(N,i=1)'((Xi - U)^2)
     * </pre>
     * @param ys The data set to make a regression model for
     * @return The linear regression equation, or more specific
     *         this method returns <tt>b0</tt> and <tt>
     *         b1</tt> these two values can be used to form an
     *         equation of the following form <tt>y = b0 + 
     *         b1 * x</tt>.
     */
    calculateLinearRegression(ys) {
        let sumOxy = 0;
        let sumOx2 = 0;
        let avgX = 0;
        let avgY = 0;
        let sumX = 0;
        for (let n = 1; n <= ys.length; n++) {
            let weight = Math.log1p(n + 1);
            sumX += weight;
            avgX += n * weight;
            avgY += ys[n - 1] * weight;
        }
        avgX /= sumX;
        avgY /= sumX;
        for (let n = 1; n <= ys.length; n++) {
            sumOxy += (n - avgX) * (ys[n - 1] - avgY) * Math.log1p(n + 1);
            sumOx2 += Math.pow(n - avgX, 2) * Math.log1p(n + 1);
        }
        let Oxy = sumOxy / sumX;
        let Ox2 = sumOx2 / sumX;
        return [avgY - (Oxy / Ox2) * avgX, Oxy / Ox2];
    }

    /**
     * https://github.com/RoanH/osu-BonusPP
     * 
     * Calculates the amount of PP a player
     * has from non-top-100 scores. Especially 
     * for a top player this can be a significant amount.
     * If the player has less then 100 top scores this
     * method returns 0.
     * @return The amount of PP the player has from non-top-100 scores
     */
    extraPolatePPRemainder() {
        if (this.origin_BPList.length < 100) {
            return 0;
        }
        //Data transformation
        let ys = [];
        for (let i = 0; i < 100; i++) {
            ys[i] = Math.log10(this.origin_BPList[i].pp * Math.pow(0.95, i)) / Math.log10(100);
        }
        let b = this.calculateLinearRegression(ys);
        let pp = 0;
        for (let n = 100; n <= this.playCount; n++) {
            let val = Math.pow(100, b[0] + b[1] * n);
            if (val <= 0) {
                break;
            }
            pp += val;
        }
        return pp;
    }

    cal_Origin() {
        const MAX_BONUSPP = (0.25 / 0.0006);
        if (this.origin_BPList.length < 100) {
            this.origin_nonBpPP = 0;
            this.origin_scoreCount = this.origin_BPList.length;
            this.origin_bonusPP = MAX_BONUSPP * (1 - Math.pow(0.9994, this.origin_scoreCount));
            this.origin_scorePP = this.origin_totalPP - this.origin_bonusPP;
        }
        else {
            this.origin_nonBpPP = this.extraPolatePPRemainder();
            let bpPP = 0;
            for (let i = 0; i < this.origin_BPList.length; i++) {
                bpPP += this.origin_BPList[i].pp * Math.pow(0.95, i);
            }
            this.origin_scorePP = this.origin_nonBpPP + bpPP;
            this.origin_bonusPP = this.origin_totalPP - this.origin_scorePP;
            if (this.origin_bonusPP >= MAX_BONUSPP) {
                this.origin_bonusPP = MAX_BONUSPP;
                this.origin_scoreCount = this.MAX_SCORECOUNT;
            }
            else {
                this.origin_scoreCount = Math.round(Math.log10(-(this.origin_bonusPP / MAX_BONUSPP) + 1) / Math.log10(0.9994));
                this.origin_bonusPP = MAX_BONUSPP * (1 - Math.pow(0.9994, this.origin_scoreCount));
            }
        }
    }

    cal_New() {
        const MAX_BONUSPP = (0.25 / 0.0006);
        this.bonusPP = MAX_BONUSPP * (1 - Math.pow(0.9994, this.scoreCount));
        let bpPP = 0;
        for (let i = 0; i < this.BPList.length; i++) {
            bpPP += this.BPList[i].pp * Math.pow(0.95, i);
        }
        this.scorePP = this.origin_nonBpPP * Math.pow(0.95, (this.scoreCount - this.origin_scoreCount)) + bpPP;
        this.totalPP = this.bonusPP + this.scorePP;
    }
}


function getUrl(url, params) {
    if (params) {
        var paramarray = [];
        for (var k in params) {
            paramarray.push(k + "=" + encodeURIComponent(params[k]));
        }
        return url + "?" + paramarray.join("&");
    } else {
        return url;
    }
}

function getAPI(url, method = "GET") {
    return new Promise(function (resolve, reject) {
        GMX.xmlHttpRequest({
            method: method,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            url: url,
            responseType: "json",
            onload: function (data) {
                if ((data.status >= 200 && data.status < 300) || data.status == 304) {
                    resolve(data.response);
                } else {
                    reject({
                        status: data.status,
                        statusText: data.statusText
                    });
                }
            },
            onerror: function (data) {
                reject({
                    status: data.status,
                    statusText: data.statusText
                });
            }
        });
    });
}

async function getBPInfo(href, mode) {
    try {
        let params = { mode, limit: 100, offset: 0 };
        let url = getUrl(href + "/scores/best", params);
        // console.log(url)
        let mi = await getAPI(url, "GET").then((data) => {
            if (!data || !Array.isArray(data)) return null;
            return data;
        });
        return mi;
    }
    catch (ex) {
        console.log(ex);
        return null;
    }
}

function getRank(pp, mode) {
    try {
        $("#bps-compare-rank").text("");
        $("#bps-sim-rank").text("获取中...");
        let params = {
            t: "pp",
            v: pp,
            m: mode,
        }
        let url = getUrl("https://osudaily.net/data/getPPRank.php", params);
        // console.log(url)
        getAPI(url, "GET").then((data) => {
            // console.log(data)
            if (!data) {
                $("#bps-compare-rank").text("");
                $("#bps-sim-rank").text("获取rank失败");
                return;
            }
            let origin_rank = parseInt($("#bps-origin-rank").text().substring(1));
            let sim_rank = parseInt(data);
            $("#bps-sim-rank").text("#" + sim_rank);
            let compare = origin_rank - sim_rank;
            if (compare > 0) $("#bps-compare-rank").text("+" + compare);
            else if (compare < 0) $("#bps-compare-rank").text(compare);
        });
    }
    catch (ex) {
        console.log(ex);
        $("#bps-sim-rank").text("获取rank失败");
    }
}

function addCss() {
    if (!$(".bps-style").length) {
        $(document.head).append($("<style class='bps-style'></style>").html(
            `.bps-highlight {background: #7cdf7f9e;}`
        ));
    }
}

class Script {
    constructor(href) {
        this.href = href;
        /** @type {BestScoreList | null} */
        this.bsl = null;
        this.modeCode = 0;
    }

    init_Frame() {
        let selectMode = $(".game-mode-link.game-mode-link--active").attr("data-mode");
        let mode = "osu";
        if (selectMode.indexOf("taiko") >= 0) {mode = "taiko"; this.modeCode = 1;}
        if (selectMode.indexOf("fruits") >= 0) {mode = "fruits"; this.modeCode = 2;}
        if (selectMode.indexOf("mania") >= 0) {mode = "mania"; this.modeCode = 3;}

        let $topranksDiv = $("div[data-page-id=top_ranks]");
        let $topranksTitle = $(".title.title--page-extra-small:eq(1)", $topranksDiv);
        let $scriptDiv = $("<div>", { id: "bps-div" });
        let $scriptTable = $("<table>", { id: "bps-table", style: "text-align: center; width: 100%;" }).appendTo($scriptDiv);

        let $tr = $("<tr>", { style: "width:100%" }).appendTo($scriptTable);
        let $td = $("<td>", { style: "width:10%" }).appendTo($tr);
        // $("<span>", {text: "对比" }).appendTo($td);
        $td = $("<td>", { style: "width:20%" }).appendTo($tr);
        $("<span>", { text: "成绩PP" }).appendTo($td);
        $td = $("<td>", { style: "width:5" }).appendTo($tr);
        // $("<span>", {text: "+" }).appendTo($td);
        $td = $("<td>", { style: "width:20%" }).appendTo($tr);
        $("<span>", { text: "奖励PP" }).appendTo($td);
        $td = $("<td>", { style: "width:5" }).appendTo($tr);
        // $("<span>", {text: "=" }).appendTo($td);
        $td = $("<td>", { style: "width:20%" }).appendTo($tr);
        $("<span>", { text: "总PP" }).appendTo($td);
        $td = $("<td>", { style: "width:20%" }).appendTo($tr);
        $("<span>", { text: "Rank " }).appendTo($td);
        $("<a>", { text: "来源", href: "https://osudaily.net/ppbrowser.php", target:"_blank"}).appendTo($td);

        $tr = $("<tr>").appendTo($scriptTable);
        $td = $("<td>").appendTo($tr);
        $("<span>", { text: "原始数据" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-origin-scorepp", text: "获取中..." }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { text: "+" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-origin-bonuspp", text: "获取中..." }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { text: "=" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-origin-totalpp", text: "获取中..." }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-origin-rank", text: "获取中..." }).appendTo($td);

        $tr = $("<tr>").appendTo($scriptTable);
        $td = $("<td>").appendTo($tr);
        // $("<span>", {text: "对比" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-compare-scorepp", text: "+0" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        // $("<span>", {text: "+" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-compare-bonuspp", text: "+0" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        // $("<span>", {text: "=" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-compare-totalpp", text: "+0" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-compare-rank", text: "+0" }).appendTo($td);

        $tr = $("<tr>").appendTo($scriptTable);
        $td = $("<td>").appendTo($tr);
        $("<span>", { text: "模拟数据" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-sim-scorepp", text: "获取中..." }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { text: "+" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-sim-bonuspp", text: "获取中..." }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { text: "=" }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-sim-totalpp", text: "获取中..." }).appendTo($td);
        $td = $("<td>").appendTo($tr);
        $("<span>", { id: "bps-sim-rank", text: "获取中..." }).appendTo($td);

        $tr = $("<tr>", { style: "width:100%" }).appendTo($scriptTable);
        $td = $("<td>", { style: "padding:0 10px", colspan: "6" }).appendTo($tr);
        let $addLabel = $("<span>", { text: "添加新PP：" }).appendTo($td);
        let $addTextbox = $("<input>", { type: "text", id: "bps-addText", style: "width:10%;max-width:unset;", class: "account-edit-entry__input", val: "100" }).appendTo($td);
        let $addButton = $('<button>', { text: "加入BP", id: "bps-addbtn", class: "btn-osu-big" }).appendTo($td);
        $addButton.click(() => {
            if (!this.bsl) return;
            let newpp = parseFloat($("#bps-addText").val());
            if (!!newpp && newpp > 0) {
                this.bsl.add(newpp);
                this.showBPTable();
                this.showData();
            }
            else {
                $("#bps-addText").val(0)
            }
        });
        let $resultDiv = $("<div>", { id: "bps-resultDiv" }).appendTo($scriptDiv);

        let $showBoardButton = $('<button>', { text: "BP模拟器", id: "bps-showbtn", class: "btn-osu-big" });
        $showBoardButton.click(async () => {
            $showBoardButton.text("正在获取BP...");
            $showBoardButton.attr("disabled", true);
            let data = await getBPInfo(this.href, mode);
            // console.log(data)
            if (data) {
                let totalPP = parseInt($(".value-display__value")[3].innerText.replace(/,/, ""));
                let origin_rank = parseInt($(".value-display__value")[0].innerText.replace(/,/, "").substring(1));
                //let playcount = parseInt($(".title__count", $("div[data-page-id=historical]"))[0].innerText.replace(/,/, ""));
                let playcount = parseInt($(".profile-stats__value")[2].innerText.replace(/,/, ""));
                if (!playcount || playcount <= 0) {
                    playcount = 100000;
                    console.log("无法获取playcount");
                }
                $("#bps-origin-rank").text("#" + origin_rank);
                this.bsl = new BestScoreList(data, totalPP, playcount);
                $showBoardButton.hide();
                $scriptDiv.show();
                this.showBPTable();
                this.showData();
            }
            else {
                $showBoardButton.text("获取BP失败，请稍后重试");
                $showBoardButton.attr("disabled", false);
            }
        });
        $scriptDiv.hide();
        $topranksTitle.after($showBoardButton);
        $topranksTitle.after($scriptDiv);
    }

    showData() {
        const DIGIT = 3;

        $("#bps-origin-scorepp").text(this.bsl.origin_scorePP.toFixed(DIGIT));
        $("#bps-origin-bonuspp").text(this.bsl.origin_bonusPP.toFixed(DIGIT) + " (大约 " + this.bsl.origin_scoreCount + " 个)");
        $("#bps-origin-totalpp").text(this.bsl.origin_totalPP.toFixed(DIGIT));

        let c_scorepp = this.bsl.scorePP - this.bsl.origin_scorePP;
        if (c_scorepp > 0) $("#bps-compare-scorepp").text("+" + c_scorepp.toFixed(DIGIT));
        else if (c_scorepp < 0) $("#bps-compare-scorepp").text(c_scorepp.toFixed(DIGIT));
        else $("#bps-compare-scorepp").text(" ");
        let c_bonuspp = this.bsl.bonusPP - this.bsl.origin_bonusPP;
        if (this.bsl.MAX_SCORECOUNT > this.bsl.origin_scoreCount && c_bonuspp > 0) $("#bps-compare-bonuspp").text("+" + c_bonuspp.toFixed(DIGIT));
        else if (this.bsl.MAX_SCORECOUNT > this.bsl.scoreCount && c_bonuspp < 0) $("#bps-compare-bonuspp").text(c_bonuspp.toFixed(DIGIT));
        else $("#bps-compare-bonuspp").text(" ");
        let c_totalpp = this.bsl.totalPP - this.bsl.origin_totalPP;
        if (c_totalpp > 0) $("#bps-compare-totalpp").text("+" + c_totalpp.toFixed(DIGIT));
        else if (c_totalpp < 0) $("#bps-compare-totalpp").text(c_totalpp.toFixed(DIGIT));
        else $("#bps-compare-totalpp").text(" ");

        $("#bps-sim-scorepp").text(this.bsl.scorePP.toFixed(DIGIT));
        $("#bps-sim-bonuspp").text(this.bsl.bonusPP.toFixed(DIGIT) + " (大约 " + this.bsl.scoreCount + " 个)");
        $("#bps-sim-totalpp").text(this.bsl.totalPP.toFixed(DIGIT));

        getRank(this.bsl.totalPP.toFixed(DIGIT), this.modeCode);
    }

    showBPTable() {
        const DIGIT = 3;
        const COLUMN = 5;

        let width_index = 100 / COLUMN / 4;
        let width_pp = 100 / COLUMN / 2;
        let width_operate = 100 / COLUMN / 4;
        $("#bps-resultDiv").empty();
        let $BPTable = $("<table>", { id: "bps-bptable", style: "width:100%", border: "1" }).appendTo($("#bps-resultDiv"));
        let $tr = $("<tr>", { style: "width:100%" }).appendTo($BPTable);
        let $td;
        for (let i = 0; i < COLUMN; i++) {
            $td = $("<td>", { style: "width:" + width_index + "%" }).appendTo($tr);
            $("<span>", { text: "序号" }).appendTo($td);
            $td = $("<td>", { style: "width:" + width_pp + "%" }).appendTo($tr);
            $("<span>", { text: "PP" }).appendTo($td);
            $td = $("<td>", { style: "width:" + width_operate + "%" }).appendTo($tr);
            $("<span>", { text: "删除" }).appendTo($td);
        }
        let rows = Math.ceil(this.bsl.BPList.length / COLUMN);
        for (let i = 0; i < rows; i++) {
            $tr = $("<tr>", { style: "width:100%" }).appendTo($BPTable);
            for (let c = 0; c < COLUMN; c++) {
                let index = c * rows + i;
                if (index >= this.bsl.BPList.length) break;
                let isAdded = this.bsl.BPList[index].isAdded;
                $td = $("<td>", { style: "width:" + width_index + "%" }).appendTo($tr);
                $("<span>", { text: "#" + (index + 1) }).appendTo($td);
                if (isAdded) $td.addClass("bps-highlight");
                $td = $("<td>", { style: "width:" + width_pp + "%" }).appendTo($tr);
                $("<span>", { text: this.bsl.BPList[index].pp.toFixed(DIGIT) }).appendTo($td);
                if (isAdded) $td.addClass("bps-highlight");
                $td = $("<td>", { style: "width:" + width_operate + "%" }).appendTo($tr);
                let $delbtn = $("<a>", { text: "删除", "data-index": index }).appendTo($td);
                $delbtn.click(() => {
                    this.bsl.del(parseInt($delbtn.attr("data-index")));
                    this.showBPTable();
                    this.showData();
                });
                if (isAdded) $td.addClass("bps-highlight");
            }
        }


    }

}

async function startScrpit() {
    addCss();
    let urlex = /users\/\d+/.exec(location.href);
    if (urlex) {
        let surl = location.origin + "/" + urlex[0];
        let script = new Script(surl);
        script.init_Frame();
    }
}

// 确保网页加载完成
function check() {
    let $script = $("#bps-div");
    let $historicalDiv = $("div[data-page-id=historical]");
    if ($script.length <= 0) {
        if ($historicalDiv.length > 0) {
            startScrpit();
            // 局部刷新重新加载
            let interval = setInterval(() => {
                // console.log("检查脚本框架");
                if ($("#bps-div").length <= 0) {
                    // console.log("检查到页面局部刷新");
                    clearInterval(interval);
                    check();
                }
            }, 5000);
        }
        else setTimeout(function () { check(); }, 2000);
    }

}

$(document).ready(() => {
    check();
});
