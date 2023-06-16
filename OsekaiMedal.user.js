// ==UserScript==
// @name        Osekai Medal
// @namespace   https://github.com/Exsper/
// @version     0.1.1
// @author      Exsper
// @description 使用osekai查阅osu!成就方法
// @homepage    https://github.com/Exsper/osuweb-tools#readme
// @supportURL  https://github.com/Exsper/osuweb-tools/issues
// @match       https://osu.ppy.sh/users/*
// @match       http://osu.ppy.sh/users/*
// @connect     osekai.net
// @noframes    
// @grant       GM_xmlhttpRequest
// @grant       GM.xmlHttpRequest
// @grant       GM_setValue
// @grant       GM.setValue
// @grant       GM_getValue
// @grant       GM.getValue
// @require     https://cdn.staticfile.org/jquery/2.1.3/jquery.min.js
// @run-at      document-end
// ==/UserScript==


var GMX;
if (typeof GM == "undefined") {
    GMX = {
        xmlHttpRequest: GM_xmlhttpRequest,
        setValue: function (name, value) {
            return Promise.resolve(GM_setValue(name, value));
        },
        getValue: function (name, def) {
            return Promise.resolve(GM_getValue(name, def));
        }
    };
} else {
    GMX = GM;
}

class BeatmapInfo {
    constructor(data) {
        this.Artist = data.Artist;
        this.BeatmapID = data.BeatmapID;
        this.Difficulty = data.Difficulty;
        this.DifficultyName = data.DifficultyName;
        // this.DownloadUnavailable = data.DownloadUnavailable;
        /** @type {"osu"|"taiko"|"fruits"|"mania"} */
        this.Gamemode = data.Gamemode;
        // this.HasVoted = data.HasVoted;
        this.Mapper = data.Mapper;
        // this.MapperID = data.MapperID;
        this.MapsetID = data.MapsetID;
        // this.MedalName = data.MedalName;
        /** @type {string|null} */
        this.Note = data.Note;
        // this.ObjectID = data.ObjectID;
        this.SongTitle = data.SongTitle;
        // this.SubmissionDate = data.SubmissionDate;
        // this.SubmittedBy = data.SubmittedBy;
        this.VoteSum = data.VoteSum;
    }

    getUrl() {
        return "https://osu.ppy.sh/b/" + this.BeatmapID;
    }

    getTitle() {
        return this.Artist + " - " + this.SongTitle + " (" + this.Mapper + ") [" + this.DifficultyName + "]";
    }

    getImg() {
        return "https://b.ppy.sh/thumb/" + this.MapsetID + "l.jpg";
    }

    getDownloadLink(type) {
        switch (type) {
            case "Beatconnect": return `https://beatconnect.io/b/${this.MapsetID}`;
            case "Sayobot": return `https://dl.sayobot.cn/beatmaps/download/full/${this.MapsetID}`;
            case "SayobotNoVideo": return `https://dl.sayobot.cn/beatmaps/download/novideo/${this.MapsetID}`;
            case "SayobotMini": return `https://dl.sayobot.cn/beatmaps/download/novideo/${this.MapsetID}`;
            case "NeriNyan": return `https://api.nerinyan.moe/d/${this.MapsetID}`;
            case "NeriNyanNoVideo": return `https://api.nerinyan.moe/d/${this.MapsetID}?nv=1`;
            case "Chimu": return `https://api.chimu.moe/v1/download/${this.MapsetID}?n=1`;
            case "osu":
            default: return `https://osu.ppy.sh/beatmapsets/${this.MapsetID}/download`;
        }
    }
}

class PackInfo {
    constructor(packID, modeCode) {
        this.packID = packID;
        /** @type {0|1|2|3} */
        this.modeCode = modeCode;
        this.url = "https://osu.ppy.sh/beatmaps/packs/" + packID;
    }
}

class MedalInfo {
    constructor(data) {
        // this.Date = data.Date;
        // this.Description = data.Description;
        // this.FirstAchievedBy = data.FirstAchievedBy;
        // this.FirstAchievedDate = data.FirstAchievedDate;
        // this.Grouping = data.Grouping;
        // this.Instructions = data.Instructions;
        this.Link = data.Link;
        // this.Locked = data.Locked;
        // this.MedalID = data.MedalID;
        this.ModeOrder = data.ModeOrder;
        /** @type {Array<string>} */
        this.Mods = this.norMods(data.Mods);
        this.Name = data.Name;
        // this.Ordering = data.Ordering;
        // this.PackID = data.PackID;
        /** @type {Array<PackInfo>} */
        this.PackIDs = this.norPacks(data.PackID);
        this.Rarity = data.Rarity;
        // this.Restriction = data.Restriction;
        /** @type {"osu"|"taiko"|"fruits"|"mania"|null} */
        this.mode = this.norMode(data.Restriction);
        this.Solution = data.Solution;
        // this.Video = data.Video;
        /** @type {Array<BeatmapInfo>} */
        this.beatmaps = data.beatmaps.map((data) => new BeatmapInfo(data));
    }

    norPacks(PackIDs) {
        if (!PackIDs) return [];
        let packIDArray = PackIDs.split(",");
        let packInfos = [];
        packIDArray.map((packID, index) => {
            if (packID !== "" && packID !== "0") packInfos.push(new PackInfo(packID, index));
        });
        return packInfos;
    }

    norMods(mods) {
        // "" or null
        if (!mods) return [];
        return mods.split(",");
    }

    norMode(restriction) {
        if (restriction === "NULL") return null;
        return restriction;
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

// 使用 GMX.xmlHttpRequest 跨域访问API
function getAPI(url, method = "GET") {
    return new Promise(function (resolve, reject) {
        GMX.xmlHttpRequest({
            method: method,
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
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

function postAPI(url, data) {
    return new Promise(function (resolve, reject) {
        GMX.xmlHttpRequest({
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            url: url,
            data: data,
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

async function getMedalInfo(medalAlt) {
    try {
        let params = {};
        params.medal = medalAlt.replace(/\s/g, "_");
        let url = getUrl("https://osekai.net/medals/api/public/get_medal.php", params);
        let mi = await getAPI(url, "GET").then((data) => {
            if (!data || !data.Name) return null;
            return new MedalInfo(data);
        });
        return mi;
    }
    catch (ex) {
        console.log(ex);
        return null;
    }
}

async function getBeatmapList(medalAlt) {
    try {
        let bl = await postAPI("https://osekai.net/medals/api/beatmaps.php", "strSearch=" + medalAlt).then((data) => {
            if (!data || !(data instanceof Array)) return [];
            return data.map((binfo) => new BeatmapInfo(binfo))
        });
        return bl;
    }
    catch (ex) {
        console.log(ex);
        return [];
    }
}

function addCss() {
    if (!$(".osekai-medal-style").length) {
        $(document.head).append($("<style class='osekai-medal-style'></style>").html(
            `.medalBtn {position: absolute; right: -1px; bottom: -1px; font-size: 12px; background: white; padding: 3px; width: 22px; text-align: center; border-style: solid; border-width: 1px;}
            .medalBtn:hover {cursor: pointer;}
            .medalCloseBtnDiv {position: absolute; right: 15px; top: 15px;}
            .medalPanel {max-height:600px; overflow-y: auto; color: #000; width: 800px; position: fixed; display: none;z-index: 10000;padding: 15px 20px 10px;-webkit-border-radius: 10px;-moz-border-radius: 10px;border-radius: 10px;background: #fff; left: 50%; top:50%; transform: translate(-50%, -50%);}
            .medalOverlay {position: fixed;top: 0;left: 0;bottom:0;right:0;width: 100%;height: 100%;z-index: 9999;background: #000;display: none;-ms-filter: 'alpha(Opacity=50)';-moz-opacity: .5;-khtml-opacity: .5;opacity: .5;}
            #medalContent, #medalContent h1, #medalContent h2 {color: #000;}`
        ));
    }
}

function addMedalBtn(medalIcon) {
    let alt = medalIcon.alt;
    let medalBtn = $(`<a class='medalBtn' data='${alt}'>?</a>`).hide();
    medalBtn.click(async function () {
        await openMedal($(this).attr("data"));
    });
    let $medalDiv = $(medalIcon).parent();
    $medalDiv.css({ position: "relative" });
    $medalDiv.append(medalBtn);
    $medalDiv.hover(function () {
        $(this).find(".medalBtn").show();
    }, function () {
        $(this).find(".medalBtn").hide();
    });
}

function addAllMedalBtn() {
    let medalIcons = $(".badge-achievement__image");
    medalIcons.map(function (index, item) { addMedalBtn(item) });
}

async function openMedal(alt) {
    if (alt === undefined) return;
    var medalContent = $("#medalContent");
    medalContent.empty();
    medalContent.append(`<h1>加载中...</h1>`);
    $("#medalOverlay").fadeIn(200);
    $("#medalPanel").fadeIn(200);
    /**@type {MedalInfo} */
    let mi = await getMedalInfo(alt);
    medalContent.empty();
    if (!mi) {
        medalContent.append(`<h1>无法从osekai获取数据 :(</h1>`);
        return;
    }
    medalContent.append(
        `<img width="80px" src="${mi.Link}"> 
        <span style="font-size: 36px; vertical-align: middle;">${mi.Name}</span>
        <br><span>Mods要求： </span>${(mi.Mods.length <= 0) ? "<span>未指定</span>" : mi.Mods.map(function (mods) {
            return `<div style="display: -webkit-inline-box; vertical-align: bottom;" class="mod mod--${mods}"></div><span>${mods}</span>`
        }).join("")}
        <br><span>模式要求： ${(!mi.mode) ? "全模式均可" : mi.mode}</span>
        <br>${mi.Solution}
        <br><span>达成率： ${mi.Rarity}%</span>`
    );
    let modeIcons = [
        '<i class="fal fa-extra-mode-osu"></i>',
        '<i class="fal fa-extra-mode-taiko"></i>',
        '<i class="fal fa-extra-mode-fruits"></i>',
        '<i class="fal fa-extra-mode-mania"></i>'
    ];
    if (mi.PackIDs.length > 0) {
        let apHtml = "";
        mi.PackIDs.forEach(function (pi) {
            apHtml += `<tr><td>${modeIcons[pi.modeCode]}</td><td><a href="${pi.url}" target="_blank">${pi.url}</a></td></tr>`;
        });
        medalContent.append(
            `<h2>推荐曲包</h2>
            <table id='packList' style='width: 100%; text-align: center;' border='1'>
                <tr>
                    <td>模式</td><td>曲包</td>
                </tr>
                ${apHtml}
            </table>`
        );
    }
    if (mi.beatmaps.length <= 0) {
        mi.beatmaps = await getBeatmapList(alt);
    }
    if (mi.beatmaps.length > 0) {
        medalContent.append(`<br><span>下载来源：</span>`);
        let downloadSelect = $(`<select id="downloadSelect">
                                <option value="osu">官网下载</option>
                                <option value="Sayobot">Sayobot</option>
                                <option value="SayobotNoVideo">Sayobot（无视频）</option>
                                <option value="SayobotMini">Sayobot（mini）</option>
                                <option value="NeriNyan">NeriNyan</option>
                                <option value="NeriNyanNoVideo">NeriNyan（无视频）</option>
                                <option value="Beatconnect">Beatconnect</option>
                                <option value="Chimu">Chimu</option>
                        </select>`);
        downloadSelect.appendTo(medalContent);
        let savedSelectVal = await GMX.getValue("OMDownSite", "osu");
        $("#downloadSelect").val(savedSelectVal);
        $("#downloadSelect").on("change", async function () {
            $(".downsite").show();
            $(".downsite[downtype!=" + $(this).val() + "]").hide();
            await GMX.setValue("OMDownSite", $(this).val());
        });
        let apHtml = "";
        mi.beatmaps.forEach(function (b) {
            apHtml += `<tr>
                        <td><i class="fal fa-extra-mode-${b.Gamemode}"></i></td>
                        <td><img width="50px" src="${b.getImg()}"></td>
                        <td><a href="${b.getUrl()}" target="_blank">${b.getTitle()}</a></td>
                        <td class="downsite" downtype="Beatconnect"><a href="${b.getDownloadLink("Beatconnect")}">下载</a></td>
                        <td class="downsite" downtype="Sayobot"><a href="${b.getDownloadLink("Sayobot")}">下载</a></td>
                        <td class="downsite" downtype="SayobotNoVideo"><a href="${b.getDownloadLink("SayobotNoVideo")}">下载</a></td>
                        <td class="downsite" downtype="SayobotMini"><a href="${b.getDownloadLink("SayobotMini")}">下载</a></td>
                        <td class="downsite" downtype="NeriNyan"><a href="${b.getDownloadLink("NeriNyan")}">下载</a></td>
                        <td class="downsite" downtype="NeriNyanNoVideo"><a href="${b.getDownloadLink("NeriNyanNoVideo")}">下载</a></td>
                        <td class="downsite" downtype="Chimu"><a href="${b.getDownloadLink("Chimu")}">下载</a></td>
                        <td class="downsite" downtype="osu"><a href="${b.getDownloadLink("osu")}">下载</a></td>
                        <td>${b.VoteSum}</td>
                        <td>${(b.Note) ? b.Note : ""}</td>
                    </tr>`;
        });
        medalContent.append(
            `<h2>推荐谱面</h2>
            <table id='beatmapList' style='width: 100%; text-align: center;' border='1'>
                <tr>
                    <td>模式</td>
                    <td>缩略图</td>
                    <td>谱面</td>
                    <td class="downsite" downtype="Beatconnect">Beatconnect下载</td>
                    <td class="downsite" downtype="Sayobot">Sayobot下载</td>
                    <td class="downsite" downtype="SayobotNoVideo">Sayobot下载（无视频）</td>
                    <td class="downsite" downtype="SayobotMini">Sayobot下载（mini）</td>
                    <td class="downsite" downtype="NeriNyan">NeriNyan下载</td>
                    <td class="downsite" downtype="NeriNyanNoVideo">NeriNyan下载（无视频）</td>
                    <td class="downsite" downtype="Chimu">Chimu下载</td>
                    <td class="downsite" downtype="osu">官网下载</td>
                    <td>评分</td>
                    <td>备注</td>
                </tr>
                ${apHtml}
            </table>`
        );
        $(".downsite[downtype!=" + $("#downloadSelect").val() + "]").hide();
    }
    if ((mi.PackIDs.length <= 0) && (mi.beatmaps.length <= 0)) {
        medalContent.append(
            `<br><br><a href="https://osekai.net/medals/?medal=${alt}" target="_blank">请点此访问Osekai网站并登录以查看推荐谱面</a>
            `);
    }
}

function closeMedalPanel() {
    $("#medalOverlay").fadeOut(200);
    $("#medalPanel").fadeOut(200);
}

function startScrpit() {
    addCss();
    $("body").append("<div class='medalOverlay' id='medalOverlay' style='display:none;''></div>");
    $("body").append("<div class='medalPanel' id='medalPanel' style='display:none;'></div>");
    var medalContent = $("<div id='medalContent'>");
    $("#medalPanel").append(
        "<div class='medalCloseBtnDiv' style='display: block;''><button class='medalCloseBtn'>x</button></div>",
        medalContent
    );
    $("#medalOverlay, .medalCloseBtn").click(function () {
        closeMedalPanel();
    });

    addAllMedalBtn();
}

// 确保网页加载完成
function check() {
    let $script = $("#medalOverlay");
    let $medalsgroup = $(".medals-group");
    if ($script.length <= 0) {
        if ($medalsgroup.length > 0) {
            startScrpit();
            // 局部刷新重新加载
            let interval = setInterval(() => {
                // console.log("检查脚本框架");
                if ($("#medalOverlay").length <= 0) {
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
